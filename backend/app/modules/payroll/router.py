import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission
from app.common.enums import PayrollStatus, PayslipStatus
from app.common.schemas import PaginationParams, pagination_meta
from app.core.response import success_response
from app.modules.payroll import service
from app.modules.payroll.schemas import (
    GeneratePayrollRunRequest,
    SetSalaryStructureRequest,
    UpdateSalaryStructureRequest,
)

router = APIRouter(prefix="/payroll", tags=["payroll"])


# --- Salary structures ------------------------------------------------------------


@router.post("/salary-structures", dependencies=[Depends(require_permission("payroll.manage"))])
async def create_salary_structure(
    payload: SetSalaryStructureRequest,
    current_user: CurrentUser = Depends(require_permission("payroll.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.create_salary_structure(db, current_user, payload)
    return success_response(data=data, message="Salary structure created", status_code=201)


@router.get("/salary-structures", dependencies=[Depends(require_permission("payroll.view"))])
async def list_salary_structures(
    teacher_id: uuid.UUID | None = Query(default=None),
    staff_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.list_salary_structures_for_employee(db, teacher_id=teacher_id, staff_id=staff_id)
    return success_response(data=data, message="Salary structure history retrieved")


@router.get("/salary-structures/current", dependencies=[Depends(require_permission("payroll.view"))])
async def get_current_salary_structure(
    teacher_id: uuid.UUID | None = Query(default=None),
    staff_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_current_salary_structure(db, teacher_id=teacher_id, staff_id=staff_id)
    return success_response(data=data, message="Current salary structure retrieved")


@router.patch("/salary-structures/{structure_id}", dependencies=[Depends(require_permission("payroll.manage"))])
async def update_salary_structure(
    structure_id: uuid.UUID,
    payload: UpdateSalaryStructureRequest,
    current_user: CurrentUser = Depends(require_permission("payroll.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.update_salary_structure(db, current_user, structure_id, payload)
    return success_response(data=data, message="Salary structure updated")


@router.delete("/salary-structures/{structure_id}", dependencies=[Depends(require_permission("payroll.manage"))])
async def delete_salary_structure(
    structure_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("payroll.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_salary_structure(db, current_user, structure_id)
    return success_response(data=None, message="Salary structure deleted")


# --- Employees ----------------------------------------------------------------------


@router.get("/employees", dependencies=[Depends(require_permission("payroll.view"))])
async def list_payroll_employees(db: AsyncSession = Depends(get_db_session)):
    data = await service.list_payroll_employees(db)
    return success_response(data=data, message="Payroll-eligible employees retrieved")


# --- Payroll runs -----------------------------------------------------------------


@router.post("/runs", dependencies=[Depends(require_permission("payroll.manage"))])
async def generate_payroll_run(
    payload: GeneratePayrollRunRequest,
    current_user: CurrentUser = Depends(require_permission("payroll.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.generate_payroll_run(db, current_user, payload)
    return success_response(data=data, message="Payroll run generated", status_code=201)


@router.get("/runs", dependencies=[Depends(require_permission("payroll.view"))])
async def list_payroll_runs(
    status: PayrollStatus | None = Query(default=None),
    period_year: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_payroll_runs(db, status=status, period_year=period_year, page=page, limit=limit)
    meta = pagination_meta(PaginationParams(page=page, limit=limit), total)
    return success_response(data=items, message="Payroll runs retrieved", meta=meta)


@router.get("/runs/{run_id}", dependencies=[Depends(require_permission("payroll.view"))])
async def get_payroll_run(run_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    data = await service.get_payroll_run_detail(db, run_id)
    return success_response(data=data, message="Payroll run retrieved")


# --- Payslips ------------------------------------------------------------------------


@router.get("/payslips", dependencies=[Depends(require_permission("payroll.view"))])
async def list_payslips(
    payroll_run_id: uuid.UUID | None = Query(default=None),
    teacher_id: uuid.UUID | None = Query(default=None),
    staff_id: uuid.UUID | None = Query(default=None),
    status: PayslipStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_payslips(
        db,
        payroll_run_id=payroll_run_id,
        teacher_id=teacher_id,
        staff_id=staff_id,
        status=status,
        page=page,
        limit=limit,
    )
    meta = pagination_meta(PaginationParams(page=page, limit=limit), total)
    return success_response(data=items, message="Payslips retrieved", meta=meta)


@router.get("/payslips/{payslip_id}", dependencies=[Depends(require_permission("payroll.view"))])
async def get_payslip(payslip_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    data = await service.get_payslip_detail(db, payslip_id)
    return success_response(data=data, message="Payslip retrieved")


@router.post("/payslips/{payslip_id}/mark-paid", dependencies=[Depends(require_permission("payroll.manage"))])
async def mark_payslip_paid(
    payslip_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("payroll.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.mark_payslip_paid(db, current_user, payslip_id)
    return success_response(data=data, message="Payslip marked as paid")
