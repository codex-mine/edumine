import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import ExamStatus
from app.core import email as email_service
from app.core.exceptions import ConflictException, NotFoundException, PermissionDeniedException, ValidationException
from app.modules.academic import repository as academic_repository
from app.modules.exams import ai_service, repository
from app.modules.exams.models import Exam, ExamSubject
from app.modules.exams.repository import EXTENSION_GRANTED_ACTION, EXTENSION_REQUESTED_ACTION, ExamSubjectRow
from app.modules.exams.schemas import (
    ConfigureExamSubjectsRequest,
    CreateExamRequest,
    DraftQuestionsRequest,
    ExtendDeadlineRequest,
    RequestExtensionRequest,
    SubmitQuestionsRequest,
)
from app.modules.teachers import repository as teachers_repository


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- Exam creation & candidate subjects --------------------------------------


async def create_exam(db: AsyncSession, actor: CurrentUser, payload: CreateExamRequest) -> Exam:
    if payload.academic_year_id is not None:
        year = await academic_repository.get_academic_year(db, payload.academic_year_id)
        if year is None:
            raise NotFoundException("Academic year not found")
    else:
        year = await academic_repository.get_active_academic_year(db)
        if year is None:
            raise ValidationException("No active academic year — activate an academic year first")

    for class_id in payload.class_ids:
        if await academic_repository.get_class(db, class_id) is None:
            raise NotFoundException(f"Class {class_id} not found")

    exam = await repository.create_exam(
        db,
        academic_year_id=year.id,
        name=payload.name,
        term=payload.term,
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_by=actor.id,
    )
    await repository.create_exam_classes(db, exam_id=exam.id, class_ids=payload.class_ids)
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="create",
        entity_type="exam",
        entity_id=exam.id,
        new_value={"name": exam.name, "class_count": len(payload.class_ids)},
    )
    await db.commit()
    return await get_exam_or_404(db, exam.id)


async def get_exam_or_404(db: AsyncSession, exam_id: uuid.UUID) -> Exam:
    exam = await repository.get_exam(db, exam_id)
    if exam is None:
        raise NotFoundException("Exam not found")
    return exam


async def list_exams(db: AsyncSession, *, academic_year_id: uuid.UUID | None) -> list[Exam]:
    return await repository.list_exams(db, academic_year_id=academic_year_id)


async def list_candidate_subjects(db: AsyncSession, exam_id: uuid.UUID) -> list[dict]:
    exam = await get_exam_or_404(db, exam_id)
    classes = await repository.list_exam_classes(db, exam.id)

    candidates: list[dict] = []
    for class_entity in classes:
        rows = await academic_repository.list_class_subjects(
            db, academic_year_id=exam.academic_year_id, class_id=class_entity.id
        )
        for class_subject, class_row, subject, teacher, teacher_user in rows:
            existing = await repository.get_exam_subject_by_exam_class_subject(
                db, exam_id=exam.id, class_id=class_entity.id, subject_id=subject.id
            )
            candidates.append(
                {
                    "class_id": str(class_entity.id),
                    "class_name": class_row.name,
                    "subject_id": str(subject.id),
                    "subject_name": subject.name,
                    "subject_code": subject.code,
                    "teacher_id": str(teacher.id) if teacher else None,
                    "teacher_name": teacher_user.full_name if teacher_user else None,
                    "default_full_marks": class_subject.full_marks,
                    "exam_subject_id": str(existing.id) if existing else None,
                }
            )
    return candidates


# --- Subject configuration + teacher notification ---------------------------


async def configure_exam_subjects(
    db: AsyncSession, actor: CurrentUser, exam_id: uuid.UUID, payload: ConfigureExamSubjectsRequest
) -> list[ExamSubjectRow]:
    exam = await get_exam_or_404(db, exam_id)
    exam_class_ids = {c.id for c in await repository.list_exam_classes(db, exam.id)}

    created_ids: list[uuid.UUID] = []

    for item in payload.items:
        if item.class_id not in exam_class_ids:
            raise ValidationException("This class is not part of the selected exam")

        class_subject = await academic_repository.get_class_subject_by_year_class_subject(
            db, academic_year_id=exam.academic_year_id, class_id=item.class_id, subject_id=item.subject_id
        )
        if class_subject is None:
            raise ValidationException(
                "This subject is not assigned to this class for the academic year — "
                "configure it in Academic Structure Management first"
            )
        if class_subject.teacher_id is None:
            raise ValidationException(
                "No teacher is assigned to this class-subject yet — assign one in Academic Structure Management first"
            )

        full_marks = item.full_marks or class_subject.full_marks
        if item.pass_marks > full_marks:
            raise ValidationException("pass_marks cannot exceed full_marks")

        existing = await repository.get_exam_subject_by_exam_class_subject(
            db, exam_id=exam.id, class_id=item.class_id, subject_id=item.subject_id
        )
        if existing is not None:
            if existing.question_submitted_at is not None:
                raise ConflictException(
                    "Cannot reconfigure a subject whose questions have already been submitted"
                )
            await repository.update_exam_subject_fields(
                db,
                existing,
                {
                    "full_marks": full_marks,
                    "pass_marks": item.pass_marks,
                    "question_deadline": item.question_deadline,
                    "marks_deadline": item.marks_deadline,
                },
            )
            continue

        entity = await repository.create_exam_subject(
            db,
            exam_id=exam.id,
            class_id=item.class_id,
            subject_id=item.subject_id,
            teacher_id=class_subject.teacher_id,
            full_marks=full_marks,
            pass_marks=item.pass_marks,
            question_deadline=item.question_deadline,
            marks_deadline=item.marks_deadline,
        )
        created_ids.append(entity.id)

    if exam.status == ExamStatus.draft and (created_ids or await repository.list_exam_subjects_for_exam(db, exam.id)):
        await repository.update_exam_fields(db, exam, {"status": ExamStatus.question_pending})

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="configure_subjects",
        entity_type="exam",
        entity_id=exam.id,
        new_value={"created": len(created_ids), "updated": len(payload.items) - len(created_ids)},
    )
    await db.commit()

    for exam_subject_id in created_ids:
        await _notify_teacher_assigned(db, exam_subject_id)

    return await repository.list_exam_subjects_for_exam(db, exam.id)


async def _notify_teacher_assigned(db: AsyncSession, exam_subject_id: uuid.UUID) -> None:
    row = await repository.get_exam_subject(db, exam_subject_id)
    if row is None:
        return
    exam_subject, exam, class_entity, subject, _teacher, teacher_user = row
    await record_audit_log(
        db,
        actor_id=None,
        action="question_assignment_notified",
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={"teacher_id": str(exam_subject.teacher_id), "deadline": exam_subject.question_deadline.isoformat()},
    )
    await db.commit()
    if teacher_user.email:
        try:
            await email_service.send_exam_question_assignment_email(
                teacher_user.email,
                teacher_user.full_name,
                exam_name=exam.name,
                class_name=class_entity.name,
                subject_name=subject.name,
                deadline=exam_subject.question_deadline.isoformat(),
            )
        except Exception:  # noqa: BLE001 - best-effort notification, never blocks the workflow
            pass


# --- Teacher-facing views ----------------------------------------------------


async def list_my_pending_submissions(db: AsyncSession, actor: CurrentUser) -> list[ExamSubjectRow]:
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None:
        raise NotFoundException("Teacher profile not found")
    return await repository.list_exam_subjects_for_teacher(db, teacher_record[0].id)


async def get_exam_subject_or_404(db: AsyncSession, exam_subject_id: uuid.UUID) -> ExamSubjectRow:
    row = await repository.get_exam_subject(db, exam_subject_id)
    if row is None:
        raise NotFoundException("Exam subject configuration not found")
    return row


async def _assert_owns_exam_subject(db: AsyncSession, actor: CurrentUser, exam_subject: ExamSubject) -> None:
    if actor.role in ("admin", "principal"):
        return
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None or teacher_record[0].id != exam_subject.teacher_id:
        raise PermissionDeniedException("You can only manage question submission for your own assigned subjects")


async def submit_questions(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID, payload: SubmitQuestionsRequest
) -> ExamSubjectRow:
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, _class_entity, _subject, _teacher, _teacher_user = row
    await _assert_owns_exam_subject(db, actor, exam_subject)

    if _now() > _ensure_aware(exam_subject.question_deadline):
        raise ValidationException(
            "The question submission deadline has passed. Ask an admin to extend it before submitting."
        )

    total_marks = sum(item.marks for item in payload.questions)
    if total_marks != exam_subject.full_marks:
        raise ValidationException(
            f"Marks must sum to exactly {exam_subject.full_marks} (got {total_marks})"
        )

    await repository.update_exam_subject_fields(
        db,
        exam_subject,
        {
            "questions_payload": [item.model_dump() for item in payload.questions],
            "question_submitted_at": _now(),
        },
    )
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="submit_questions",
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={"question_count": len(payload.questions), "total_marks": total_marks},
    )

    if exam.status == ExamStatus.question_pending:
        remaining = await repository.count_unsubmitted_exam_subjects(db, exam.id)
        if remaining == 0:
            await repository.update_exam_fields(db, exam, {"status": ExamStatus.ready})

    await db.commit()
    return await get_exam_subject_or_404(db, exam_subject_id)


def _ensure_aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


# --- Deadline extension -------------------------------------------------------


async def request_extension(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID, payload: RequestExtensionRequest
) -> ExamSubjectRow:
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, class_entity, subject, _teacher, teacher_user = row
    await _assert_owns_exam_subject(db, actor, exam_subject)

    if exam_subject.question_submitted_at is not None:
        raise ConflictException("Questions have already been submitted for this subject")

    await record_audit_log(
        db,
        actor_id=actor.id,
        action=EXTENSION_REQUESTED_ACTION,
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={
            "reason": payload.reason,
            "requested_deadline": payload.requested_deadline.isoformat(),
            "current_deadline": exam_subject.question_deadline.isoformat(),
        },
    )
    await db.commit()

    for admin_name, admin_email in await repository.list_admin_principal_emails(db):
        try:
            await email_service.send_deadline_extension_request_email(
                admin_email,
                admin_name,
                teacher_name=teacher_user.full_name,
                exam_name=exam.name,
                class_name=class_entity.name,
                subject_name=subject.name,
                reason=payload.reason,
                requested_deadline=payload.requested_deadline.isoformat(),
            )
        except Exception:  # noqa: BLE001 - best-effort notification
            pass

    return row


async def list_extension_requests(db: AsyncSession) -> list[dict]:
    logs = await repository.list_recent_extension_request_logs(db)
    seen: set[uuid.UUID] = set()
    pending: list[dict] = []

    for log in logs:
        if log.entity_id in seen:
            continue
        seen.add(log.entity_id)

        row = await repository.get_exam_subject(db, log.entity_id)
        if row is None:
            continue
        exam_subject, exam, class_entity, subject, _teacher, teacher_user = row

        if exam_subject.updated_at >= log.created_at:
            continue  # already resolved (deadline changed after this request was made)
        if exam_subject.question_submitted_at is not None:
            continue

        payload = log.new_value or {}
        pending.append(
            {
                "exam_subject_id": str(exam_subject.id),
                "exam_id": str(exam.id),
                "exam_name": exam.name,
                "class_name": class_entity.name,
                "subject_name": subject.name,
                "teacher_id": str(exam_subject.teacher_id),
                "teacher_name": teacher_user.full_name,
                "current_deadline": exam_subject.question_deadline,
                "requested_deadline": payload.get("requested_deadline"),
                "reason": payload.get("reason"),
                "requested_at": log.created_at,
            }
        )

    return pending


async def extend_deadline(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID, payload: ExtendDeadlineRequest
) -> ExamSubjectRow:
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, class_entity, subject, _teacher, teacher_user = row

    if _ensure_aware(payload.new_deadline) <= _ensure_aware(exam_subject.question_deadline):
        raise ValidationException("The new deadline must be after the current deadline")

    previous_deadline = exam_subject.question_deadline
    await repository.update_exam_subject_fields(db, exam_subject, {"question_deadline": payload.new_deadline})
    await record_audit_log(
        db,
        actor_id=actor.id,
        action=EXTENSION_GRANTED_ACTION,
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        old_value={"question_deadline": previous_deadline.isoformat()},
        new_value={"question_deadline": payload.new_deadline.isoformat()},
    )
    await db.commit()

    if teacher_user.email:
        try:
            await email_service.send_deadline_extended_email(
                teacher_user.email,
                teacher_user.full_name,
                exam_name=exam.name,
                class_name=class_entity.name,
                subject_name=subject.name,
                new_deadline=payload.new_deadline.isoformat(),
            )
        except Exception:  # noqa: BLE001 - best-effort notification
            pass

    return await get_exam_subject_or_404(db, exam_subject_id)


# --- AI draft-assist ----------------------------------------------------------


async def draft_questions(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID, payload: DraftQuestionsRequest
) -> dict:
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, class_entity, subject, _teacher, _teacher_user = row
    await _assert_owns_exam_subject(db, actor, exam_subject)

    data_scope = f"the {subject.name} exam subject for {class_entity.name} in {exam.name} only"

    try:
        return await ai_service.draft_exam_questions(
            subject_name=subject.name,
            class_level=class_entity.name,
            full_marks=exam_subject.full_marks,
            topics=payload.topics,
            question_count=payload.question_count,
            question_type=payload.question_type,
            data_scope=data_scope,
        )
    except ai_service.AIDraftUnavailable as exc:
        raise ValidationException(exc.message) from exc
