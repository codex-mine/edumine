import uuid
from datetime import datetime, timezone

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import Permission, RefreshToken, Role, RolePermission, User


async def get_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
    result = await db.execute(
        select(User).where(
            or_(User.phone == identifier, User.email == identifier),
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


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
