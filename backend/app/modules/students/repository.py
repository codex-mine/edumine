import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import EnrollmentStatus, GenderType, StudentStatus
from app.modules.academic.models import Class, Section, StudentEnrollment
from app.modules.auth.models import Role, User
from app.modules.guardians.models import Guardian
from app.modules.students.models import Student, StudentGuardian


async def list_pending_students(db: AsyncSession) -> list[tuple[User, Student]]:
    result = await db.execute(
        select(User, Student)
        .join(Role, Role.id == User.role_id)
        .join(Student, Student.user_id == User.id)
        .where(
            Role.name == "student",
            User.is_active.is_(False),
            User.deleted_at.is_(None),
            Student.deleted_at.is_(None),
        )
        .order_by(User.created_at.asc())
    )
    return list(result.all())


async def get_pending_student_user(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User)
        .join(Role, Role.id == User.role_id)
        .where(
            User.id == user_id,
            Role.name == "student",
            User.is_active.is_(False),
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def activate_student(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(update(User).where(User.id == user_id).values(is_active=True))


async def create_student_user_active(
    db: AsyncSession,
    *,
    role_id: uuid.UUID,
    full_name: str,
    email: str | None,
    phone: str,
    password_hash: str,
    gender: GenderType | None,
    date_of_birth: date | None,
) -> User:
    user = User(
        role_id=role_id,
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=password_hash,
        gender=gender,
        date_of_birth=date_of_birth,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


async def create_student_profile_full(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    admission_number: str,
    admission_date: date,
    blood_group: str | None,
    address: str | None,
    emergency_contact: str | None,
) -> Student:
    student = Student(
        user_id=user_id,
        admission_number=admission_number,
        admission_date=admission_date,
        blood_group=blood_group,
        address=address,
        emergency_contact=emergency_contact,
    )
    db.add(student)
    await db.flush()
    return student


async def get_student_by_id(db: AsyncSession, student_id: uuid.UUID) -> tuple[Student, User] | None:
    result = await db.execute(
        select(Student, User)
        .join(User, User.id == Student.user_id)
        .where(Student.id == student_id, Student.deleted_at.is_(None))
    )
    return result.first()


async def get_student_by_id_any(db: AsyncSession, student_id: uuid.UUID) -> tuple[Student, User] | None:
    result = await db.execute(
        select(Student, User).join(User, User.id == Student.user_id).where(Student.id == student_id)
    )
    return result.first()


async def get_student_by_user_id(db: AsyncSession, user_id: uuid.UUID) -> tuple[Student, User] | None:
    result = await db.execute(
        select(Student, User)
        .join(User, User.id == Student.user_id)
        .where(Student.user_id == user_id, Student.deleted_at.is_(None))
    )
    return result.first()


StudentEnrollmentRow = tuple[Student, User, StudentEnrollment | None, Section | None, Class | None]


def _student_with_enrollment_select(*, academic_year_id: uuid.UUID | None):
    enrollment_on = and_(
        StudentEnrollment.student_id == Student.id,
        StudentEnrollment.academic_year_id == academic_year_id,
        StudentEnrollment.status == EnrollmentStatus.active,
    )
    return (
        select(Student, User, StudentEnrollment, Section, Class)
        .join(User, User.id == Student.user_id)
        .outerjoin(StudentEnrollment, enrollment_on)
        .outerjoin(Section, Section.id == StudentEnrollment.section_id)
        .outerjoin(Class, Class.id == Section.class_id)
    )


async def list_students(
    db: AsyncSession,
    *,
    search: str | None,
    status: StudentStatus | None,
    offset: int,
    limit: int,
    academic_year_id: uuid.UUID | None,
) -> tuple[list[StudentEnrollmentRow], int]:
    filters = [Student.deleted_at.is_(None), User.is_active.is_(True)]
    if status is not None:
        filters.append(Student.status == status)
    if search:
        pattern = f"%{search}%"
        filters.append(
            or_(User.full_name.ilike(pattern), User.email.ilike(pattern), Student.admission_number.ilike(pattern))
        )

    count_result = await db.execute(
        select(func.count()).select_from(Student).join(User, User.id == Student.user_id).where(*filters)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        _student_with_enrollment_select(academic_year_id=academic_year_id)
        .where(*filters)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total


async def get_active_enrollment_for_student(
    db: AsyncSession, student_id: uuid.UUID, academic_year_id: uuid.UUID | None
) -> tuple[StudentEnrollment, Section, Class] | None:
    if academic_year_id is None:
        return None
    result = await db.execute(
        select(StudentEnrollment, Section, Class)
        .join(Section, Section.id == StudentEnrollment.section_id)
        .join(Class, Class.id == Section.class_id)
        .where(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.academic_year_id == academic_year_id,
            StudentEnrollment.status == EnrollmentStatus.active,
        )
    )
    return result.first()


async def update_student_fields(db: AsyncSession, student: Student, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(student, key, value)
    await db.flush()


async def soft_delete_student(db: AsyncSession, student: Student, user: User) -> None:
    now = datetime.now(timezone.utc)
    student.deleted_at = now
    user.deleted_at = now
    user.is_active = False
    await db.flush()


async def hard_delete_student(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()


# --- Guardian linking (student_guardians) -----------------------------------
# StudentGuardian is defined alongside Student since it's the student-owned
# side of the relationship; guardians/service.py also calls into these
# functions so both directions share one source of truth for the junction table.


async def get_link(db: AsyncSession, student_id: uuid.UUID, guardian_id: uuid.UUID) -> StudentGuardian | None:
    result = await db.execute(
        select(StudentGuardian).where(
            StudentGuardian.student_id == student_id, StudentGuardian.guardian_id == guardian_id
        )
    )
    return result.scalar_one_or_none()


async def count_links_for_student(db: AsyncSession, student_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(StudentGuardian).where(StudentGuardian.student_id == student_id)
    )
    return result.scalar_one()


async def create_link(
    db: AsyncSession, *, student_id: uuid.UUID, guardian_id: uuid.UUID, relation: str, is_primary: bool
) -> StudentGuardian:
    link = StudentGuardian(student_id=student_id, guardian_id=guardian_id, relation=relation, is_primary=is_primary)
    db.add(link)
    await db.flush()
    return link


async def unset_other_primaries(db: AsyncSession, student_id: uuid.UUID, exclude_link_id: uuid.UUID) -> None:
    await db.execute(
        update(StudentGuardian)
        .where(StudentGuardian.student_id == student_id, StudentGuardian.id != exclude_link_id)
        .values(is_primary=False)
    )


async def update_link_fields(db: AsyncSession, link: StudentGuardian, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(link, key, value)
    await db.flush()


async def delete_link(db: AsyncSession, link: StudentGuardian) -> None:
    await db.delete(link)
    await db.flush()


async def list_guardians_for_student(
    db: AsyncSession, student_id: uuid.UUID
) -> list[tuple[StudentGuardian, Guardian, User]]:
    result = await db.execute(
        select(StudentGuardian, Guardian, User)
        .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
        .join(User, User.id == Guardian.user_id)
        .where(StudentGuardian.student_id == student_id, Guardian.deleted_at.is_(None))
        .order_by(StudentGuardian.is_primary.desc())
    )
    return list(result.all())


async def list_students_for_guardian(
    db: AsyncSession, guardian_id: uuid.UUID
) -> list[tuple[StudentGuardian, Student, User]]:
    result = await db.execute(
        select(StudentGuardian, Student, User)
        .join(Student, Student.id == StudentGuardian.student_id)
        .join(User, User.id == Student.user_id)
        .where(StudentGuardian.guardian_id == guardian_id, Student.deleted_at.is_(None))
        .order_by(StudentGuardian.is_primary.desc())
    )
    return list(result.all())
