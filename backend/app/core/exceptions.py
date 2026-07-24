import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.response import error_response

logger = logging.getLogger("app")


class AppException(Exception):
    """Base class for all application exceptions mapped to the standard error envelope."""

    code = "APP_ERROR"
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str, details: list[dict[str, Any]] | None = None) -> None:
        self.message = message
        self.details = details or []
        super().__init__(message)


class NotFoundException(AppException):
    code = "NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND


class ValidationException(AppException):
    code = "VALIDATION_ERROR"
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY


class PermissionDeniedException(AppException):
    code = "PERMISSION_DENIED"
    status_code = status.HTTP_403_FORBIDDEN


class ConflictException(AppException):
    code = "CONFLICT"
    status_code = status.HTTP_409_CONFLICT


class AuthException(AppException):
    code = "AUTH_ERROR"
    status_code = status.HTTP_401_UNAUTHORIZED


class RateLimitException(AppException):
    code = "RATE_LIMIT_EXCEEDED"
    status_code = status.HTTP_429_TOO_MANY_REQUESTS


def _log_error(request: Request, code: str, message: str) -> None:
    logger.error(
        "request_error",
        extra={
            "path": request.url.path,
            "method": request.method,
            "code": code,
            "user_id": getattr(request.state, "user_id", None),
        },
    )
    logger.error(message)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        _log_error(request, exc.code, exc.message)
        return error_response(
            message=exc.message,
            code=exc.code,
            status_code=exc.status_code,
            details=exc.details,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in err["loc"] if p != "body"), "issue": err["msg"]}
            for err in exc.errors()
        ]
        _log_error(request, "VALIDATION_ERROR", "Validation failed")
        return error_response(
            message="Validation failed",
            code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        _log_error(request, "HTTP_ERROR", str(exc.detail))
        return error_response(
            message=str(exc.detail),
            code="HTTP_ERROR",
            status_code=exc.status_code,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        _log_error(request, "INTERNAL_SERVER_ERROR", repr(exc))
        return error_response(
            message="An unexpected error occurred",
            code="INTERNAL_SERVER_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
