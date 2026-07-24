from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthException
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    verify_password,
)
from app.modules.auth import repository
from app.modules.auth.models import User

# Deliberately generic on every failure branch (unknown identifier vs. wrong
# password) so the endpoint never reveals which accounts exist.
INVALID_CREDENTIALS_MESSAGE = "Invalid phone/email or password"


@dataclass(frozen=True)
class IssuedSession:
    user: User
    role: str
    permissions: frozenset[str]
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime


async def authenticate(db: AsyncSession, identifier: str, password: str) -> User:
    user = await repository.get_user_by_identifier(db, identifier)
    if user is None or not verify_password(password, user.password_hash):
        raise AuthException(INVALID_CREDENTIALS_MESSAGE)
    if not user.is_active:
        raise AuthException("This account has been disabled")
    return user


async def _issue_session(db: AsyncSession, user: User, device_info: str | None) -> IssuedSession:
    role = await repository.get_role_name(db, user.role_id)
    if role is None:
        raise AuthException("User has no assigned role")
    permissions = await repository.get_role_permissions(db, user.role_id)

    access_token, access_expires_at = create_access_token(user.id, role)
    raw_refresh_token, refresh_hash, refresh_expires_at = generate_refresh_token()
    await repository.create_refresh_token(
        db,
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=refresh_expires_at,
        device_info=device_info,
    )

    return IssuedSession(
        user=user,
        role=role,
        permissions=permissions,
        access_token=access_token,
        access_expires_at=access_expires_at,
        refresh_token=raw_refresh_token,
        refresh_expires_at=refresh_expires_at,
    )


async def login(db: AsyncSession, identifier: str, password: str, device_info: str | None) -> IssuedSession:
    user = await authenticate(db, identifier, password)
    session = await _issue_session(db, user, device_info)
    await repository.touch_last_login(db, user.id)
    await db.commit()
    return session


async def refresh(db: AsyncSession, raw_refresh_token: str, device_info: str | None) -> IssuedSession:
    token_hash = hash_refresh_token(raw_refresh_token)
    existing = await repository.get_valid_refresh_token(db, token_hash)
    if existing is None:
        raise AuthException("Session expired, please log in again")

    # Rotation: the presented token is single-use — revoke it before issuing the next one.
    await repository.revoke_refresh_token(db, existing)

    result = await db.get(User, existing.user_id)
    if result is None or result.deleted_at is not None or not result.is_active:
        raise AuthException("Account is no longer available")

    session = await _issue_session(db, result, device_info)
    await db.commit()
    return session


async def logout(db: AsyncSession, raw_refresh_token: str | None) -> None:
    if raw_refresh_token:
        await repository.revoke_refresh_token_by_hash(db, hash_refresh_token(raw_refresh_token))
        await db.commit()
