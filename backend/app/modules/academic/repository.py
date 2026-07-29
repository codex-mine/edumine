import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.common.enums import EnrollmentStatus
from app.modules.academic.models import (
    AcademicYear,
    Class,
    ClassSubject,
    Room,
    Section,
    StudentEnrollment,
    Subject,
)
from app.modules.auth.models import User
from app.modules.routine.models import RoutineSlot
from app.modules.students.models import Student
from app.modules.teachers.models import Teacher

TeacherAlias = aliased(Teacher)
TeacherUserAlias = aliased(User)


# --- Academic Years ------------------------------------------------------


async def create_academic_year(
    db: AsyncSession, *, name: str, start_date, end_date, cloned_from_year_id: uuid.UUID | None
) -> AcademicYear:
    year = AcademicYear(
        name=name, start_date=start_date, end_date=end_date, cloned_from_year_id=cloned_from_year_id
    )
    db.add(year)
    await db.flush()
    return year


async def get_academic_year_by_name(db: AsyncSession, name: str) -> AcademicYear | None:
    result = await db.execute(select(AcademicYear).where(AcademicYear.name == name))
    return result.scalar_one_or_none()


async def get_academic_year(db: AsyncSession, year_id: uuid.UUID) -> AcademicYear | None:
    result = await db.execute(select(AcademicYear).where(AcademicYear.id == year_id))
    return result.scalar_one_or_none()


async def get_active_academic_year(db: AsyncSession) -> AcademicYear | None:
    result = await db.execute(select(AcademicYear).where(AcademicYear.is_active.is_(True)))
    return result.scalar_one_or_none()


async def list_academic_years(db: AsyncSession) -> list[AcademicYear]:
    result = await db.execute(select(AcademicYear).order_by(AcademicYear.start_date.desc()))
    return list(result.scalars().all())


async def deactivate_all_academic_years(db: AsyncSession) -> None:
    await db.execute(update(AcademicYear).values(is_active=False))


async def set_academic_year_active(db: AsyncSession, year: AcademicYear) -> None:
    year.is_active = True
    await db.flush()


# --- Clone helpers --------------------------------------------------------


async def list_sections_for_year(db: AsyncSession, year_id: uuid.UUID) -> list[Section]:
    result = await db.execute(
        select(Section).where(Section.academic_year_id == year_id, Section.deleted_at.is_(None))
    )
    return list(result.scalars().all())


async def list_class_subjects_for_year(db: AsyncSession, year_id: uuid.UUID) -> list[ClassSubject]:
    result = await db.execute(select(ClassSubject).where(ClassSubject.academic_year_id == year_id))
    return list(result.scalars().all())


async def list_routine_slots_for_year(db: AsyncSession, year_id: uuid.UUID) -> list[RoutineSlot]:
    result = await db.execute(select(RoutineSlot).where(RoutineSlot.academic_year_id == year_id))
    return list(result.scalars().all())


# --- Classes ---------------------------------------------------------------


async def get_class_by_name(db: AsyncSession, name: str) -> Class | None:
    result = await db.execute(select(Class).where(Class.name == name, Class.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_class(db: AsyncSession, class_id: uuid.UUID) -> Class | None:
    result = await db.execute(
        select(Class).where(Class.id == class_id, Class.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_class(db: AsyncSession, *, name: str, numeric_order: int) -> Class:
    entity = Class(name=name, numeric_order=numeric_order)
    db.add(entity)
    await db.flush()
    return entity


async def list_classes(db: AsyncSession, *, search: str | None) -> list[Class]:
    filters = [Class.deleted_at.is_(None)]
    if search:
        filters.append(Class.name.ilike(f"%{search}%"))
    result = await db.execute(select(Class).where(*filters).order_by(Class.numeric_order.asc()))
    return list(result.scalars().all())


async def update_class_fields(db: AsyncSession, entity: Class, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def soft_delete_class(db: AsyncSession, entity: Class) -> None:
    entity.deleted_at = datetime.now(timezone.utc)
    await db.flush()


async def count_sections_for_class(db: AsyncSession, class_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(Section).where(Section.class_id == class_id, Section.deleted_at.is_(None))
    )
    return result.scalar_one()


async def count_class_subjects_for_class(db: AsyncSession, class_id: uuid.UUID) -> int:
    result = await db.execute(select(func.count()).select_from(ClassSubject).where(ClassSubject.class_id == class_id))
    return result.scalar_one()


# --- Rooms -----------------------------------------------------------------


async def get_room_by_name(db: AsyncSession, name: str) -> Room | None:
    result = await db.execute(select(Room).where(Room.name == name, Room.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_room(db: AsyncSession, room_id: uuid.UUID) -> Room | None:
    result = await db.execute(select(Room).where(Room.id == room_id, Room.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def create_room(db: AsyncSession, *, name: str, capacity: int | None) -> Room:
    entity = Room(name=name, capacity=capacity)
    db.add(entity)
    await db.flush()
    return entity


async def list_rooms(db: AsyncSession, *, search: str | None) -> list[Room]:
    filters = [Room.deleted_at.is_(None)]
    if search:
        filters.append(Room.name.ilike(f"%{search}%"))
    result = await db.execute(select(Room).where(*filters).order_by(Room.name.asc()))
    return list(result.scalars().all())


async def update_room_fields(db: AsyncSession, entity: Room, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def soft_delete_room(db: AsyncSession, entity: Room) -> None:
    entity.deleted_at = datetime.now(timezone.utc)
    await db.flush()


# --- Subjects ---------------------------------------------------------------


async def get_subject_by_name(db: AsyncSession, name: str) -> Subject | None:
    result = await db.execute(select(Subject).where(Subject.name == name, Subject.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_subject_by_code(db: AsyncSession, code: str) -> Subject | None:
    result = await db.execute(select(Subject).where(Subject.code == code, Subject.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_subject(db: AsyncSession, subject_id: uuid.UUID) -> Subject | None:
    result = await db.execute(select(Subject).where(Subject.id == subject_id, Subject.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def create_subject(db: AsyncSession, *, name: str, code: str) -> Subject:
    entity = Subject(name=name, code=code)
    db.add(entity)
    await db.flush()
    return entity


async def list_subjects(db: AsyncSession, *, search: str | None) -> list[Subject]:
    filters = [Subject.deleted_at.is_(None)]
    if search:
        pattern = f"%{search}%"
        filters.append(or_(Subject.name.ilike(pattern), Subject.code.ilike(pattern)))
    result = await db.execute(select(Subject).where(*filters).order_by(Subject.name.asc()))
    return list(result.scalars().all())


async def update_subject_fields(db: AsyncSession, entity: Subject, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def soft_delete_subject(db: AsyncSession, entity: Subject) -> None:
    entity.deleted_at = datetime.now(timezone.utc)
    await db.flush()


async def count_class_subjects_for_subject(db: AsyncSession, subject_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(ClassSubject).where(ClassSubject.subject_id == subject_id)
    )
    return result.scalar_one()


# --- Sections ----------------------------------------------------------------

SectionRow = tuple[Section, Class, Room | None, Teacher | None, User | None]


def _section_select():
    return (
        select(Section, Class, Room, TeacherAlias, TeacherUserAlias)
        .join(Class, Class.id == Section.class_id)
        .outerjoin(Room, Room.id == Section.room_id)
        .outerjoin(TeacherAlias, TeacherAlias.id == Section.class_teacher_id)
        .outerjoin(TeacherUserAlias, TeacherUserAlias.id == TeacherAlias.user_id)
    )


async def get_section_by_year_class_name(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID, name: str
) -> Section | None:
    result = await db.execute(
        select(Section).where(
            Section.academic_year_id == academic_year_id,
            Section.class_id == class_id,
            Section.name == name,
            Section.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_section(db: AsyncSession, section_id: uuid.UUID) -> SectionRow | None:
    result = await db.execute(_section_select().where(Section.id == section_id, Section.deleted_at.is_(None)))
    return result.first()


async def create_section(
    db: AsyncSession,
    *,
    academic_year_id: uuid.UUID,
    class_id: uuid.UUID,
    room_id: uuid.UUID | None,
    name: str,
    capacity: int | None,
    class_teacher_id: uuid.UUID | None,
) -> Section:
    entity = Section(
        academic_year_id=academic_year_id,
        class_id=class_id,
        room_id=room_id,
        name=name,
        capacity=capacity,
        class_teacher_id=class_teacher_id,
    )
    db.add(entity)
    await db.flush()
    return entity


async def list_sections(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID | None
) -> list[SectionRow]:
    filters = [Section.academic_year_id == academic_year_id, Section.deleted_at.is_(None)]
    if class_id is not None:
        filters.append(Section.class_id == class_id)
    result = await db.execute(_section_select().where(*filters).order_by(Class.numeric_order.asc(), Section.name.asc()))
    return list(result.all())


async def update_section_fields(db: AsyncSession, entity: Section, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def soft_delete_section(db: AsyncSession, entity: Section) -> None:
    entity.deleted_at = datetime.now(timezone.utc)
    await db.flush()


async def count_active_enrollments_for_section(db: AsyncSession, section_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(StudentEnrollment)
        .where(StudentEnrollment.section_id == section_id, StudentEnrollment.status == EnrollmentStatus.active)
    )
    return result.scalar_one()


# --- Class-Subjects (class-subject-teacher assignment) -----------------------

ClassSubjectRow = tuple[ClassSubject, Class, Subject, Teacher | None, User | None]


def _class_subject_select():
    return (
        select(ClassSubject, Class, Subject, TeacherAlias, TeacherUserAlias)
        .join(Class, Class.id == ClassSubject.class_id)
        .join(Subject, Subject.id == ClassSubject.subject_id)
        .outerjoin(TeacherAlias, TeacherAlias.id == ClassSubject.teacher_id)
        .outerjoin(TeacherUserAlias, TeacherUserAlias.id == TeacherAlias.user_id)
    )


async def get_class_subject_by_year_class_subject(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID, subject_id: uuid.UUID
) -> ClassSubject | None:
    result = await db.execute(
        select(ClassSubject).where(
            ClassSubject.academic_year_id == academic_year_id,
            ClassSubject.class_id == class_id,
            ClassSubject.subject_id == subject_id,
        )
    )
    return result.scalar_one_or_none()


async def get_class_subject(db: AsyncSession, class_subject_id: uuid.UUID) -> ClassSubjectRow | None:
    result = await db.execute(_class_subject_select().where(ClassSubject.id == class_subject_id))
    return result.first()


async def create_class_subject(
    db: AsyncSession,
    *,
    academic_year_id: uuid.UUID,
    class_id: uuid.UUID,
    subject_id: uuid.UUID,
    teacher_id: uuid.UUID | None,
    full_marks: int,
) -> ClassSubject:
    entity = ClassSubject(
        academic_year_id=academic_year_id,
        class_id=class_id,
        subject_id=subject_id,
        teacher_id=teacher_id,
        full_marks=full_marks,
    )
    db.add(entity)
    await db.flush()
    return entity


async def list_class_subjects(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID | None
) -> list[ClassSubjectRow]:
    filters = [ClassSubject.academic_year_id == academic_year_id]
    if class_id is not None:
        filters.append(ClassSubject.class_id == class_id)
    result = await db.execute(
        _class_subject_select().where(*filters).order_by(Class.numeric_order.asc(), Subject.name.asc())
    )
    return list(result.all())


async def update_class_subject_fields(db: AsyncSession, entity: ClassSubject, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def delete_class_subject(db: AsyncSession, entity: ClassSubject) -> None:
    await db.delete(entity)
    await db.flush()


# --- Student Enrollments ------------------------------------------------------

EnrollmentRow = tuple[StudentEnrollment, Student, User, AcademicYear, Section, Class]


def _enrollment_select():
    return (
        select(StudentEnrollment, Student, User, AcademicYear, Section, Class)
        .join(Student, Student.id == StudentEnrollment.student_id)
        .join(User, User.id == Student.user_id)
        .join(AcademicYear, AcademicYear.id == StudentEnrollment.academic_year_id)
        .join(Section, Section.id == StudentEnrollment.section_id)
        .join(Class, Class.id == Section.class_id)
    )


async def get_enrollment(db: AsyncSession, enrollment_id: uuid.UUID) -> EnrollmentRow | None:
    result = await db.execute(_enrollment_select().where(StudentEnrollment.id == enrollment_id))
    return result.first()


async def get_enrollment_for_student_year(
    db: AsyncSession, *, student_id: uuid.UUID, academic_year_id: uuid.UUID
) -> StudentEnrollment | None:
    result = await db.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.academic_year_id == academic_year_id,
        )
    )
    return result.scalar_one_or_none()


async def get_enrollment_by_section_roll(
    db: AsyncSession, *, section_id: uuid.UUID, roll_number: str
) -> StudentEnrollment | None:
    result = await db.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.section_id == section_id, StudentEnrollment.roll_number == roll_number
        )
    )
    return result.scalar_one_or_none()


async def create_enrollment(
    db: AsyncSession,
    *,
    student_id: uuid.UUID,
    academic_year_id: uuid.UUID,
    section_id: uuid.UUID,
    roll_number: str,
    status: EnrollmentStatus = EnrollmentStatus.active,
) -> StudentEnrollment:
    entity = StudentEnrollment(
        student_id=student_id,
        academic_year_id=academic_year_id,
        section_id=section_id,
        roll_number=roll_number,
        status=status,
    )
    db.add(entity)
    await db.flush()
    return entity


async def list_enrollments(
    db: AsyncSession,
    *,
    academic_year_id: uuid.UUID | None,
    section_id: uuid.UUID | None,
    student_id: uuid.UUID | None,
) -> list[EnrollmentRow]:
    filters = []
    if academic_year_id is not None:
        filters.append(StudentEnrollment.academic_year_id == academic_year_id)
    if section_id is not None:
        filters.append(StudentEnrollment.section_id == section_id)
    if student_id is not None:
        filters.append(StudentEnrollment.student_id == student_id)
    result = await db.execute(
        _enrollment_select().where(*filters).order_by(StudentEnrollment.roll_number.asc())
    )
    return list(result.all())


async def update_enrollment_fields(db: AsyncSession, entity: StudentEnrollment, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def count_active_enrollments_by_section(
    db: AsyncSession, section_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not section_ids:
        return {}
    result = await db.execute(
        select(StudentEnrollment.section_id, func.count())
        .where(
            StudentEnrollment.section_id.in_(section_ids),
            StudentEnrollment.status == EnrollmentStatus.active,
        )
        .group_by(StudentEnrollment.section_id)
    )
    return {row[0]: row[1] for row in result.all()}


async def get_max_roll_number_in_section(db: AsyncSession, section_id: uuid.UUID) -> int:
    result = await db.execute(
        select(StudentEnrollment.roll_number).where(StudentEnrollment.section_id == section_id)
    )
    max_roll = 0
    for (roll,) in result.all():
        if roll and roll.isdigit():
            max_roll = max(max_roll, int(roll))
    return max_roll
