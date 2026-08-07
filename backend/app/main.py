from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import SecureHeadersMiddleware
from app.core.rate_limiter import limiter
from app.core.response import error_response
from app.modules.academic.router import router as academic_router
from app.modules.assets.router import router as assets_router
from app.modules.attendance.router import router as attendance_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.communication.router import router as communication_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.exams.router import router as exams_router
from app.modules.expenses.router import router as expenses_router
from app.modules.guardians.router import router as guardians_router
from app.modules.health.router import router as health_router
from app.modules.omr.router import router as omr_router
from app.modules.payroll.router import router as payroll_router
from app.modules.results.router import router as results_router
from app.modules.routine.router import router as routine_router
from app.modules.students.router import router as students_router
from app.modules.teachers.router import router as teachers_router
from app.modules.uploads.router import router as uploads_router
from app.modules.users.router import router as users_router

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


if settings.storage_provider == "local":
    # Only the local provider has anything on disk to create or serve — with
    # cloudinary the files live behind its own CDN URLs, so this mount would
    # expose an empty directory. Guarding it also keeps the app importable on
    # serverless hosts, where the bundle is mounted read-only and this mkdir is
    # the first thing to fail.
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    app.mount(settings.upload_base_url, StaticFiles(directory=settings.upload_dir), name="uploads")

app.add_middleware(SecureHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix=settings.api_v1_prefix)
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(students_router)
api_router.include_router(teachers_router)
api_router.include_router(guardians_router)
api_router.include_router(users_router)
api_router.include_router(academic_router)
api_router.include_router(routine_router)
api_router.include_router(attendance_router)
api_router.include_router(exams_router)
api_router.include_router(results_router)
api_router.include_router(omr_router)
api_router.include_router(billing_router)
api_router.include_router(payroll_router)
api_router.include_router(expenses_router)
api_router.include_router(assets_router)
api_router.include_router(communication_router)
api_router.include_router(audit_router)
api_router.include_router(uploads_router)

app.include_router(api_router)
