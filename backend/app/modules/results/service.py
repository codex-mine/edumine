import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import ExamStatus, PublicationStatus
from app.core.exceptions import ConflictException, NotFoundException, PermissionDeniedException, ValidationException
from app.modules.academic import repository as academic_repository
from app.modules.exams import repository as exams_repository
from app.modules.exams.models import ExamSubject
from app.modules.exams.repository import ExamSubjectRow
from app.modules.guardians import repository as guardians_repository
from app.modules.results import ai_service, repository
from app.modules.results.schemas import RejectResultsRequest, SaveMarksRequest
from app.modules.students import repository as students_repository
from app.modules.teachers import repository as teachers_repository

# Grading scale (percentage of full_marks -> letter grade). database.md defines
# `exam_results.grade` as "computed at publish time" but does not specify grade
# boundaries, so this is an explicit implementation default (a conventional
# percentage-banded scale) applied uniformly across the school.
GRADE_BANDS: list[tuple[float, str]] = [
    (80, "A+"),
    (70, "A"),
    (60, "A-"),
    (50, "B"),
    (40, "C"),
    (33, "D"),
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _compute_grade(marks_obtained: float, full_marks: int) -> str:
    if full_marks <= 0:
        return "F"
    percentage = (marks_obtained / full_marks) * 100
    for threshold, label in GRADE_BANDS:
        if percentage >= threshold:
            return label
    return "F"


# --- Ownership / access helpers ----------------------------------------------


async def _get_exam_subject_or_404(db: AsyncSession, exam_subject_id: uuid.UUID) -> ExamSubjectRow:
    row = await exams_repository.get_exam_subject(db, exam_subject_id)
    if row is None:
        raise NotFoundException("Exam subject configuration not found")
    return row


async def _assert_owns_exam_subject(db: AsyncSession, actor: CurrentUser, exam_subject: ExamSubject) -> None:
    if actor.role in ("admin", "principal"):
        return
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None or teacher_record[0].id != exam_subject.teacher_id:
        raise PermissionDeniedException("You can only manage marks for your own assigned subjects")


async def _resolve_own_student(db: AsyncSession, actor: CurrentUser):
    record = await students_repository.get_student_by_user_id(db, actor.id)
    if record is None:
        raise NotFoundException("Student profile not found")
    return record


async def _assert_guardian_owns_student(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> None:
    guardian_record = await guardians_repository.get_guardian_by_user_id(db, actor.id)
    if guardian_record is None:
        raise NotFoundException("Guardian profile not found")
    linked = await students_repository.list_students_for_guardian(db, guardian_record[0].id)
    if not any(linked_student.id == student_id for _link, linked_student, _u in linked):
        raise PermissionDeniedException("You can only view a linked child's results")


async def _assert_can_view_student(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> None:
    if actor.role in ("admin", "principal"):
        return
    if actor.role == "guardian":
        await _assert_guardian_owns_student(db, actor, student_id)
        return
    raise PermissionDeniedException("You do not have access to this student's results")


# --- Teacher: marks entry -----------------------------------------------------


async def list_my_pending_marks(db: AsyncSession, actor: CurrentUser) -> list[ExamSubjectRow]:
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None:
        raise NotFoundException("Teacher profile not found")
    return await exams_repository.list_exam_subjects_for_teacher(db, teacher_record[0].id)


def _is_overdue(deadline: datetime) -> bool:
    deadline_aware = deadline if deadline.tzinfo is not None else deadline.replace(tzinfo=timezone.utc)
    return _now() > deadline_aware


async def _build_roster(db: AsyncSession, row: ExamSubjectRow) -> dict:
    exam_subject, exam, class_entity, subject, _teacher, _teacher_user = row
    students = await repository.list_students_in_class(
        db, academic_year_id=exam.academic_year_id, class_id=class_entity.id
    )
    existing = await repository.list_exam_results_for_subject(db, exam_subject.id)
    existing_by_student = {result.student_id: result for result, _s, _u in existing}

    student_rows = []
    for student, user, enrollment, section in students:
        mark = existing_by_student.get(student.id)
        student_rows.append(
            {
                "student_id": str(student.id),
                "admission_number": student.admission_number,
                "full_name": user.full_name,
                "roll_number": enrollment.roll_number,
                "section_name": section.name,
                "marks_obtained": float(mark.marks_obtained) if mark and mark.marks_obtained is not None else None,
                "is_absent": mark.is_absent if mark else False,
                "grade": mark.grade if mark else None,
                "entered_at": mark.entered_at.isoformat() if mark and mark.entered_at else None,
            }
        )

    return {
        "exam_subject_id": str(exam_subject.id),
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "exam_status": exam.status.value,
        "class_name": class_entity.name,
        "subject_name": subject.name,
        "full_marks": exam_subject.full_marks,
        "pass_marks": exam_subject.pass_marks,
        "marks_deadline": exam_subject.marks_deadline.isoformat(),
        "marks_submitted_at": exam_subject.marks_submitted_at.isoformat() if exam_subject.marks_submitted_at else None,
        "is_overdue": exam_subject.marks_submitted_at is None and _is_overdue(exam_subject.marks_deadline),
        "students": student_rows,
    }


async def get_marks_roster(db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID) -> dict:
    row = await _get_exam_subject_or_404(db, exam_subject_id)
    await _assert_owns_exam_subject(db, actor, row[0])
    return await _build_roster(db, row)


async def save_marks(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID, payload: SaveMarksRequest
) -> dict:
    row = await _get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, class_entity, _subject, _teacher, _teacher_user = row
    await _assert_owns_exam_subject(db, actor, exam_subject)

    if exam_subject.marks_submitted_at is not None:
        raise ConflictException("Marks have already been submitted for this subject")
    if _is_overdue(exam_subject.marks_deadline):
        raise ValidationException("The marks submission deadline has passed")

    enrolled = await repository.list_students_in_class(
        db, academic_year_id=exam.academic_year_id, class_id=class_entity.id
    )
    enrolled_ids = {student.id for student, _u, _e, _s in enrolled}

    for item in payload.items:
        if item.student_id not in enrolled_ids:
            raise ValidationException(f"Student {item.student_id} is not enrolled in this class")
        if item.marks_obtained is not None and item.marks_obtained > exam_subject.full_marks:
            raise ValidationException(f"marks_obtained cannot exceed full_marks ({exam_subject.full_marks})")

    for item in payload.items:
        await repository.upsert_exam_result(
            db,
            exam_subject_id=exam_subject.id,
            student_id=item.student_id,
            marks_obtained=item.marks_obtained,
            is_absent=item.is_absent,
            entered_by=actor.id,
        )

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="save_marks",
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={"count": len(payload.items)},
    )
    await db.commit()
    return await _build_roster(db, row)


async def submit_marks(db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID) -> dict:
    row = await _get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, class_entity, _subject, _teacher, _teacher_user = row
    await _assert_owns_exam_subject(db, actor, exam_subject)

    if _is_overdue(exam_subject.marks_deadline) and exam_subject.marks_submitted_at is None:
        raise ValidationException("The marks submission deadline has passed")

    enrolled = await repository.list_students_in_class(
        db, academic_year_id=exam.academic_year_id, class_id=class_entity.id
    )
    enrolled_ids = {student.id for student, _u, _e, _s in enrolled}
    existing = await repository.list_exam_results_for_subject(db, exam_subject.id)
    entered_ids = {result.student_id for result, _s, _u in existing}

    missing = enrolled_ids - entered_ids
    if missing:
        raise ValidationException(
            "Enter marks or mark absent for every enrolled student before submitting "
            f"({len(missing)} student(s) missing)"
        )

    await exams_repository.update_exam_subject_fields(db, exam_subject, {"marks_submitted_at": _now()})
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="submit_marks",
        entity_type="exam_subject",
        entity_id=exam_subject.id,
        new_value={"student_count": len(enrolled_ids)},
    )
    await db.commit()
    return await _build_roster(db, row)


# --- Admin: compilation & submission for Principal approval -------------------


async def _publication_response(db: AsyncSession, exam, pub) -> dict:
    total = await repository.count_exam_subjects(db, exam.id)
    pending = await repository.count_exam_subjects_marks_pending(db, exam.id)
    return {
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "exam_status": exam.status.value,
        "total_subjects": total,
        "submitted_subjects": total - pending,
        "publication_status": pub.status.value if pub else None,
        "submitted_by": str(pub.submitted_by) if pub and pub.submitted_by else None,
        "approved_by": str(pub.approved_by) if pub and pub.approved_by else None,
        "approved_at": pub.approved_at.isoformat() if pub and pub.approved_at else None,
        "published_at": pub.published_at.isoformat() if pub and pub.published_at else None,
    }


async def get_compilation_status(db: AsyncSession, exam_id: uuid.UUID) -> dict:
    exam = await exams_repository.get_exam(db, exam_id)
    if exam is None:
        raise NotFoundException("Exam not found")
    pub = await repository.get_publication(db, exam_id)
    return await _publication_response(db, exam, pub)


async def compile_and_submit(db: AsyncSession, actor: CurrentUser, exam_id: uuid.UUID) -> dict:
    exam = await exams_repository.get_exam(db, exam_id)
    if exam is None:
        raise NotFoundException("Exam not found")

    total = await repository.count_exam_subjects(db, exam_id)
    if total == 0:
        raise ValidationException("This exam has no configured subjects to compile")
    pending = await repository.count_exam_subjects_marks_pending(db, exam_id)
    if pending > 0:
        raise ValidationException(f"{pending} subject(s) still have unsubmitted marks — cannot compile yet")

    pub = await repository.get_publication(db, exam_id)
    if pub is not None and pub.status in (PublicationStatus.approved, PublicationStatus.published):
        raise ConflictException(f"Results are already '{pub.status.value}' for this exam")

    if pub is None:
        pub = await repository.create_publication(db, exam_id=exam_id, submitted_by=actor.id)
    else:
        await repository.update_publication_fields(
            db,
            pub,
            {
                "status": PublicationStatus.pending,
                "submitted_by": actor.id,
                "approved_by": None,
                "approved_at": None,
            },
        )

    await exams_repository.update_exam_fields(db, exam, {"status": ExamStatus.results_pending})
    await record_audit_log(
        db, actor_id=actor.id, action="compile_submit", entity_type="exam", entity_id=exam.id
    )
    await db.commit()
    return await _publication_response(db, exam, pub)


# --- Principal: approve / reject / publish -------------------------------------


async def list_pending_approval(db: AsyncSession) -> list[dict]:
    rows = await repository.list_principal_queue(db)
    results = []
    for exam, pub in rows:
        results.append(await _publication_response(db, exam, pub))
    return results


async def _get_publication_or_404(db: AsyncSession, exam_id: uuid.UUID):
    exam = await exams_repository.get_exam(db, exam_id)
    if exam is None:
        raise NotFoundException("Exam not found")
    pub = await repository.get_publication(db, exam_id)
    if pub is None:
        raise NotFoundException("Results have not been submitted for approval yet")
    return exam, pub


async def approve_results(db: AsyncSession, actor: CurrentUser, exam_id: uuid.UUID) -> dict:
    exam, pub = await _get_publication_or_404(db, exam_id)
    if pub.status != PublicationStatus.pending:
        raise ConflictException(f"Cannot approve results in '{pub.status.value}' status")

    await repository.update_publication_fields(
        db, pub, {"status": PublicationStatus.approved, "approved_by": actor.id, "approved_at": _now()}
    )
    await record_audit_log(db, actor_id=actor.id, action="approve", entity_type="exam", entity_id=exam.id)
    await db.commit()
    return await _publication_response(db, exam, pub)


async def reject_results(
    db: AsyncSession, actor: CurrentUser, exam_id: uuid.UUID, payload: RejectResultsRequest
) -> dict:
    exam, pub = await _get_publication_or_404(db, exam_id)
    if pub.status != PublicationStatus.pending:
        raise ConflictException(f"Cannot reject results in '{pub.status.value}' status")

    await repository.update_publication_fields(db, pub, {"status": PublicationStatus.rejected})
    await exams_repository.update_exam_fields(db, exam, {"status": ExamStatus.ready})
    await record_audit_log(
        db, actor_id=actor.id, action="reject", entity_type="exam", entity_id=exam.id, new_value={"reason": payload.reason}
    )
    await db.commit()
    return await _publication_response(db, exam, pub)


async def publish_results(db: AsyncSession, actor: CurrentUser, exam_id: uuid.UUID) -> dict:
    exam, pub = await _get_publication_or_404(db, exam_id)
    if pub.status != PublicationStatus.approved:
        raise ValidationException("Results must be approved before they can be published")

    subjects = await exams_repository.list_exam_subjects_for_exam(db, exam_id)
    for exam_subject, _exam, _class_entity, _subject, _teacher, _teacher_user in subjects:
        for result, _student, _user in await repository.list_exam_results_for_subject(db, exam_subject.id):
            grade = None if result.is_absent or result.marks_obtained is None else _compute_grade(
                float(result.marks_obtained), exam_subject.full_marks
            )
            await repository.update_exam_result_fields(db, result, {"grade": grade})

    await repository.update_publication_fields(
        db, pub, {"status": PublicationStatus.published, "published_at": _now()}
    )
    await exams_repository.update_exam_fields(db, exam, {"status": ExamStatus.published})
    await record_audit_log(db, actor_id=actor.id, action="publish", entity_type="exam", entity_id=exam.id)
    await db.commit()
    return await _publication_response(db, exam, pub)


# --- Result cards & report cards (published data only) ------------------------


def _subject_card(exam_subject: ExamSubject, result, subject_name: str) -> dict:
    passed = (
        not result.is_absent
        and result.marks_obtained is not None
        and float(result.marks_obtained) >= exam_subject.pass_marks
    )
    return {
        "subject_name": subject_name,
        "full_marks": exam_subject.full_marks,
        "pass_marks": exam_subject.pass_marks,
        "marks_obtained": float(result.marks_obtained) if result.marks_obtained is not None else None,
        "is_absent": result.is_absent,
        "grade": result.grade,
        "passed": passed,
    }


async def _exam_card_for_student(db: AsyncSession, *, student_id: uuid.UUID, exam_id: uuid.UUID) -> dict:
    exam = await exams_repository.get_exam(db, exam_id)
    if exam is None:
        raise NotFoundException("Exam not found")
    student_record = await students_repository.get_student_by_id(db, student_id)
    if student_record is None:
        raise NotFoundException("Student not found")
    student, user = student_record

    rows = await repository.list_published_results_for_student_exam(db, student_id=student_id, exam_id=exam_id)
    if not rows:
        raise NotFoundException("No published results found for this exam")

    subjects = [_subject_card(exam_subject, result, subject.name) for result, exam_subject, subject in rows]
    total_obtained = sum(s["marks_obtained"] or 0 for s in subjects)
    total_full = sum(s["full_marks"] for s in subjects)
    percentage = round((total_obtained / total_full) * 100, 2) if total_full else 0.0
    overall_grade = _compute_grade(total_obtained, total_full) if total_full else None

    pub = await repository.get_publication(db, exam_id)
    class_name = None
    if rows:
        _r0, exam_subject0, _s0 = rows[0]
        class_row = await academic_repository.get_class(db, exam_subject0.class_id)
        class_name = class_row.name if class_row else None

    return {
        "student_id": str(student.id),
        "student_name": user.full_name,
        "admission_number": student.admission_number,
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "term": exam.term,
        "class_name": class_name,
        "subjects": subjects,
        "total_obtained": total_obtained,
        "total_full_marks": total_full,
        "percentage": percentage,
        "overall_grade": overall_grade,
        "published_at": pub.published_at.isoformat() if pub and pub.published_at else None,
    }


async def get_my_exam_card(db: AsyncSession, actor: CurrentUser, exam_id: uuid.UUID) -> dict:
    student, _user = await _resolve_own_student(db, actor)
    return await _exam_card_for_student(db, student_id=student.id, exam_id=exam_id)


async def get_student_exam_card(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID, exam_id: uuid.UUID) -> dict:
    await _assert_can_view_student(db, actor, student_id)
    return await _exam_card_for_student(db, student_id=student_id, exam_id=exam_id)


async def _report_card_for_student(db: AsyncSession, *, student_id: uuid.UUID, academic_year_id: uuid.UUID | None) -> dict:
    student_record = await students_repository.get_student_by_id(db, student_id)
    if student_record is None:
        raise NotFoundException("Student not found")
    student, user = student_record

    if academic_year_id is None:
        year = await academic_repository.get_active_academic_year(db)
        if year is None:
            raise ValidationException("No active academic year")
    else:
        year = await academic_repository.get_academic_year(db, academic_year_id)
        if year is None:
            raise NotFoundException("Academic year not found")

    rows = await repository.list_published_results_for_student_year(db, student_id=student_id, academic_year_id=year.id)

    exams_map: dict[uuid.UUID, dict] = {}
    for result, exam_subject, subject, exam in rows:
        entry = exams_map.setdefault(
            exam.id,
            {"exam_id": str(exam.id), "exam_name": exam.name, "term": exam.term, "subjects": []},
        )
        entry["subjects"].append(_subject_card(exam_subject, result, subject.name))

    exam_entries = []
    overall_obtained = 0.0
    overall_full = 0
    for entry in exams_map.values():
        total_obtained = sum(s["marks_obtained"] or 0 for s in entry["subjects"])
        total_full = sum(s["full_marks"] for s in entry["subjects"])
        entry["total_obtained"] = total_obtained
        entry["total_full_marks"] = total_full
        entry["percentage"] = round((total_obtained / total_full) * 100, 2) if total_full else 0.0
        overall_obtained += total_obtained
        overall_full += total_full
        exam_entries.append(entry)

    overall_percentage = round((overall_obtained / overall_full) * 100, 2) if overall_full else 0.0
    overall_grade = _compute_grade(overall_obtained, overall_full) if overall_full else None

    return {
        "student_id": str(student.id),
        "student_name": user.full_name,
        "admission_number": student.admission_number,
        "academic_year_id": str(year.id),
        "academic_year_name": year.name,
        "exams": exam_entries,
        "overall_total_obtained": overall_obtained,
        "overall_total_full_marks": overall_full,
        "overall_percentage": overall_percentage,
        "overall_grade": overall_grade,
    }


async def get_my_report_card(db: AsyncSession, actor: CurrentUser, academic_year_id: uuid.UUID | None) -> dict:
    student, _user = await _resolve_own_student(db, actor)
    return await _report_card_for_student(db, student_id=student.id, academic_year_id=academic_year_id)


async def get_student_report_card(
    db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID, academic_year_id: uuid.UUID | None
) -> dict:
    await _assert_can_view_student(db, actor, student_id)
    return await _report_card_for_student(db, student_id=student_id, academic_year_id=academic_year_id)


# --- AI-assisted result insight summaries (published data only) ---------------


async def get_subject_insight(db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID) -> dict:
    if actor.role not in ("teacher", "admin", "principal"):
        raise PermissionDeniedException("You do not have access to this insight summary")

    row = await _get_exam_subject_or_404(db, exam_subject_id)
    exam_subject, exam, class_entity, subject, _teacher, _teacher_user = row
    await _assert_owns_exam_subject(db, actor, exam_subject)

    pub = await repository.get_publication(db, exam.id)
    if pub is None or pub.status != PublicationStatus.published:
        raise ValidationException("Insight summaries are only available after results are published")

    results = await repository.list_exam_results_for_subject(db, exam_subject.id)
    scored = [r for r, _s, _u in results if not r.is_absent and r.marks_obtained is not None]
    absentees = len(results) - len(scored)
    average = round(sum(float(r.marks_obtained) for r in scored) / len(scored), 2) if scored else None
    passed = sum(1 for r in scored if float(r.marks_obtained) >= exam_subject.pass_marks)
    pass_rate = round((passed / len(scored)) * 100, 2) if scored else None

    context = {
        "exam_name": exam.name,
        "class_name": class_entity.name,
        "subject_name": subject.name,
        "full_marks": exam_subject.full_marks,
        "pass_marks": exam_subject.pass_marks,
        "student_count": len(results),
        "absentee_count": absentees,
        "average_marks": average,
        "average_percentage": round((average / exam_subject.full_marks) * 100, 2) if average is not None else None,
        "pass_count": passed,
        "pass_rate_percent": pass_rate,
        "highest_marks": max((float(r.marks_obtained) for r in scored), default=None),
        "lowest_marks": min((float(r.marks_obtained) for r in scored), default=None),
    }
    data_scope = f"aggregated, published results for {subject.name} — {class_entity.name} in {exam.name} only"

    try:
        summary = await ai_service.generate_insight_summary(
            role=actor.role, scope="class", context=context, data_scope=data_scope
        )
    except ai_service.AIInsightUnavailable as exc:
        raise ValidationException(exc.message) from exc

    return {"summary": summary}


async def get_class_insight(db: AsyncSession, actor: CurrentUser, exam_id: uuid.UUID, class_id: uuid.UUID) -> dict:
    if actor.role not in ("admin", "principal"):
        raise PermissionDeniedException("You do not have access to this insight summary")

    exam = await exams_repository.get_exam(db, exam_id)
    if exam is None:
        raise NotFoundException("Exam not found")
    class_row = await academic_repository.get_class(db, class_id)
    if class_row is None:
        raise NotFoundException("Class not found")

    pub = await repository.get_publication(db, exam_id)
    if pub is None or pub.status != PublicationStatus.published:
        raise ValidationException("Insight summaries are only available after results are published")

    subjects = await exams_repository.list_exam_subjects_for_exam(db, exam_id)
    subjects = [row for row in subjects if row[0].class_id == class_id]
    if not subjects:
        raise NotFoundException("No configured subjects for this class in this exam")

    subject_breakdown = []
    for exam_subject, _exam, _class_entity, subject, _teacher, _teacher_user in subjects:
        results = await repository.list_exam_results_for_subject(db, exam_subject.id)
        scored = [r for r, _s, _u in results if not r.is_absent and r.marks_obtained is not None]
        average = round(sum(float(r.marks_obtained) for r in scored) / len(scored), 2) if scored else None
        passed = sum(1 for r in scored if float(r.marks_obtained) >= exam_subject.pass_marks)
        pass_rate = round((passed / len(scored)) * 100, 2) if scored else None
        subject_breakdown.append(
            {
                "subject_name": subject.name,
                "full_marks": exam_subject.full_marks,
                "average_marks": average,
                "pass_rate_percent": pass_rate,
            }
        )

    context = {"exam_name": exam.name, "class_name": class_row.name, "subject_breakdown": subject_breakdown}
    data_scope = f"aggregated, published results for {class_row.name} in {exam.name} only, across all subjects"

    try:
        summary = await ai_service.generate_insight_summary(
            role=actor.role, scope="class", context=context, data_scope=data_scope
        )
    except ai_service.AIInsightUnavailable as exc:
        raise ValidationException(exc.message) from exc

    return {"summary": summary}


async def _individual_insight(db: AsyncSession, *, actor: CurrentUser, student_id: uuid.UUID, exam_id: uuid.UUID) -> dict:
    exam = await exams_repository.get_exam(db, exam_id)
    if exam is None:
        raise NotFoundException("Exam not found")

    pub = await repository.get_publication(db, exam_id)
    if pub is None or pub.status != PublicationStatus.published:
        raise ValidationException("Insight summaries are only available after results are published")

    rows = await repository.list_published_results_for_student_exam(db, student_id=student_id, exam_id=exam_id)
    if not rows:
        raise NotFoundException("No published results found for this exam")

    context = {
        "exam_name": exam.name,
        "subjects": [
            {
                "subject_name": subject.name,
                "full_marks": exam_subject.full_marks,
                "pass_marks": exam_subject.pass_marks,
                "marks_obtained": float(result.marks_obtained) if result.marks_obtained is not None else None,
                "is_absent": result.is_absent,
            }
            for result, exam_subject, subject in rows
        ],
    }
    data_scope = f"this student's own published results for {exam.name} only"

    try:
        summary = await ai_service.generate_insight_summary(
            role=actor.role, scope="individual", context=context, data_scope=data_scope
        )
    except ai_service.AIInsightUnavailable as exc:
        raise ValidationException(exc.message) from exc

    return {"summary": summary}


async def get_my_individual_insight(db: AsyncSession, actor: CurrentUser, exam_id: uuid.UUID) -> dict:
    student, _user = await _resolve_own_student(db, actor)
    return await _individual_insight(db, actor=actor, student_id=student.id, exam_id=exam_id)


async def get_student_individual_insight(
    db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID, exam_id: uuid.UUID
) -> dict:
    await _assert_can_view_student(db, actor, student_id)
    return await _individual_insight(db, actor=actor, student_id=student_id, exam_id=exam_id)
