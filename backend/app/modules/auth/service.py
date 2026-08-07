import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.email import send_password_reset_email
from app.core.exceptions import AuthException, ConflictException, NotFoundException, ValidationException
from app.core.security import (
    create_access_token,
    generate_password_reset_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.modules.auth import repository
from app.modules.auth.models import User
from app.modules.auth.schemas import RegisterStudentRequest

settings = get_settings()

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


async def register_student(db: AsyncSession, payload: RegisterStudentRequest) -> None:
    if await repository.get_user_by_email(db, payload.email) is not None:
        raise ConflictException("An account with this email already exists")
    if await repository.get_user_by_phone(db, payload.phone) is not None:
        raise ConflictException("An account with this phone number already exists")

    role = await repository.get_role_by_name(db, "student")
    if role is None:
        raise AuthException("Student role is not configured")

    password_hash = hash_password(payload.password)
    user = await repository.create_student_user(
        db,
        role_id=role.id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=password_hash,
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
    )
    # Real admission numbering lands with Phase 4 (People & Identity Management);
    # this placeholder just satisfies the NOT NULL/unique constraint until an
    # admin reviews and finalizes the admission.
    admission_number = f"PENDING-{uuid.uuid4().hex[:8].upper()}"
    await repository.create_student_profile(db, user_id=user.id, admission_number=admission_number)
    await db.commit()


async def forgot_password(db: AsyncSession, email: str) -> None:
    """Always succeeds from the caller's perspective regardless of whether the
    email exists or the account is active — same enumeration-safety principle
    as INVALID_CREDENTIALS_MESSAGE above."""
    user = await repository.get_user_by_email(db, email)
    if user is None or not user.is_active or user.deleted_at is not None:
        return

    raw_token, token_hash, expires_at = generate_password_reset_token()
    await repository.create_password_reset_token(db, user_id=user.id, token_hash=token_hash, expires_at=expires_at)
    await db.commit()

    reset_link = f"{settings.frontend_url}/reset-password?token={raw_token}"
    await send_password_reset_email(user.email, user.full_name, reset_link)


async def reset_password(db: AsyncSession, raw_token: str, new_password: str) -> None:
    token_hash = hash_refresh_token(raw_token)
    token = await repository.get_valid_password_reset_token(db, token_hash)
    if token is None:
        raise NotFoundException("This reset link is invalid or has expired")

    await repository.update_user_password(db, token.user_id, hash_password(new_password))
    await repository.mark_password_reset_token_used(db, token)
    await repository.revoke_all_refresh_tokens_for_user(db, token.user_id)
    await db.commit()


async def change_password(
    db: AsyncSession, user_id: uuid.UUID, current_password: str, new_password: str
) -> None:
    user = await repository.get_user_by_id(db, user_id)
    if user is None:
        raise NotFoundException("Account not found")
    if not verify_password(current_password, user.password_hash):
        raise AuthException("Your current password is incorrect")
    if verify_password(new_password, user.password_hash):
        raise ValidationException("The new password must differ from your current one")

    await repository.update_user_password(db, user.id, hash_password(new_password))
    # Every existing session is invalidated, including the caller's — the client
    # signs out and logs back in, so a stolen refresh token cannot outlive the
    # password it was issued against.
    await repository.revoke_all_refresh_tokens_for_user(db, user.id)
    await db.commit()
