import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.models import AuditLog
from app.modules.academic.models import Class, Subject
from app.modules.auth.models import Role, User
from app.modules.exams.models import Exam, ExamClass, ExamSubject, ExamSubjectSection
from app.modules.exams.schemas import ExamSubjectSectionInput
from app.modules.teachers.models import Teacher

ExamSubjectRow = tuple[ExamSubject, Exam, Class, Subject, Teacher, User]


# --- Exams ------------------------------------------------------------------


async def create_exam(
    db: AsyncSession,
    *,
    academic_year_id: uuid.UUID,
    name: str,
    term: str | None,
    start_date: date,
    end_date: date,
    created_by: uuid.UUID,
) -> Exam:
    entity = Exam(
        academic_year_id=academic_year_id,
        name=name,
        term=term,
        start_date=start_date,
        end_date=end_date,
        created_by=created_by,
    )
    db.add(entity)
    await db.flush()
    return entity


async def create_exam_classes(db: AsyncSession, *, exam_id: uuid.UUID, class_ids: list[uuid.UUID]) -> None:
    for class_id in class_ids:
        db.add(ExamClass(exam_id=exam_id, class_id=class_id))
    await db.flush()


async def get_exam(db: AsyncSession, exam_id: uuid.UUID) -> Exam | None:
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    return result.scalar_one_or_none()


async def list_exams(db: AsyncSession, *, academic_year_id: uuid.UUID | None) -> list[Exam]:
    filters = []
    if academic_year_id is not None:
        filters.append(Exam.academic_year_id == academic_year_id)
    result = await db.execute(select(Exam).where(*filters).order_by(Exam.start_date.desc()))
    return list(result.scalars().all())


async def list_exam_classes(db: AsyncSession, exam_id: uuid.UUID) -> list[Class]:
    result = await db.execute(
        select(Class).join(ExamClass, ExamClass.class_id == Class.id).where(ExamClass.exam_id == exam_id)
    )
    return list(result.scalars().all())


async def get_exam_class(db: AsyncSession, *, exam_id: uuid.UUID, class_id: uuid.UUID) -> ExamClass | None:
    result = await db.execute(
        select(ExamClass).where(ExamClass.exam_id == exam_id, ExamClass.class_id == class_id)
    )
    return result.scalar_one_or_none()


async def update_exam_fields(db: AsyncSession, entity: Exam, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


# --- Exam subjects ------------------------------------------------------------


def _exam_subject_select():
    return (
        select(ExamSubject, Exam, Class, Subject, Teacher, User)
        .join(Exam, Exam.id == ExamSubject.exam_id)
        .join(Class, Class.id == ExamSubject.class_id)
        .join(Subject, Subject.id == ExamSubject.subject_id)
        .join(Teacher, Teacher.id == ExamSubject.teacher_id)
        .join(User, User.id == Teacher.user_id)
    )


async def create_exam_subject(
    db: AsyncSession,
    *,
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    subject_id: uuid.UUID,
    teacher_id: uuid.UUID,
    full_marks: int,
    pass_marks: int,
    question_window_opens_at: datetime | None,
    question_deadline: datetime,
    marks_window_opens_at: datetime | None,
    marks_deadline: datetime,
) -> ExamSubject:
    entity = ExamSubject(
        exam_id=exam_id,
        class_id=class_id,
        subject_id=subject_id,
        teacher_id=teacher_id,
        full_marks=full_marks,
        pass_marks=pass_marks,
        question_window_opens_at=question_window_opens_at,
        question_deadline=question_deadline,
        marks_window_opens_at=marks_window_opens_at,
        marks_deadline=marks_deadline,
    )
    db.add(entity)
    await db.flush()
    return entity


async def replace_exam_subject_sections(
    db: AsyncSession, exam_subject_id: uuid.UUID, sections: list[ExamSubjectSectionInput]
) -> None:
    await db.execute(delete(ExamSubjectSection).where(ExamSubjectSection.exam_subject_id == exam_subject_id))
    for order, section in enumerate(sections):
        db.add(
            ExamSubjectSection(
                exam_subject_id=exam_subject_id,
                name=section.name,
                full_marks=section.full_marks,
                pass_marks=section.pass_marks,
                display_order=order,
            )
        )
    await db.flush()


async def list_exam_subject_sections(db: AsyncSession, exam_subject_id: uuid.UUID) -> list[ExamSubjectSection]:
    result = await db.execute(
        select(ExamSubjectSection)
        .where(ExamSubjectSection.exam_subject_id == exam_subject_id)
        .order_by(ExamSubjectSection.display_order.asc())
    )
    return list(result.scalars().all())


async def get_exam_subject(db: AsyncSession, exam_subject_id: uuid.UUID) -> ExamSubjectRow | None:
    result = await db.execute(_exam_subject_select().where(ExamSubject.id == exam_subject_id))
    return result.first()


async def get_exam_subject_by_exam_class_subject(
    db: AsyncSession, *, exam_id: uuid.UUID, class_id: uuid.UUID, subject_id: uuid.UUID
) -> ExamSubject | None:
    result = await db.execute(
        select(ExamSubject).where(
            ExamSubject.exam_id == exam_id,
            ExamSubject.class_id == class_id,
            ExamSubject.subject_id == subject_id,
        )
    )
    return result.scalar_one_or_none()


async def list_exam_subjects_for_exam(db: AsyncSession, exam_id: uuid.UUID) -> list[ExamSubjectRow]:
    result = await db.execute(
        _exam_subject_select().where(ExamSubject.exam_id == exam_id).order_by(Class.numeric_order, Subject.name)
    )
    return list(result.all())


async def list_exam_subjects_for_teacher(db: AsyncSession, teacher_id: uuid.UUID) -> list[ExamSubjectRow]:
    result = await db.execute(
        _exam_subject_select()
        .where(ExamSubject.teacher_id == teacher_id)
        .order_by(ExamSubject.question_deadline.asc())
    )
    return list(result.all())


async def update_exam_subject_fields(db: AsyncSession, entity: ExamSubject, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def count_unsubmitted_exam_subjects(db: AsyncSession, exam_id: uuid.UUID) -> int:
    result = await db.execute(
        select(ExamSubject.id).where(
            ExamSubject.exam_id == exam_id, ExamSubject.question_submitted_at.is_(None)
        )
    )
    return len(result.all())


# --- Extension requests (tracked via audit_logs; no dedicated table) --------

EXTENSION_REQUESTED_ACTION = "question_deadline_extension_requested"
EXTENSION_GRANTED_ACTION = "question_deadline_extended"


async def list_recent_extension_request_logs(db: AsyncSession, *, limit: int = 200) -> list[AuditLog]:
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.entity_type == "exam_subject", AuditLog.action == EXTENSION_REQUESTED_ACTION)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


# --- Notification recipients -------------------------------------------------


async def list_admin_principal_emails(db: AsyncSession) -> list[tuple[str, str]]:
    """Returns (full_name, email) pairs for Admin/Principal users with an email on file."""
    result = await db.execute(
        select(User.full_name, User.email)
        .join(Role, Role.id == User.role_id)
        .where(Role.name.in_(["admin", "principal"]), User.email.is_not(None), User.deleted_at.is_(None))
    )
    return [(name, email) for name, email in result.all() if email]
