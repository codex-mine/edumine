import uuid
from datetime import date, datetime, timezone

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import PasswordResetToken, Permission, RefreshToken, Role, RolePermission, User
from app.modules.students.models import Student


async def get_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
    result = await db.execute(
        select(User).where(
            or_(User.phone == identifier, User.email == identifier),
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_user_by_phone(db: AsyncSession, phone: str) -> User | None:
    result = await db.execute(select(User).where(User.phone == phone, User.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_role_by_name(db: AsyncSession, name: str) -> Role | None:
    result = await db.execute(select(Role).where(Role.name == name))
    return result.scalar_one_or_none()


async def create_student_user(
    db: AsyncSession,
    *,
    role_id: uuid.UUID,
    full_name: str,
    email: str,
    phone: str,
    password_hash: str,
    gender=None,
    date_of_birth: date | None = None,
) -> User:
    user = User(
        role_id=role_id,
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=password_hash,
        gender=gender,
        date_of_birth=date_of_birth,
        is_active=False,
    )
    db.add(user)
    await db.flush()
    return user


async def create_student_profile(db: AsyncSession, *, user_id: uuid.UUID, admission_number: str) -> Student:
    student = Student(
        user_id=user_id,
        admission_number=admission_number,
        admission_date=date.today(),
    )
    db.add(student)
    await db.flush()
    return student


async def create_password_reset_token(
    db: AsyncSession, *, user_id: uuid.UUID, token_hash: str, expires_at: datetime
) -> PasswordResetToken:
    token = PasswordResetToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    db.add(token)
    await db.flush()
    return token


async def get_valid_password_reset_token(db: AsyncSession, token_hash: str) -> PasswordResetToken | None:
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar_one_or_none()


async def mark_password_reset_token_used(db: AsyncSession, token: PasswordResetToken) -> None:
    token.used_at = datetime.now(timezone.utc)
    await db.flush()


async def update_user_password(db: AsyncSession, user_id: uuid.UUID, password_hash: str) -> None:
    await db.execute(update(User).where(User.id == user_id).values(password_hash=password_hash))


async def revoke_all_refresh_tokens_for_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.is_revoked.is_(False)).values(
            is_revoked=True
        )
    )


async def get_role_name(db: AsyncSession, role_id: uuid.UUID) -> str | None:
    result = await db.execute(select(Role.name).where(Role.id == role_id))
    return result.scalar_one_or_none()


async def get_role_permissions(db: AsyncSession, role_id: uuid.UUID) -> frozenset[str]:
    result = await db.execute(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role_id)
    )
    return frozenset(result.scalars().all())


async def touch_last_login(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(User).where(User.id == user_id).values(last_login_at=datetime.now(timezone.utc))
    )


async def create_refresh_token(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    token_hash: str,
    expires_at: datetime,
    device_info: str | None,
) -> RefreshToken:
    token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        device_info=device_info,
        expires_at=expires_at,
    )
    db.add(token)
    await db.flush()
    return token


async def get_valid_refresh_token(db: AsyncSession, token_hash: str) -> RefreshToken | None:
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.is_revoked.is_(False),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar_one_or_none()


async def revoke_refresh_token(db: AsyncSession, token: RefreshToken) -> None:
    token.is_revoked = True
    await db.flush()


async def revoke_refresh_token_by_hash(db: AsyncSession, token_hash: str) -> None:
    await db.execute(
        update(RefreshToken).where(RefreshToken.token_hash == token_hash).values(is_revoked=True)
    )
