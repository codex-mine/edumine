from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# FastAPI's built-in /docs (Swagger UI) and /redoc pages load their JS/CSS from
# this CDN and rely on an inline bootstrap script — the API's own default
# `default-src 'none'` policy (correct for JSON endpoints) blocks all of that,
# which is why the docs page renders blank. These paths get a relaxed policy
# that still forbids framing/embedding elsewhere; every other response keeps
# the strict default.
_DOCS_PATHS = {"/docs", "/redoc"}
_DOCS_CSP = (
    "default-src 'none'; "
    "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
    "img-src 'self' data: fastapi.tiangolo.com; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'"
)


class SecureHeadersMiddleware(BaseHTTPMiddleware):
    """Attaches baseline security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        is_docs_page = request.url.path in _DOCS_PATHS or request.url.path.endswith("/openapi.json")
        response.headers["Content-Security-Policy"] = _DOCS_CSP if is_docs_page else "default-src 'none'; frame-ancestors 'none'"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response
