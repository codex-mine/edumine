import calendar
import uuid
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import PayrollStatus, PayslipStatus
from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.modules.auth.models import User
from app.modules.payroll import repository
from app.modules.payroll.models import PayrollRun, Payslip, SalaryStructure
from app.modules.payroll.schemas import (
    GeneratePayrollRunRequest,
    SetSalaryStructureRequest,
    UpdateSalaryStructureRequest,
)


def _today() -> date:
    return datetime.now(timezone.utc).date()


# --- Employee resolution helpers ----------------------------------------------------


async def _resolve_employee(
    db: AsyncSession, *, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None
) -> tuple[str, str, str, str]:
    """Returns (employee_type, full_name, employee_code, role_name)."""
    if teacher_id is not None:
        row = await repository.get_teacher_employee(db, teacher_id)
        if row is None:
            raise NotFoundException("Teacher not found")
        teacher, user = row
        return "teacher", user.full_name, teacher.employee_code, "teacher"

    row = await repository.get_staff_employee(db, staff_id)  # type: ignore[arg-type]
    if row is None:
        raise NotFoundException("Staff member not found")
    staff, user, role_name = row
    return "staff", user.full_name, staff.employee_code, role_name


# --- Salary structures ----------------------------------------------------------


def _salary_structure_response(entity: SalaryStructure, employee_type: str, name: str, code: str) -> dict:
    return {
        "id": str(entity.id),
        "teacher_id": str(entity.teacher_id) if entity.teacher_id else None,
        "staff_id": str(entity.staff_id) if entity.staff_id else None,
        "employee_type": employee_type,
        "employee_name": name,
        "employee_code": code,
        "basic_salary": float(entity.basic_salary),
        "allowances": float(entity.allowances),
        "deductions": float(entity.deductions),
        "gross_salary": round(float(entity.basic_salary) + float(entity.allowances), 2),
        "effective_from": entity.effective_from.isoformat(),
        "created_at": entity.created_at.isoformat(),
    }


async def create_salary_structure(db: AsyncSession, actor: CurrentUser, payload: SetSalaryStructureRequest) -> dict:
    employee_type, name, code, _role = await _resolve_employee(
        db, teacher_id=payload.teacher_id, staff_id=payload.staff_id
    )

    entity = await repository.create_salary_structure(
        db,
        teacher_id=payload.teacher_id,
        staff_id=payload.staff_id,
        basic_salary=payload.basic_salary,
        allowances=payload.allowances,
        deductions=payload.deductions,
        effective_from=payload.effective_from,
    )
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="create",
        entity_type="salary_structure",
        entity_id=entity.id,
        new_value={
            "teacher_id": str(payload.teacher_id) if payload.teacher_id else None,
            "staff_id": str(payload.staff_id) if payload.staff_id else None,
            "basic_salary": payload.basic_salary,
            "allowances": payload.allowances,
            "deductions": payload.deductions,
            "effective_from": payload.effective_from.isoformat(),
        },
    )
    await db.commit()
    return _salary_structure_response(entity, employee_type, name, code)


async def _get_salary_structure_or_404(db: AsyncSession, structure_id: uuid.UUID) -> SalaryStructure:
    entity = await repository.get_salary_structure(db, structure_id)
    if entity is None:
        raise NotFoundException("Salary structure not found")
    return entity


async def update_salary_structure(
    db: AsyncSession, actor: CurrentUser, structure_id: uuid.UUID, payload: UpdateSalaryStructureRequest
) -> dict:
    entity = await _get_salary_structure_or_404(db, structure_id)
    employee_type, name, code, _role = await _resolve_employee(
        db, teacher_id=entity.teacher_id, staff_id=entity.staff_id
    )

    fields = payload.model_dump(exclude_unset=True)
    if fields:
        await repository.update_salary_structure_fields(db, entity, fields)
        await record_audit_log(
            db, actor_id=actor.id, action="update", entity_type="salary_structure", entity_id=entity.id, new_value=fields
        )
        await db.commit()
    return _salary_structure_response(entity, employee_type, name, code)


async def delete_salary_structure(db: AsyncSession, actor: CurrentUser, structure_id: uuid.UUID) -> None:
    entity = await _get_salary_structure_or_404(db, structure_id)
    await repository.delete_salary_structure(db, entity)
    await record_audit_log(
        db, actor_id=actor.id, action="delete", entity_type="salary_structure", entity_id=structure_id
    )
    await db.commit()


async def _validate_employee_selector(teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None) -> None:
    if (teacher_id is None) == (staff_id is None):
        raise ValidationException("Provide exactly one of teacher_id or staff_id")


async def list_salary_structures_for_employee(
    db: AsyncSession, *, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None
) -> list[dict]:
    await _validate_employee_selector(teacher_id, staff_id)
    employee_type, name, code, _role = await _resolve_employee(db, teacher_id=teacher_id, staff_id=staff_id)
    entities = await repository.list_salary_structures_for_employee(db, teacher_id=teacher_id, staff_id=staff_id)
    return [_salary_structure_response(entity, employee_type, name, code) for entity in entities]


async def get_current_salary_structure(
    db: AsyncSession, *, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None
) -> dict | None:
    await _validate_employee_selector(teacher_id, staff_id)
    employee_type, name, code, _role = await _resolve_employee(db, teacher_id=teacher_id, staff_id=staff_id)
    entity = await repository.get_current_salary_structure(
        db, teacher_id=teacher_id, staff_id=staff_id, as_of=_today()
    )
    if entity is None:
        return None
    return _salary_structure_response(entity, employee_type, name, code)


# --- Employees --------------------------------------------------------------------


async def list_payroll_employees(db: AsyncSession) -> list[dict]:
    today = _today()
    items: list[dict] = []

    for teacher, user in await repository.list_active_teachers(db):
        structure = await repository.get_current_salary_structure(
            db, teacher_id=teacher.id, staff_id=None, as_of=today
        )
        current_salary = (
            _salary_structure_response(structure, "teacher", user.full_name, teacher.employee_code)
            if structure is not None
            else None
        )
        items.append(
            {
                "employee_type": "teacher",
                "teacher_id": str(teacher.id),
                "staff_id": None,
                "full_name": user.full_name,
                "employee_code": teacher.employee_code,
                "designation": teacher.designation,
                "role": "teacher",
                "status": teacher.status.value,
                "current_salary": current_salary,
            }
        )

    for staff, user, role_name in await repository.list_active_staff(db):
        structure = await repository.get_current_salary_structure(db, teacher_id=None, staff_id=staff.id, as_of=today)
        current_salary = (
            _salary_structure_response(structure, "staff", user.full_name, staff.employee_code)
            if structure is not None
            else None
        )
        items.append(
            {
                "employee_type": "staff",
                "teacher_id": None,
                "staff_id": str(staff.id),
                "full_name": user.full_name,
                "employee_code": staff.employee_code,
                "designation": staff.designation,
                "role": role_name,
                "status": staff.status.value,
                "current_salary": current_salary,
            }
        )

    items.sort(key=lambda item: item["full_name"])
    return items


# --- Payslip responses ---------------------------------------------------------------


async def _payslip_response(db: AsyncSession, payslip: Payslip) -> dict:
    employee_type, name, code, _role = await _resolve_employee(
        db, teacher_id=payslip.teacher_id, staff_id=payslip.staff_id
    )
    return {
        "id": str(payslip.id),
        "payroll_run_id": str(payslip.payroll_run_id),
        "teacher_id": str(payslip.teacher_id) if payslip.teacher_id else None,
        "staff_id": str(payslip.staff_id) if payslip.staff_id else None,
        "employee_type": employee_type,
        "employee_name": name,
        "employee_code": code,
        "gross_amount": float(payslip.gross_amount),
        "deductions": float(payslip.deductions),
        "net_amount": float(payslip.net_amount),
        "status": payslip.status,
        "paid_at": payslip.paid_at.isoformat() if payslip.paid_at else None,
        "created_at": payslip.created_at.isoformat(),
    }


# --- Payroll runs -----------------------------------------------------------------


async def _payroll_run_summary(db: AsyncSession, run: PayrollRun, generated_by_user, payslip_count: int, total_net: float) -> dict:
    return {
        "id": str(run.id),
        "period_month": run.period_month,
        "period_year": run.period_year,
        "status": run.status,
        "generated_by": str(run.generated_by),
        "generated_by_name": generated_by_user.full_name,
        "payslip_count": payslip_count,
        "total_net_amount": total_net,
        "created_at": run.created_at.isoformat(),
    }


async def generate_payroll_run(db: AsyncSession, actor: CurrentUser, payload: GeneratePayrollRunRequest) -> dict:
    existing = await repository.get_payroll_run_by_period(db, payload.period_month, payload.period_year)
    if existing is not None:
        raise ConflictException(
            f"A payroll run for {payload.period_month:02d}/{payload.period_year} already exists"
        )

    period_end = date(
        payload.period_year, payload.period_month, calendar.monthrange(payload.period_year, payload.period_month)[1]
    )

    teachers = await repository.list_active_teachers(db)
    staff_members = await repository.list_active_staff(db)

    run = await repository.create_payroll_run(
        db, period_month=payload.period_month, period_year=payload.period_year, generated_by=actor.id
    )

    skipped: list[dict] = []
    created_count = 0

    for teacher, user in teachers:
        structure = await repository.get_current_salary_structure(
            db, teacher_id=teacher.id, staff_id=None, as_of=period_end
        )
        if structure is None:
            skipped.append(
                {"employee_type": "teacher", "teacher_id": str(teacher.id), "staff_id": None, "full_name": user.full_name}
            )
            continue
        gross = round(float(structure.basic_salary) + float(structure.allowances), 2)
        deductions = round(float(structure.deductions), 2)
        net = round(gross - deductions, 2)
        await repository.create_payslip(
            db, payroll_run_id=run.id, teacher_id=teacher.id, staff_id=None,
            gross_amount=gross, deductions=deductions, net_amount=net,
        )
        created_count += 1

    for staff, user, _role_name in staff_members:
        structure = await repository.get_current_salary_structure(
            db, teacher_id=None, staff_id=staff.id, as_of=period_end
        )
        if structure is None:
            skipped.append(
                {"employee_type": "staff", "teacher_id": None, "staff_id": str(staff.id), "full_name": user.full_name}
            )
            continue
        gross = round(float(structure.basic_salary) + float(structure.allowances), 2)
        deductions = round(float(structure.deductions), 2)
        net = round(gross - deductions, 2)
        await repository.create_payslip(
            db, payroll_run_id=run.id, teacher_id=None, staff_id=staff.id,
            gross_amount=gross, deductions=deductions, net_amount=net,
        )
        created_count += 1

    if created_count == 0:
        await db.rollback()
        raise ValidationException(
            "No active teacher or staff member has a salary structure effective for this period — nothing to generate"
        )

    await repository.update_payroll_run_status(db, run, PayrollStatus.processed)
    await record_audit_log(
        db, actor_id=actor.id, action="generate_payroll_run", entity_type="payroll_run", entity_id=run.id,
        new_value={
            "period_month": payload.period_month,
            "period_year": payload.period_year,
            "payslip_count": created_count,
            "skipped_count": len(skipped),
        },
    )
    await db.commit()

    detail = await get_payroll_run_detail(db, run.id)
    detail["skipped"] = skipped
    return detail


async def _get_payroll_run_or_404(db: AsyncSession, run_id: uuid.UUID) -> tuple[PayrollRun, User]:
    row = await repository.get_payroll_run_with_generator(db, run_id)
    if row is None:
        raise NotFoundException("Payroll run not found")
    return row


async def get_payroll_run_detail(db: AsyncSession, run_id: uuid.UUID) -> dict:
    run, generated_by_user = await _get_payroll_run_or_404(db, run_id)
    payslips = await repository.list_payslips_for_run(db, run.id)
    total_net = round(sum(float(p.net_amount) for p in payslips), 2)

    summary = await _payroll_run_summary(db, run, generated_by_user, len(payslips), total_net)
    summary["payslips"] = [await _payslip_response(db, payslip) for payslip in payslips]
    return summary


async def list_payroll_runs(
    db: AsyncSession, *, status: PayrollStatus | None, period_year: int | None, page: int, limit: int
) -> tuple[list[dict], int]:
    rows, total = await repository.list_payroll_runs(
        db, status=status, period_year=period_year, offset=(page - 1) * limit, limit=limit
    )
    results = []
    for run, generated_by_user in rows:
        payslips = await repository.list_payslips_for_run(db, run.id)
        total_net = round(sum(float(p.net_amount) for p in payslips), 2)
        results.append(await _payroll_run_summary(db, run, generated_by_user, len(payslips), total_net))
    return results, total


# --- Payslips ------------------------------------------------------------------------


async def _get_payslip_or_404(db: AsyncSession, payslip_id: uuid.UUID) -> Payslip:
    entity = await repository.get_payslip(db, payslip_id)
    if entity is None:
        raise NotFoundException("Payslip not found")
    return entity


async def get_payslip_detail(db: AsyncSession, payslip_id: uuid.UUID) -> dict:
    payslip = await _get_payslip_or_404(db, payslip_id)
    return await _payslip_response(db, payslip)


async def list_payslips(
    db: AsyncSession,
    *,
    payroll_run_id: uuid.UUID | None,
    teacher_id: uuid.UUID | None,
    staff_id: uuid.UUID | None,
    status: PayslipStatus | None,
    page: int,
    limit: int,
) -> tuple[list[dict], int]:
    rows, total = await repository.list_payslips(
        db,
        payroll_run_id=payroll_run_id,
        teacher_id=teacher_id,
        staff_id=staff_id,
        status=status,
        offset=(page - 1) * limit,
        limit=limit,
    )
    return [await _payslip_response(db, payslip) for payslip in rows], total


async def mark_payslip_paid(db: AsyncSession, actor: CurrentUser, payslip_id: uuid.UUID) -> dict:
    payslip = await _get_payslip_or_404(db, payslip_id)
    if payslip.status == PayslipStatus.paid:
        raise ConflictException("This payslip is already marked as paid")

    paid_at = datetime.now(timezone.utc)
    await repository.update_payslip_status(db, payslip, PayslipStatus.paid, paid_at)
    await record_audit_log(
        db, actor_id=actor.id, action="mark_paid", entity_type="payslip", entity_id=payslip.id,
        new_value={"paid_at": paid_at.isoformat()},
    )

    remaining_unpaid = await repository.count_unpaid_payslips_for_run(db, payslip.payroll_run_id)
    if remaining_unpaid == 0:
        run = await repository.get_payroll_run(db, payslip.payroll_run_id)
        if run is not None:
            await repository.update_payroll_run_status(db, run, PayrollStatus.paid)

    await db.commit()
    return await _payslip_response(db, payslip)
