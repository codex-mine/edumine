import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import GenderType
from app.modules.auth.models import User
from app.modules.teachers.models import Teacher


async def create_teacher_user(
    db: AsyncSession,
    *,
    role_id: uuid.UUID,
    full_name: str,
    email: str,
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


async def create_teacher_profile(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    employee_code: str,
    joining_date: date,
    designation: str | None,
    qualification: str | None,
) -> Teacher:
    teacher = Teacher(
        user_id=user_id,
        employee_code=employee_code,
        joining_date=joining_date,
        designation=designation,
        qualification=qualification,
    )
    db.add(teacher)
    await db.flush()
    return teacher


async def get_teacher_by_id(db: AsyncSession, teacher_id: uuid.UUID) -> tuple[Teacher, User] | None:
    result = await db.execute(
        select(Teacher, User)
        .join(User, User.id == Teacher.user_id)
        .where(Teacher.id == teacher_id, Teacher.deleted_at.is_(None))
    )
    return result.first()


async def get_teacher_by_id_any(db: AsyncSession, teacher_id: uuid.UUID) -> tuple[Teacher, User] | None:
    """Includes soft-deleted rows — used for the hard-delete lookup path only."""
    result = await db.execute(
        select(Teacher, User).join(User, User.id == Teacher.user_id).where(Teacher.id == teacher_id)
    )
    return result.first()


async def get_teacher_by_user_id(db: AsyncSession, user_id: uuid.UUID) -> tuple[Teacher, User] | None:
    result = await db.execute(
        select(Teacher, User)
        .join(User, User.id == Teacher.user_id)
        .where(Teacher.user_id == user_id, Teacher.deleted_at.is_(None))
    )
    return result.first()


async def list_teachers(
    db: AsyncSession, *, search: str | None, offset: int, limit: int
) -> tuple[list[tuple[Teacher, User]], int]:
    filters = [Teacher.deleted_at.is_(None)]
    if search:
        pattern = f"%{search}%"
        filters.append(
            or_(User.full_name.ilike(pattern), User.email.ilike(pattern), Teacher.employee_code.ilike(pattern))
        )

    count_result = await db.execute(
        select(func.count()).select_from(Teacher).join(User, User.id == Teacher.user_id).where(*filters)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Teacher, User)
        .join(User, User.id == Teacher.user_id)
        .where(*filters)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total


async def update_teacher_fields(db: AsyncSession, teacher: Teacher, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(teacher, key, value)
    await db.flush()


async def soft_delete_teacher(db: AsyncSession, teacher: Teacher, user: User) -> None:
    now = datetime.now(timezone.utc)
    teacher.deleted_at = now
    user.deleted_at = now
    user.is_active = False
    await db.flush()


async def hard_delete_teacher(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()
