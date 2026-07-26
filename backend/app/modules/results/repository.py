import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import EnrollmentStatus, PublicationStatus
from app.modules.academic.models import Section, StudentEnrollment
from app.modules.auth.models import User
from app.modules.exams.models import Exam, ExamSubject
from app.modules.results.models import ExamResult, ResultPublication
from app.modules.students.models import Student
from app.modules.academic.models import Subject


# --- Enrolled students (per class, per academic year) ------------------------


async def list_students_in_class(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID
) -> list[tuple[Student, User, StudentEnrollment, Section]]:
    result = await db.execute(
        select(Student, User, StudentEnrollment, Section)
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .join(User, User.id == Student.user_id)
        .join(Section, Section.id == StudentEnrollment.section_id)
        .where(
            StudentEnrollment.academic_year_id == academic_year_id,
            Section.class_id == class_id,
            StudentEnrollment.status == EnrollmentStatus.active,
            Student.deleted_at.is_(None),
        )
        .order_by(Section.name.asc(), StudentEnrollment.roll_number.asc())
    )
    return list(result.all())


# --- Exam results (marks) -----------------------------------------------------


async def get_exam_result(
    db: AsyncSession, *, exam_subject_id: uuid.UUID, student_id: uuid.UUID
) -> ExamResult | None:
    result = await db.execute(
        select(ExamResult).where(
            ExamResult.exam_subject_id == exam_subject_id, ExamResult.student_id == student_id
        )
    )
    return result.scalar_one_or_none()


async def upsert_exam_result(
    db: AsyncSession,
    *,
    exam_subject_id: uuid.UUID,
    student_id: uuid.UUID,
    marks_obtained: float | None,
    is_absent: bool,
    entered_by: uuid.UUID,
) -> ExamResult:
    entity = await get_exam_result(db, exam_subject_id=exam_subject_id, student_id=student_id)
    if entity is None:
        entity = ExamResult(exam_subject_id=exam_subject_id, student_id=student_id)
        db.add(entity)
    entity.marks_obtained = marks_obtained
    entity.is_absent = is_absent
    entity.entered_by = entered_by
    entity.entered_at = datetime.now(timezone.utc)
    await db.flush()
    return entity


async def update_exam_result_fields(db: AsyncSession, entity: ExamResult, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def list_exam_results_for_subject(
    db: AsyncSession, exam_subject_id: uuid.UUID
) -> list[tuple[ExamResult, Student, User]]:
    result = await db.execute(
        select(ExamResult, Student, User)
        .join(Student, Student.id == ExamResult.student_id)
        .join(User, User.id == Student.user_id)
        .where(ExamResult.exam_subject_id == exam_subject_id)
    )
    return list(result.all())


async def count_exam_subjects(db: AsyncSession, exam_id: uuid.UUID) -> int:
    result = await db.execute(select(ExamSubject.id).where(ExamSubject.exam_id == exam_id))
    return len(result.all())


async def count_exam_subjects_marks_pending(db: AsyncSession, exam_id: uuid.UUID) -> int:
    result = await db.execute(
        select(ExamSubject.id).where(ExamSubject.exam_id == exam_id, ExamSubject.marks_submitted_at.is_(None))
    )
    return len(result.all())


# --- Result publications (approval/publish gate) ------------------------------


async def get_publication(db: AsyncSession, exam_id: uuid.UUID) -> ResultPublication | None:
    result = await db.execute(select(ResultPublication).where(ResultPublication.exam_id == exam_id))
    return result.scalar_one_or_none()


async def create_publication(
    db: AsyncSession, *, exam_id: uuid.UUID, submitted_by: uuid.UUID
) -> ResultPublication:
    entity = ResultPublication(exam_id=exam_id, status=PublicationStatus.pending, submitted_by=submitted_by)
    db.add(entity)
    await db.flush()
    return entity


async def update_publication_fields(db: AsyncSession, entity: ResultPublication, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def list_principal_queue(db: AsyncSession) -> list[tuple[Exam, ResultPublication]]:
    """Exams awaiting a Principal action: pending approval, or approved and awaiting publish."""
    result = await db.execute(
        select(Exam, ResultPublication)
        .join(ResultPublication, ResultPublication.exam_id == Exam.id)
        .where(ResultPublication.status.in_([PublicationStatus.pending, PublicationStatus.approved]))
        .order_by(ResultPublication.updated_at.asc())
    )
    return list(result.all())


# --- Published-results lookups (student/guardian-facing; gated by publish status) --


async def list_published_results_for_student_exam(
    db: AsyncSession, *, student_id: uuid.UUID, exam_id: uuid.UUID
) -> list[tuple[ExamResult, ExamSubject, Subject]]:
    result = await db.execute(
        select(ExamResult, ExamSubject, Subject)
        .join(ExamSubject, ExamSubject.id == ExamResult.exam_subject_id)
        .join(Subject, Subject.id == ExamSubject.subject_id)
        .join(ResultPublication, ResultPublication.exam_id == ExamSubject.exam_id)
        .where(
            ExamResult.student_id == student_id,
            ExamSubject.exam_id == exam_id,
            ResultPublication.status == PublicationStatus.published,
        )
        .order_by(Subject.name.asc())
    )
    return list(result.all())


async def list_published_results_for_student_year(
    db: AsyncSession, *, student_id: uuid.UUID, academic_year_id: uuid.UUID
) -> list[tuple[ExamResult, ExamSubject, Subject, Exam]]:
    result = await db.execute(
        select(ExamResult, ExamSubject, Subject, Exam)
        .join(ExamSubject, ExamSubject.id == ExamResult.exam_subject_id)
        .join(Subject, Subject.id == ExamSubject.subject_id)
        .join(Exam, Exam.id == ExamSubject.exam_id)
        .join(ResultPublication, ResultPublication.exam_id == Exam.id)
        .where(
            ExamResult.student_id == student_id,
            Exam.academic_year_id == academic_year_id,
            ResultPublication.status == PublicationStatus.published,
        )
        .order_by(Exam.start_date.asc(), Subject.name.asc())
    )
    return list(result.all())
