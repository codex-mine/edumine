"""Password hashing, JWT access tokens, and opaque refresh tokens.

Access tokens are short-lived signed JWTs (stateless — carry `sub`/`role`).
Refresh tokens are opaque random strings; only their SHA-256 hash is persisted
(`refresh_tokens.token_hash`), so a leaked database row can never be replayed
as a usable token, and rotation is enforced by revoking the row on each use.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt
from starlette.responses import Response

from app.core.config import get_settings

settings = get_settings()

ACCESS_TOKEN_TYPE = "access"


class TokenError(Exception):
    """Raised for any invalid/expired/malformed token."""


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: uuid.UUID, role: str) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Access token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Invalid access token") from exc

    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise TokenError("Invalid token type")
    return payload


def generate_refresh_token() -> tuple[str, str, datetime]:
    """Returns (raw_token, sha256_hex_hash, expires_at)."""
    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_refresh_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return raw_token, token_hash, expires_at


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_password_reset_token() -> tuple[str, str, datetime]:
    """Returns (raw_token, sha256_hex_hash, expires_at). Reuses the generic
    SHA-256 hasher above — it isn't actually refresh-token-specific."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_refresh_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_token_expire_minutes)
    return raw_token, token_hash, expires_at


CookieAction = Literal["set", "clear"]


def cookie_kwargs(max_age_seconds: int, *, http_only: bool) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "httponly": http_only,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": "/",
        "max_age": max_age_seconds,
    }
    if settings.cookie_domain:
        kwargs["domain"] = settings.cookie_domain
    return kwargs


def _seconds_until(expires_at: datetime) -> int:
    return max(int((expires_at - datetime.now(timezone.utc)).total_seconds()), 0)


def apply_auth_cookies(
    response: Response,
    *,
    access_token: str,
    access_expires_at: datetime,
    refresh_token: str,
    refresh_expires_at: datetime,
    role: str,
) -> None:
    """Sets the httpOnly access/refresh cookies plus a non-sensitive, JS-readable
    `session_role` cookie the frontend uses for optimistic route gating (the actual
    authorization decision is always re-verified server-side via the access token)."""
    response.set_cookie(
        settings.access_token_cookie_name,
        access_token,
        **cookie_kwargs(_seconds_until(access_expires_at), http_only=True),
    )
    response.set_cookie(
        settings.refresh_token_cookie_name,
        refresh_token,
        **cookie_kwargs(_seconds_until(refresh_expires_at), http_only=True),
    )
    response.set_cookie(
        settings.session_cookie_name,
        role,
        **cookie_kwargs(_seconds_until(refresh_expires_at), http_only=False),
    )


def clear_auth_cookies(response: Response) -> None:
    for name in (
        settings.access_token_cookie_name,
        settings.refresh_token_cookie_name,
        settings.session_cookie_name,
    ):
        response.delete_cookie(name, path="/", domain=settings.cookie_domain)
