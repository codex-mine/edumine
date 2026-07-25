import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import GenderType
from app.modules.auth.models import User
from app.modules.guardians.models import Guardian


async def create_guardian_user(
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


async def create_guardian_profile(
    db: AsyncSession, *, user_id: uuid.UUID, occupation: str | None, address: str | None
) -> Guardian:
    guardian = Guardian(user_id=user_id, occupation=occupation, address=address)
    db.add(guardian)
    await db.flush()
    return guardian


async def get_guardian_by_id(db: AsyncSession, guardian_id: uuid.UUID) -> tuple[Guardian, User] | None:
    result = await db.execute(
        select(Guardian, User)
        .join(User, User.id == Guardian.user_id)
        .where(Guardian.id == guardian_id, Guardian.deleted_at.is_(None))
    )
    return result.first()


async def get_guardian_by_id_any(db: AsyncSession, guardian_id: uuid.UUID) -> tuple[Guardian, User] | None:
    result = await db.execute(
        select(Guardian, User).join(User, User.id == Guardian.user_id).where(Guardian.id == guardian_id)
    )
    return result.first()


async def get_guardian_by_user_id(db: AsyncSession, user_id: uuid.UUID) -> tuple[Guardian, User] | None:
    result = await db.execute(
        select(Guardian, User)
        .join(User, User.id == Guardian.user_id)
        .where(Guardian.user_id == user_id, Guardian.deleted_at.is_(None))
    )
    return result.first()


async def list_guardians(
    db: AsyncSession, *, search: str | None, offset: int, limit: int
) -> tuple[list[tuple[Guardian, User]], int]:
    filters = [Guardian.deleted_at.is_(None)]
    if search:
        pattern = f"%{search}%"
        filters.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern), User.phone.ilike(pattern)))

    count_result = await db.execute(
        select(func.count()).select_from(Guardian).join(User, User.id == Guardian.user_id).where(*filters)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Guardian, User)
        .join(User, User.id == Guardian.user_id)
        .where(*filters)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total


async def update_guardian_fields(db: AsyncSession, guardian: Guardian, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(guardian, key, value)
    await db.flush()


async def soft_delete_guardian(db: AsyncSession, guardian: Guardian, user: User) -> None:
    now = datetime.now(timezone.utc)
    guardian.deleted_at = now
    user.deleted_at = now
    user.is_active = False
    await db.flush()


async def hard_delete_guardian(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()
