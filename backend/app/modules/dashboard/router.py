"""Role-based dashboards & reporting (Phase 15).

Each `/dashboard/{role}` route aggregates only that role's authorized data —
scoping is enforced in dashboard/service.py, not just by which route was
called, so a Principal (who bypasses every `require_role` gate) still only
ever receives the payload the target role's aggregator function builds.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_role
from app.core.response import success_response
from app.modules.dashboard import service
from app.modules.dashboard.schemas import AtRiskStudentsRequest, AttendanceInsightRequest, GuardianAssistantRequest

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/principal", name="dashboard_principal")
async def get_principal_dashboard(
    current_user: CurrentUser = Depends(require_role("principal")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_principal_dashboard(db, current_user)
    return success_response(data=data, message="Principal dashboard loaded")


@router.get("/admin", name="dashboard_admin")
async def get_admin_dashboard(
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_admin_dashboard(db, current_user)
    return success_response(data=data, message="Admin dashboard loaded")


@router.get("/teacher", name="dashboard_teacher")
async def get_teacher_dashboard(
    current_user: CurrentUser = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_teacher_dashboard(db, current_user)
    return success_response(data=data, message="Teacher dashboard loaded")


@router.get("/accountant", name="dashboard_accountant")
async def get_accountant_dashboard(
    current_user: CurrentUser = Depends(require_role("accountant")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_billing_ops_dashboard(db, current_user)
    return success_response(data=data, message="Accountant dashboard loaded")


@router.get("/receptionist", name="dashboard_receptionist")
async def get_receptionist_dashboard(
    current_user: CurrentUser = Depends(require_role("receptionist")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_billing_ops_dashboard(db, current_user)
    return success_response(data=data, message="Receptionist dashboard loaded")


@router.get("/staff", name="dashboard_staff")
async def get_staff_dashboard(
    current_user: CurrentUser = Depends(require_role("staff")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_staff_dashboard(db, current_user)
    return success_response(data=data, message="Staff dashboard loaded")


@router.get("/student", name="dashboard_student")
async def get_student_dashboard(
    current_user: CurrentUser = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_student_dashboard(db, current_user)
    return success_response(data=data, message="Student dashboard loaded")


@router.get("/guardian", name="dashboard_guardian")
async def get_guardian_dashboard(
    current_user: CurrentUser = Depends(require_role("guardian")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_guardian_dashboard(db, current_user)
    return success_response(data=data, message="Guardian dashboard loaded")


# --- On-demand AI widgets (prompts.md §4.5, §4.7, §4.4) --------------------------


@router.post("/attendance-insight", name="dashboard_attendance_insight")
async def post_attendance_insight(
    payload: AttendanceInsightRequest,
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_attendance_pattern_insight(db, current_user, payload)
    return success_response(data=data, message="Attendance pattern insight generated")


@router.post("/at-risk-students", name="dashboard_at_risk_students")
async def post_at_risk_students(
    payload: AtRiskStudentsRequest,
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_at_risk_students(db, current_user, payload)
    return success_response(data=data, message="At-risk student worklist generated")


@router.post("/guardian-assistant", name="dashboard_guardian_assistant")
async def post_guardian_assistant(
    payload: GuardianAssistantRequest,
    current_user: CurrentUser = Depends(require_role("guardian")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.guardian_assistant(db, current_user, payload)
    return success_response(data=data, message="Guardian assistant responded")
