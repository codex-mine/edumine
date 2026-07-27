import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import EmploymentStatus, PayrollStatus, PayslipStatus
from app.modules.auth.models import Role, User
from app.modules.payroll.models import PayrollRun, Payslip, SalaryStructure
from app.modules.teachers.models import Teacher
from app.modules.users.models import Staff

# --- Salary structures ------------------------------------------------------------


async def create_salary_structure(
    db: AsyncSession,
    *,
    teacher_id: uuid.UUID | None,
    staff_id: uuid.UUID | None,
    basic_salary: float,
    allowances: float,
    deductions: float,
    effective_from: date,
) -> SalaryStructure:
    entity = SalaryStructure(
        teacher_id=teacher_id,
        staff_id=staff_id,
        basic_salary=basic_salary,
        allowances=allowances,
        deductions=deductions,
        effective_from=effective_from,
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_salary_structure(db: AsyncSession, structure_id: uuid.UUID) -> SalaryStructure | None:
    result = await db.execute(select(SalaryStructure).where(SalaryStructure.id == structure_id))
    return result.scalar_one_or_none()


async def list_salary_structures_for_employee(
    db: AsyncSession, *, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None
) -> list[SalaryStructure]:
    filters = [SalaryStructure.teacher_id == teacher_id] if teacher_id is not None else [SalaryStructure.staff_id == staff_id]
    result = await db.execute(
        select(SalaryStructure).where(*filters).order_by(SalaryStructure.effective_from.desc(), SalaryStructure.created_at.desc())
    )
    return list(result.scalars().all())


async def get_current_salary_structure(
    db: AsyncSession, *, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None, as_of: date
) -> SalaryStructure | None:
    filters = [SalaryStructure.effective_from <= as_of]
    filters.append(SalaryStructure.teacher_id == teacher_id if teacher_id is not None else SalaryStructure.staff_id == staff_id)
    result = await db.execute(
        select(SalaryStructure)
        .where(*filters)
        .order_by(SalaryStructure.effective_from.desc(), SalaryStructure.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def update_salary_structure_fields(db: AsyncSession, entity: SalaryStructure, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def delete_salary_structure(db: AsyncSession, entity: SalaryStructure) -> None:
    await db.delete(entity)
    await db.flush()


# --- Employees (teachers + staff) --------------------------------------------------


async def get_teacher_employee(db: AsyncSession, teacher_id: uuid.UUID) -> tuple[Teacher, User] | None:
    result = await db.execute(
        select(Teacher, User)
        .join(User, User.id == Teacher.user_id)
        .where(Teacher.id == teacher_id, Teacher.deleted_at.is_(None))
    )
    return result.first()


async def get_staff_employee(db: AsyncSession, staff_id: uuid.UUID) -> tuple[Staff, User, str] | None:
    result = await db.execute(
        select(Staff, User, Role.name)
        .join(User, User.id == Staff.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Staff.id == staff_id, Staff.deleted_at.is_(None))
    )
    return result.first()


async def list_active_teachers(db: AsyncSession) -> list[tuple[Teacher, User]]:
    result = await db.execute(
        select(Teacher, User)
        .join(User, User.id == Teacher.user_id)
        .where(Teacher.deleted_at.is_(None), Teacher.status == EmploymentStatus.active)
        .order_by(User.full_name.asc())
    )
    return list(result.all())


async def list_active_staff(db: AsyncSession) -> list[tuple[Staff, User, str]]:
    result = await db.execute(
        select(Staff, User, Role.name)
        .join(User, User.id == Staff.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Staff.deleted_at.is_(None), Staff.status == EmploymentStatus.active)
        .order_by(User.full_name.asc())
    )
    return list(result.all())


# --- Payroll runs -------------------------------------------------------------------


async def get_payroll_run_by_period(db: AsyncSession, period_month: int, period_year: int) -> PayrollRun | None:
    result = await db.execute(
        select(PayrollRun).where(PayrollRun.period_month == period_month, PayrollRun.period_year == period_year)
    )
    return result.scalar_one_or_none()


async def create_payroll_run(
    db: AsyncSession, *, period_month: int, period_year: int, generated_by: uuid.UUID
) -> PayrollRun:
    entity = PayrollRun(period_month=period_month, period_year=period_year, generated_by=generated_by)
    db.add(entity)
    await db.flush()
    return entity


async def get_payroll_run(db: AsyncSession, run_id: uuid.UUID) -> PayrollRun | None:
    result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
    return result.scalar_one_or_none()


async def get_payroll_run_with_generator(db: AsyncSession, run_id: uuid.UUID) -> tuple[PayrollRun, User] | None:
    result = await db.execute(
        select(PayrollRun, User).join(User, User.id == PayrollRun.generated_by).where(PayrollRun.id == run_id)
    )
    return result.first()


async def list_payroll_runs(
    db: AsyncSession, *, status: PayrollStatus | None, period_year: int | None, offset: int, limit: int
) -> tuple[list[tuple[PayrollRun, User]], int]:
    filters = []
    if status is not None:
        filters.append(PayrollRun.status == status)
    if period_year is not None:
        filters.append(PayrollRun.period_year == period_year)

    count_result = await db.execute(select(func.count()).select_from(PayrollRun).where(*filters))
    total = count_result.scalar_one()

    result = await db.execute(
        select(PayrollRun, User)
        .join(User, User.id == PayrollRun.generated_by)
        .where(*filters)
        .order_by(PayrollRun.period_year.desc(), PayrollRun.period_month.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total


async def update_payroll_run_status(db: AsyncSession, entity: PayrollRun, status: PayrollStatus) -> None:
    entity.status = status
    await db.flush()


# --- Payslips ------------------------------------------------------------------------


async def create_payslip(
    db: AsyncSession,
    *,
    payroll_run_id: uuid.UUID,
    teacher_id: uuid.UUID | None,
    staff_id: uuid.UUID | None,
    gross_amount: float,
    deductions: float,
    net_amount: float,
) -> Payslip:
    entity = Payslip(
        payroll_run_id=payroll_run_id,
        teacher_id=teacher_id,
        staff_id=staff_id,
        gross_amount=gross_amount,
        deductions=deductions,
        net_amount=net_amount,
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_payslip(db: AsyncSession, payslip_id: uuid.UUID) -> Payslip | None:
    result = await db.execute(select(Payslip).where(Payslip.id == payslip_id))
    return result.scalar_one_or_none()


async def list_payslips_for_run(db: AsyncSession, payroll_run_id: uuid.UUID) -> list[Payslip]:
    result = await db.execute(
        select(Payslip).where(Payslip.payroll_run_id == payroll_run_id).order_by(Payslip.created_at.asc())
    )
    return list(result.scalars().all())


async def count_unpaid_payslips_for_run(db: AsyncSession, payroll_run_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Payslip)
        .where(Payslip.payroll_run_id == payroll_run_id, Payslip.status != PayslipStatus.paid)
    )
    return result.scalar_one()


async def list_payslips(
    db: AsyncSession,
    *,
    payroll_run_id: uuid.UUID | None,
    teacher_id: uuid.UUID | None,
    staff_id: uuid.UUID | None,
    status: PayslipStatus | None,
    offset: int,
    limit: int,
) -> tuple[list[Payslip], int]:
    filters = []
    if payroll_run_id is not None:
        filters.append(Payslip.payroll_run_id == payroll_run_id)
    if teacher_id is not None:
        filters.append(Payslip.teacher_id == teacher_id)
    if staff_id is not None:
        filters.append(Payslip.staff_id == staff_id)
    if status is not None:
        filters.append(Payslip.status == status)

    count_result = await db.execute(select(func.count()).select_from(Payslip).where(*filters))
    total = count_result.scalar_one()

    result = await db.execute(
        select(Payslip).where(*filters).order_by(Payslip.created_at.desc()).offset(offset).limit(limit)
    )
    return list(result.scalars().all()), total


async def update_payslip_status(db: AsyncSession, entity: Payslip, status: PayslipStatus, paid_at: datetime | None) -> None:
    entity.status = status
    entity.paid_at = paid_at
    await db.flush()
