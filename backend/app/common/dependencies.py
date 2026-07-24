"""Shared FastAPI dependencies: DB session, current user resolution, RBAC guards."""

import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from fastapi import Cookie, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AuthException, PermissionDeniedException
from app.core.security import TokenError, decode_access_token
from app.db.session import get_db
from app.modules.auth.models import Permission, Role, RolePermission, User

settings = get_settings()

# Principal holds full system authority (requirements.md 3.1 / database.md role_permissions
# seed grants "__ALL__" to principal) — every guard below bypasses for this role.
PRINCIPAL_ROLE = "principal"


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID
    full_name: str
    phone: str
    email: str | None
    role: str
    permissions: frozenset[str]

    def has_permission(self, *codes: str) -> bool:
        if self.role == PRINCIPAL_ROLE:
            return True
        return any(code in self.permissions for code in codes)

    def has_role(self, *roles: str) -> bool:
        return self.role == PRINCIPAL_ROLE or self.role in roles


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db():
        yield session


async def get_current_user(
    db: AsyncSession = Depends(get_db_session),
    access_token: str | None = Cookie(default=None, alias=settings.access_token_cookie_name),
) -> CurrentUser:
    if not access_token:
        raise AuthException("Not authenticated")

    try:
        payload = decode_access_token(access_token)
    except TokenError as exc:
        raise AuthException(str(exc)) from exc

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise AuthException("Invalid access token") from exc

    result = await db.execute(
        select(User, Role.name)
        .join(Role, Role.id == User.role_id)
        .where(User.id == user_id)
    )
    row = result.first()
    if row is None:
        raise AuthException("User no longer exists")

    user, role_name = row
    if user.deleted_at is not None or not user.is_active:
        raise AuthException("Account is inactive")

    permissions_result = await db.execute(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == user.role_id)
    )
    permissions = frozenset(permissions_result.scalars().all())

    return CurrentUser(
        id=user.id,
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
        role=role_name,
        permissions=permissions,
    )


def require_permission(*codes: str):
    """Route dependency: allow only if the current user holds any of `codes` (or is Principal)."""

    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.has_permission(*codes):
            raise PermissionDeniedException("You do not have permission to perform this action")
        return current_user

    return _check


def require_role(*roles: str):
    """Route dependency: allow only if the current user's role is in `roles` (or is Principal)."""

    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.has_role(*roles):
            raise PermissionDeniedException("Your role does not have access to this resource")
        return current_user

    return _check
