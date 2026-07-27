import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.common.enums import ApprovalStatus
from app.modules.auth.models import User
from app.modules.expenses.models import Expense, ExpenseCategory

# --- Expense categories --------------------------------------------------------------


async def get_category_by_name(db: AsyncSession, name: str) -> ExpenseCategory | None:
    result = await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.name == name, ExpenseCategory.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_category(db: AsyncSession, category_id: uuid.UUID) -> ExpenseCategory | None:
    result = await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.id == category_id, ExpenseCategory.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_category(db: AsyncSession, *, name: str) -> ExpenseCategory:
    entity = ExpenseCategory(name=name)
    db.add(entity)
    await db.flush()
    return entity


async def list_categories(db: AsyncSession) -> list[ExpenseCategory]:
    result = await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.deleted_at.is_(None)).order_by(ExpenseCategory.name.asc())
    )
    return list(result.scalars().all())


async def update_category_fields(db: AsyncSession, entity: ExpenseCategory, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def soft_delete_category(db: AsyncSession, entity: ExpenseCategory) -> None:
    entity.deleted_at = func.now()
    await db.flush()


# --- Expenses --------------------------------------------------------------------------

Requester = aliased(User, name="requester")
Approver = aliased(User, name="approver")

ExpenseRow = tuple[Expense, ExpenseCategory, str, str | None]


def _expense_select():
    return (
        select(Expense, ExpenseCategory, Requester.full_name, Approver.full_name)
        .join(ExpenseCategory, ExpenseCategory.id == Expense.category_id)
        .join(Requester, Requester.id == Expense.requested_by)
        .outerjoin(Approver, Approver.id == Expense.approved_by)
    )


async def create_expense(
    db: AsyncSession,
    *,
    category_id: uuid.UUID,
    amount: float,
    description: str | None,
    expense_date: date,
    requested_by: uuid.UUID,
) -> Expense:
    entity = Expense(
        category_id=category_id,
        amount=amount,
        description=description,
        expense_date=expense_date,
        requested_by=requested_by,
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_expense(db: AsyncSession, expense_id: uuid.UUID) -> Expense | None:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    return result.scalar_one_or_none()


async def get_expense_row(db: AsyncSession, expense_id: uuid.UUID) -> ExpenseRow | None:
    result = await db.execute(_expense_select().where(Expense.id == expense_id))
    return result.first()


async def list_expenses(
    db: AsyncSession,
    *,
    status: ApprovalStatus | None,
    category_id: uuid.UUID | None,
    requested_by: uuid.UUID | None,
    offset: int,
    limit: int,
) -> tuple[list[ExpenseRow], int]:
    filters = []
    if status is not None:
        filters.append(Expense.status == status)
    if category_id is not None:
        filters.append(Expense.category_id == category_id)
    if requested_by is not None:
        filters.append(Expense.requested_by == requested_by)

    count_result = await db.execute(select(func.count()).select_from(Expense).where(*filters))
    total = count_result.scalar_one()

    result = await db.execute(
        _expense_select()
        .where(*filters)
        .order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total


async def update_expense_status(
    db: AsyncSession,
    entity: Expense,
    *,
    status: ApprovalStatus,
    approved_by: uuid.UUID,
    approved_at: datetime,
) -> None:
    entity.status = status
    entity.approved_by = approved_by
    entity.approved_at = approved_at
    await db.flush()
