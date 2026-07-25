import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import EmploymentStatus, GenderType
from app.modules.auth.models import Role, User
from app.modules.users.models import Staff

STAFF_LIKE_ROLES = ("staff", "accountant", "receptionist")


async def create_user(
    db: AsyncSession,
    *,
    role_id: uuid.UUID,
    full_name: str,
    email: str,
    phone: str,
    password_hash: str,
    gender: GenderType | None,
    date_of_birth: date | None,
    is_active: bool = True,
) -> User:
    user = User(
        role_id=role_id,
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=password_hash,
        gender=gender,
        date_of_birth=date_of_birth,
        is_active=is_active,
    )
    db.add(user)
    await db.flush()
    return user


async def create_staff_profile(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    employee_code: str,
    department: str | None,
    designation: str | None,
    joining_date: date,
) -> Staff:
    staff = Staff(
        user_id=user_id,
        employee_code=employee_code,
        department=department,
        designation=designation,
        joining_date=joining_date,
    )
    db.add(staff)
    await db.flush()
    return staff


async def get_user_with_staff(db: AsyncSession, user_id: uuid.UUID) -> tuple[User, str, Staff | None] | None:
    result = await db.execute(
        select(User, Role.name)
        .join(Role, Role.id == User.role_id)
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    row = result.first()
    if row is None:
        return None
    user, role_name = row

    staff: Staff | None = None
    if role_name in STAFF_LIKE_ROLES:
        staff_result = await db.execute(
            select(Staff).where(Staff.user_id == user_id, Staff.deleted_at.is_(None))
        )
        staff = staff_result.scalar_one_or_none()

    return user, role_name, staff


async def list_user_accounts(
    db: AsyncSession,
    *,
    roles: list[str],
    search: str | None,
    offset: int,
    limit: int,
) -> tuple[list[tuple[User, str, Staff | None]], int]:
    base_filters = [Role.name.in_(roles), User.deleted_at.is_(None)]
    if search:
        pattern = f"%{search}%"
        base_filters.append(
            or_(User.full_name.ilike(pattern), User.email.ilike(pattern), User.phone.ilike(pattern))
        )

    count_result = await db.execute(
        select(func.count()).select_from(User).join(Role, Role.id == User.role_id).where(*base_filters)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(User, Role.name)
        .join(Role, Role.id == User.role_id)
        .where(*base_filters)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = result.all()

    user_ids = [user.id for user, role_name in rows if role_name in STAFF_LIKE_ROLES]
    staff_by_user: dict[uuid.UUID, Staff] = {}
    if user_ids:
        staff_result = await db.execute(
            select(Staff).where(Staff.user_id.in_(user_ids), Staff.deleted_at.is_(None))
        )
        staff_by_user = {staff.user_id: staff for staff in staff_result.scalars().all()}

    items = [(user, role_name, staff_by_user.get(user.id)) for user, role_name in rows]
    return items, total


async def update_user_fields(db: AsyncSession, user: User, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(user, key, value)
    await db.flush()


async def update_staff_fields(db: AsyncSession, staff: Staff, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(staff, key, value)
    await db.flush()


async def soft_delete_user(db: AsyncSession, user: User, staff: Staff | None) -> None:
    now = datetime.now(timezone.utc)
    user.deleted_at = now
    user.is_active = False
    if staff is not None:
        staff.deleted_at = now
    await db.flush()


async def hard_delete_user(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()


async def get_role_names_map(db: AsyncSession, names: list[str]) -> dict[str, uuid.UUID]:
    result = await db.execute(select(Role.id, Role.name).where(Role.name.in_(names)))
    return {name: role_id for role_id, name in result.all()}
