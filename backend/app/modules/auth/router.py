from fastapi import APIRouter, Cookie, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_current_user, get_db_session
from app.core.config import get_settings
from app.core.exceptions import AuthException
from app.core.rate_limiter import limiter
from app.core.response import success_response
from app.core.security import apply_auth_cookies, clear_auth_cookies
from app.modules.auth import service
from app.modules.auth.schemas import AuthenticatedUser, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _device_info(request: Request) -> str | None:
    user_agent = request.headers.get("user-agent")
    return user_agent[:255] if user_agent else None


def _to_authenticated_user(user_id, full_name: str, phone: str, email: str | None, role: str, permissions) -> dict:
    return AuthenticatedUser(
        id=str(user_id),
        full_name=full_name,
        role=role,
        email=email,
        phone=phone,
        permissions=sorted(permissions),
    ).model_dump()


@router.post("/login")
@limiter.limit(settings.login_rate_limit)
async def login(
    request: Request,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db_session),
):
    session = await service.login(db, payload.identifier, payload.password, _device_info(request))

    response = success_response(
        data=_to_authenticated_user(
            session.user.id, session.user.full_name, session.user.phone, session.user.email,
            session.role, session.permissions,
        ),
        message="Logged in successfully",
    )
    apply_auth_cookies(
        response,
        access_token=session.access_token,
        access_expires_at=session.access_expires_at,
        refresh_token=session.refresh_token,
        refresh_expires_at=session.refresh_expires_at,
        role=session.role,
    )
    return response


@router.post("/refresh")
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_token_cookie_name),
):
    if not refresh_token:
        raise AuthException("No active session to refresh")

    session = await service.refresh(db, refresh_token, _device_info(request))

    response = success_response(
        data=_to_authenticated_user(
            session.user.id, session.user.full_name, session.user.phone, session.user.email,
            session.role, session.permissions,
        ),
        message="Session refreshed",
    )
    apply_auth_cookies(
        response,
        access_token=session.access_token,
        access_expires_at=session.access_expires_at,
        refresh_token=session.refresh_token,
        refresh_expires_at=session.refresh_expires_at,
        role=session.role,
    )
    return response


@router.post("/logout")
async def logout(
    db: AsyncSession = Depends(get_db_session),
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_token_cookie_name),
):
    await service.logout(db, refresh_token)
    response = success_response(data=None, message="Logged out successfully")
    clear_auth_cookies(response)
    return response


@router.get("/me")
async def me(current_user: CurrentUser = Depends(get_current_user)):
    return success_response(
        data=_to_authenticated_user(
            current_user.id, current_user.full_name, current_user.phone, current_user.email,
            current_user.role, current_user.permissions,
        ),
        message="Current session",
    )
