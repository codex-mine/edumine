import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import ExamStatus, QuestionApprovalStatus
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
    RequestRevisionRequest,
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
        if item.sections:
            section_total = sum(section.full_marks for section in item.sections)
            if section_total != full_marks:
                raise ValidationException(f"Section marks must sum to exactly {full_marks} (got {section_total})")

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
                    "question_window_opens_at": item.question_window_opens_at,
                    "question_deadline": item.question_deadline,
                    "marks_window_opens_at": item.marks_window_opens_at,
                    "marks_deadline": item.marks_deadline,
                },
            )
            await repository.replace_exam_subject_sections(db, existing.id, item.sections)
            continue

        entity = await repository.create_exam_subject(
            db,
            exam_id=exam.id,
            class_id=item.class_id,
            subject_id=item.subject_id,
            teacher_id=class_subject.teacher_id,
            full_marks=full_marks,
            pass_marks=item.pass_marks,
            question_window_opens_at=item.question_window_opens_at,
            question_deadline=item.question_deadline,
            marks_window_opens_at=item.marks_window_opens_at,
            marks_deadline=item.marks_deadline,
        )
        await repository.replace_exam_subject_sections(db, entity.id, item.sections)
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


async def get_exam_subject_sections(db: AsyncSession, exam_subject_id: uuid.UUID):
    return await repository.list_exam_subject_sections(db, exam_subject_id)


async def _assert_owns_exam_subject(db: AsyncSession, actor: CurrentUser, exam_subject: ExamSubject) -> None:
    if actor.role in ("admin", "principal"):
        return
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None or teacher_record[0].id != exam_subject.teacher_id:
        raise PermissionDeniedException("You can only manage question submission for your own assigned subjects")


def _assert_marks_total(exam_subject: ExamSubject, questions: list) -> int:
    total_marks = sum(item.marks for item in questions)
    if total_marks != exam_subject.full_marks:
        raise ValidationException(
            f"Marks must sum to exactly {exam_subject.full_marks} (got {total_marks})"
        )
    return total_marks


def _assert_sections_match(sections: list, questions: list) -> None:
    """When a subject declares CQ/MCQ/Practical sections, questions tagged with a
    section must name one that exists and each section's marks must add up."""
    known = {section.name for section in sections}

    if not known:
        stray = sorted({item.section for item in questions if item.section})
        if stray:
            raise ValidationException(
                f"This subject has no sections configured, so questions cannot be tagged with one "
                f"(got: {', '.join(stray)}). Configure the subject's sections first."
            )
        return

    tagged = [item for item in questions if item.section]
    unknown = {item.section for item in tagged} - known
    if unknown:
        raise ValidationException(
            f"Unknown question section(s): {', '.join(sorted(unknown))}. "
            f"Configured sections are: {', '.join(sorted(known))}"
        )

    # Untagged questions are allowed (the paper prints them ungrouped), but a
    # section that *is* used must be filled to its exact total.
    for section in sections:
        section_questions = [item for item in tagged if item.section == section.name]
        if not section_questions:
            continue
        section_total = sum(item.marks for item in section_questions)
        if section_total != section.full_marks:
            raise ValidationException(
                f"Section '{section.name}' must total exactly {section.full_marks} marks (got {section_total})"
            )


async def _sync_exam_readiness(db: AsyncSession, exam: Exam) -> None:
    """An exam becomes `ready` only once every subject's paper is approved, and
    drops back to `question_pending` if one is later sent back for revision."""
    remaining = await repository.count_unapproved_exam_subjects(db, exam.id)
    if remaining == 0 and exam.status == ExamStatus.question_pending:
        await repository.update_exam_fields(db, exam, {"status": ExamStatus.ready})
    elif remaining > 0 and exam.status == ExamStatus.ready:
        await repository.update_exam_fields(db, exam, {"status": ExamStatus.question_pending})


async def submit_questions(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID, payload: SubmitQuestionsRequest
) -> ExamSubjectRow:
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, _class_entity, _subject, _teacher, _teacher_user = row
    await _assert_owns_exam_subject(db, actor, exam_subject)

    is_admin = actor.has_role("admin", "principal")
    if exam_subject.question_status == QuestionApprovalStatus.approved and not is_admin:
        raise ValidationException(
            "These questions have already been approved and can no longer be edited. "
            "Ask an admin to request a revision if a change is needed."
        )

    now = _now()
    if exam_subject.question_window_opens_at is not None and now < _ensure_aware(exam_subject.question_window_opens_at):
        raise ValidationException("The question submission window has not opened yet.")
    # A revision was explicitly asked for, so the teacher must be able to act on
    # it — holding them to the original deadline would make the request unusable.
    deadline_applies = exam_subject.question_status != QuestionApprovalStatus.revision_requested
    if deadline_applies and now > _ensure_aware(exam_subject.question_deadline):
        raise ValidationException(
            "The question submission deadline has passed. Ask an admin to extend it before submitting."
        )

    total_marks = _assert_marks_total(exam_subject, payload.questions)
    _assert_sections_match(await repository.list_exam_subject_sections(db, exam_subject.id), payload.questions)

    await repository.update_exam_subject_fields(
        db,
        exam_subject,
        {
            "questions_payload": [item.model_dump() for item in payload.questions],
            "question_submitted_at": _now(),
            "question_status": QuestionApprovalStatus.pending,
            # Clear the previous verdict so a resubmission reads as a fresh review.
            "question_reviewed_by": None,
            "question_reviewed_at": None,
            "question_review_note": None,
        },
    )
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="submit_questions",
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={"question_count": len(payload.questions), "total_marks": total_marks, "status": "pending"},
    )

    await _sync_exam_readiness(db, exam)
    await db.commit()
    return await get_exam_subject_or_404(db, exam_subject_id)


# --- Question review (Admin) --------------------------------------------------


async def list_questions_for_review(
    db: AsyncSession,
    *,
    statuses: list[QuestionApprovalStatus] | None,
    exam_id: uuid.UUID | None,
    class_id: uuid.UUID | None,
    teacher_id: uuid.UUID | None,
) -> list[ExamSubjectRow]:
    return await repository.list_exam_subjects_for_review(
        db, statuses=statuses, exam_id=exam_id, class_id=class_id, teacher_id=teacher_id
    )


async def get_reviewer_names(db: AsyncSession, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    return await repository.get_reviewer_names(db, user_ids)


async def approve_questions(db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID) -> ExamSubjectRow:
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, _class_entity, _subject, _teacher, _teacher_user = row

    if exam_subject.question_status == QuestionApprovalStatus.draft or not exam_subject.questions_payload:
        raise ValidationException("There are no submitted questions to approve for this subject.")
    if exam_subject.question_status == QuestionApprovalStatus.approved:
        raise ConflictException("These questions are already approved.")

    await repository.update_exam_subject_fields(
        db,
        exam_subject,
        {
            "question_status": QuestionApprovalStatus.approved,
            "question_reviewed_by": actor.id,
            "question_reviewed_at": _now(),
            "question_review_note": None,
        },
    )
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="approve_questions",
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={"status": QuestionApprovalStatus.approved.value},
    )

    await _sync_exam_readiness(db, exam)
    await db.commit()
    return await get_exam_subject_or_404(db, exam_subject_id)


async def request_question_revision(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID, payload: RequestRevisionRequest
) -> ExamSubjectRow:
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, class_entity, subject, _teacher, teacher_user = row

    if exam_subject.question_status == QuestionApprovalStatus.draft or not exam_subject.questions_payload:
        raise ValidationException("There are no submitted questions to send back for this subject.")

    await repository.update_exam_subject_fields(
        db,
        exam_subject,
        {
            "question_status": QuestionApprovalStatus.revision_requested,
            "question_reviewed_by": actor.id,
            "question_reviewed_at": _now(),
            "question_review_note": payload.note,
        },
    )
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="request_question_revision",
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={"status": QuestionApprovalStatus.revision_requested.value, "note": payload.note},
    )

    await _sync_exam_readiness(db, exam)
    await db.commit()

    if teacher_user.email:
        await email_service.send_question_revision_requested_email(
            teacher_user.email,
            teacher_user.full_name,
            exam_name=exam.name,
            class_name=class_entity.name,
            subject_name=subject.name,
            note=payload.note,
        )

    return await get_exam_subject_or_404(db, exam_subject_id)


async def set_questions_as_admin(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID, payload: SubmitQuestionsRequest
) -> ExamSubjectRow:
    """Admin authoring a paper directly, bypassing teacher submission entirely.

    Admin-written questions land approved: the reviewer and the author are the
    same person, so a separate approval step would be theatre.
    """
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, _class_entity, _subject, _teacher, _teacher_user = row

    total_marks = _assert_marks_total(exam_subject, payload.questions)
    _assert_sections_match(await repository.list_exam_subject_sections(db, exam_subject.id), payload.questions)

    now = _now()
    await repository.update_exam_subject_fields(
        db,
        exam_subject,
        {
            "questions_payload": [item.model_dump() for item in payload.questions],
            "question_submitted_at": now,
            "question_status": QuestionApprovalStatus.approved,
            "question_reviewed_by": actor.id,
            "question_reviewed_at": now,
            "question_review_note": None,
        },
    )
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="create_questions_as_admin",
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={"question_count": len(payload.questions), "total_marks": total_marks, "status": "approved"},
    )

    await _sync_exam_readiness(db, exam)
    await db.commit()
    return await get_exam_subject_or_404(db, exam_subject_id)


# --- Printable question paper -------------------------------------------------


async def get_question_paper(db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID) -> dict:
    row = await get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, class_entity, subject, _teacher, teacher_user = row

    if not exam_subject.questions_payload:
        raise ValidationException("No questions have been set for this subject yet.")
    if exam_subject.question_status != QuestionApprovalStatus.approved:
        raise ValidationException(
            "Only approved question papers can be generated. This paper is currently "
            f"'{exam_subject.question_status.value}'."
        )

    year = await academic_repository.get_academic_year(db, exam.academic_year_id)
    sections = await repository.list_exam_subject_sections(db, exam_subject.id)
    questions = exam_subject.questions_payload or []

    # Group into printed sections, preserving the configured display order and
    # keeping question numbering continuous across the whole paper.
    grouped: list[dict] = []
    numbering = 1

    def take(predicate) -> list[dict]:
        nonlocal numbering
        picked = []
        for item in questions:
            if not predicate(item):
                continue
            picked.append(
                {
                    "number": numbering,
                    "question_text": item.get("question_text", ""),
                    "marks": item.get("marks", 0),
                    "type": item.get("type", "short"),
                    "options": item.get("options"),
                }
            )
            numbering += 1
        return picked

    for section in sections:
        picked = take(lambda item, name=section.name: item.get("section") == name)
        if picked:
            grouped.append({"name": section.name, "full_marks": section.full_marks, "questions": picked})

    known_names = {section.name for section in sections}
    loose = take(lambda item: item.get("section") not in known_names)
    if loose:
        grouped.append({"name": "Questions" if grouped else "", "full_marks": None, "questions": loose})

    return {
        "exam_subject_id": str(exam_subject.id),
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "term": exam.term,
        "academic_year_name": year.name if year else "",
        "class_name": class_entity.name,
        "subject_name": subject.name,
        "subject_code": subject.code,
        "teacher_name": teacher_user.full_name,
        "full_marks": exam_subject.full_marks,
        "pass_marks": exam_subject.pass_marks,
        "exam_date": exam.start_date.isoformat(),
        "question_status": exam_subject.question_status.value,
        "total_questions": len(questions),
        "total_marks": sum(item.get("marks", 0) for item in questions),
        "sections": grouped,
    }


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
