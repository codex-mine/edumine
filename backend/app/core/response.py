from typing import Any

from fastapi.responses import JSONResponse


def success_response(
    data: Any = None,
    message: str = "Success",
    meta: dict[str, Any] | None = None,
    status_code: int = 200,
) -> JSONResponse:
    """Build the standard success envelope: { success, message, data, meta }."""
    body: dict[str, Any] = {"success": True, "message": message, "data": data}
    if meta is not None:
        body["meta"] = meta
    return JSONResponse(status_code=status_code, content=body)


def error_response(
    message: str,
    code: str,
    status_code: int,
    details: list[dict[str, Any]] | None = None,
) -> JSONResponse:
    """Build the standard error envelope: { success, message, error: { code, details } }."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "error": {"code": code, "details": details or []},
        },
    )
