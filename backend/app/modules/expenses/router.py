import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission
from app.common.enums import ApprovalStatus
from app.common.schemas import PaginationParams, pagination_meta
from app.core.response import success_response
from app.modules.expenses import service
from app.modules.expenses.schemas import (
    CreateExpenseCategoryRequest,
    CreateExpenseRequest,
    UpdateExpenseCategoryRequest,
)

router = APIRouter(prefix="/expenses", tags=["expenses"])


# --- Expense categories ---------------------------------------------------------------
# Category definition is gated behind expenses.approve (Admin/Principal) — Accountant
# holds expenses.view/expenses.create only and works within categories Admin defines.


@router.get("/categories", dependencies=[Depends(require_permission("expenses.view"))])
async def list_expense_categories(db: AsyncSession = Depends(get_db_session)):
    data = await service.list_expense_categories(db)
    return success_response(data=data, message="Expense categories retrieved")


@router.post("/categories", dependencies=[Depends(require_permission("expenses.approve"))])
async def create_expense_category(
    payload: CreateExpenseCategoryRequest,
    current_user: CurrentUser = Depends(require_permission("expenses.approve")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.create_expense_category(db, current_user, payload)
    return success_response(data=data, message="Expense category created", status_code=201)


@router.patch("/categories/{category_id}", dependencies=[Depends(require_permission("expenses.approve"))])
async def update_expense_category(
    category_id: uuid.UUID,
    payload: UpdateExpenseCategoryRequest,
    current_user: CurrentUser = Depends(require_permission("expenses.approve")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.update_expense_category(db, current_user, category_id, payload)
    return success_response(data=data, message="Expense category updated")


@router.delete("/categories/{category_id}", dependencies=[Depends(require_permission("expenses.approve"))])
async def delete_expense_category(
    category_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("expenses.approve")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_expense_category(db, current_user, category_id)
    return success_response(data=None, message="Expense category deleted")


# --- Expenses --------------------------------------------------------------------------


@router.post("", dependencies=[Depends(require_permission("expenses.create"))])
async def create_expense(
    payload: CreateExpenseRequest,
    current_user: CurrentUser = Depends(require_permission("expenses.create")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.create_expense(db, current_user, payload)
    return success_response(data=data, message="Expense recorded", status_code=201)


@router.get("", dependencies=[Depends(require_permission("expenses.view"))])
async def list_expenses(
    status: ApprovalStatus | None = Query(default=None),
    category_id: uuid.UUID | None = Query(default=None),
    requested_by: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_expenses(
        db, status=status, category_id=category_id, requested_by=requested_by, page=page, limit=limit
    )
    meta = pagination_meta(PaginationParams(page=page, limit=limit), total)
    return success_response(data=items, message="Expenses retrieved", meta=meta)


@router.get("/{expense_id}", dependencies=[Depends(require_permission("expenses.view"))])
async def get_expense(expense_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    data = await service.get_expense_detail(db, expense_id)
    return success_response(data=data, message="Expense retrieved")


@router.post("/{expense_id}/approve", dependencies=[Depends(require_permission("expenses.approve"))])
async def approve_expense(
    expense_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("expenses.approve")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.approve_expense(db, current_user, expense_id)
    return success_response(data=data, message="Expense approved")


@router.post("/{expense_id}/reject", dependencies=[Depends(require_permission("expenses.approve"))])
async def reject_expense(
    expense_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("expenses.approve")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.reject_expense(db, current_user, expense_id)
    return success_response(data=data, message="Expense rejected")
