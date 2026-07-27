import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import ApprovalStatus
from app.core.exceptions import ConflictException, NotFoundException
from app.modules.expenses import repository
from app.modules.expenses.models import ExpenseCategory
from app.modules.expenses.repository import ExpenseRow
from app.modules.expenses.schemas import (
    CreateExpenseCategoryRequest,
    CreateExpenseRequest,
    UpdateExpenseCategoryRequest,
)

# --- Expense categories --------------------------------------------------------------


def _category_response(entity: ExpenseCategory) -> dict:
    return {
        "id": str(entity.id),
        "name": entity.name,
        "created_at": entity.created_at.isoformat(),
    }


async def list_expense_categories(db: AsyncSession) -> list[dict]:
    entities = await repository.list_categories(db)
    return [_category_response(e) for e in entities]


async def create_expense_category(
    db: AsyncSession, actor: CurrentUser, payload: CreateExpenseCategoryRequest
) -> dict:
    existing = await repository.get_category_by_name(db, payload.name)
    if existing is not None:
        raise ConflictException(f"An expense category named '{payload.name}' already exists")

    entity = await repository.create_category(db, name=payload.name)
    await record_audit_log(
        db, actor_id=actor.id, action="create", entity_type="expense_category", entity_id=entity.id,
        new_value={"name": payload.name},
    )
    await db.commit()
    return _category_response(entity)


async def _get_category_or_404(db: AsyncSession, category_id: uuid.UUID) -> ExpenseCategory:
    entity = await repository.get_category(db, category_id)
    if entity is None:
        raise NotFoundException("Expense category not found")
    return entity


async def update_expense_category(
    db: AsyncSession, actor: CurrentUser, category_id: uuid.UUID, payload: UpdateExpenseCategoryRequest
) -> dict:
    entity = await _get_category_or_404(db, category_id)
    fields = payload.model_dump(exclude_unset=True)
    if "name" in fields:
        existing = await repository.get_category_by_name(db, fields["name"])
        if existing is not None and existing.id != entity.id:
            raise ConflictException(f"An expense category named '{fields['name']}' already exists")

    if fields:
        await repository.update_category_fields(db, entity, fields)
        await record_audit_log(
            db, actor_id=actor.id, action="update", entity_type="expense_category", entity_id=entity.id, new_value=fields
        )
        await db.commit()
    return _category_response(entity)


async def delete_expense_category(db: AsyncSession, actor: CurrentUser, category_id: uuid.UUID) -> None:
    entity = await _get_category_or_404(db, category_id)
    await repository.soft_delete_category(db, entity)
    await record_audit_log(db, actor_id=actor.id, action="delete", entity_type="expense_category", entity_id=entity.id)
    await db.commit()


# --- Expenses --------------------------------------------------------------------------


def _expense_response(row: ExpenseRow) -> dict:
    expense, category, requester_name, approver_name = row
    return {
        "id": str(expense.id),
        "category_id": str(expense.category_id),
        "category_name": category.name,
        "amount": float(expense.amount),
        "description": expense.description,
        "expense_date": expense.expense_date.isoformat(),
        "requested_by": str(expense.requested_by),
        "requested_by_name": requester_name,
        "status": expense.status,
        "approved_by": str(expense.approved_by) if expense.approved_by else None,
        "approved_by_name": approver_name,
        "approved_at": expense.approved_at.isoformat() if expense.approved_at else None,
        "is_finalized": expense.status == ApprovalStatus.approved,
        "created_at": expense.created_at.isoformat(),
    }


async def create_expense(db: AsyncSession, actor: CurrentUser, payload: CreateExpenseRequest) -> dict:
    category = await repository.get_category(db, payload.category_id)
    if category is None:
        raise NotFoundException("Expense category not found")

    entity = await repository.create_expense(
        db,
        category_id=payload.category_id,
        amount=payload.amount,
        description=payload.description,
        expense_date=payload.expense_date,
        requested_by=actor.id,
    )
    await record_audit_log(
        db, actor_id=actor.id, action="create", entity_type="expense", entity_id=entity.id,
        new_value={
            "category_id": str(payload.category_id),
            "amount": payload.amount,
            "expense_date": payload.expense_date.isoformat(),
        },
    )
    await db.commit()

    row = await repository.get_expense_row(db, entity.id)
    assert row is not None
    return _expense_response(row)


async def _get_expense_row_or_404(db: AsyncSession, expense_id: uuid.UUID) -> ExpenseRow:
    row = await repository.get_expense_row(db, expense_id)
    if row is None:
        raise NotFoundException("Expense not found")
    return row


async def get_expense_detail(db: AsyncSession, expense_id: uuid.UUID) -> dict:
    row = await _get_expense_row_or_404(db, expense_id)
    return _expense_response(row)


async def list_expenses(
    db: AsyncSession,
    *,
    status: ApprovalStatus | None,
    category_id: uuid.UUID | None,
    requested_by: uuid.UUID | None,
    page: int,
    limit: int,
) -> tuple[list[dict], int]:
    rows, total = await repository.list_expenses(
        db,
        status=status,
        category_id=category_id,
        requested_by=requested_by,
        offset=(page - 1) * limit,
        limit=limit,
    )
    return [_expense_response(row) for row in rows], total


async def _decide_expense(
    db: AsyncSession, actor: CurrentUser, expense_id: uuid.UUID, decision: ApprovalStatus
) -> dict:
    entity = await repository.get_expense(db, expense_id)
    if entity is None:
        raise NotFoundException("Expense not found")
    if entity.status != ApprovalStatus.pending:
        raise ConflictException(f"This expense has already been {entity.status.value}")

    decided_at = datetime.now(timezone.utc)
    await repository.update_expense_status(db, entity, status=decision, approved_by=actor.id, approved_at=decided_at)
    await record_audit_log(
        db, actor_id=actor.id, action=decision.value, entity_type="expense", entity_id=entity.id,
        new_value={"status": decision.value, "approved_by": str(actor.id), "approved_at": decided_at.isoformat()},
    )
    await db.commit()

    row = await repository.get_expense_row(db, entity.id)
    assert row is not None
    return _expense_response(row)


async def approve_expense(db: AsyncSession, actor: CurrentUser, expense_id: uuid.UUID) -> dict:
    return await _decide_expense(db, actor, expense_id, ApprovalStatus.approved)


async def reject_expense(db: AsyncSession, actor: CurrentUser, expense_id: uuid.UUID) -> dict:
    return await _decide_expense(db, actor, expense_id, ApprovalStatus.rejected)
