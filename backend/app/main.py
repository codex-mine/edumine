from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import SecureHeadersMiddleware
from app.core.rate_limiter import limiter
from app.core.response import error_response
from app.modules.auth.router import router as auth_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.health.router import router as health_router

settings = get_settings()

configure_logging()

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.state.limiter = limiter
register_exception_handlers(app)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc: RateLimitExceeded):
    return error_response(
        message="Too many requests, please try again later",
        code="RATE_LIMIT_EXCEEDED",
        status_code=429,
    )


app.add_middleware(SecureHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(dashboard_router)
