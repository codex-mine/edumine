import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import (
    CurrentUser,
    get_current_user,
    get_db_session,
    get_pagination,
    require_permission,
    require_role,
)
from app.common.schemas import PaginationParams, pagination_meta
from app.core.response import success_response
from app.modules.users import service
from app.modules.users.repository import STAFF_LIKE_ROLES
from app.modules.users.schemas import CreateUserAccountRequest, UpdateUserAccountRequest, UserAccountResponse

router = APIRouter(prefix="/users", tags=["users"])


def _to_response(record) -> dict:
    user, role_name, staff = record
    return UserAccountResponse(
        id=str(user.id),
        role=role_name,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
        is_active=user.is_active,
        created_at=user.created_at,
        employee_code=staff.employee_code if staff else None,
        department=staff.department if staff else None,
        designation=staff.designation if staff else None,
        joining_date=staff.joining_date if staff else None,
        status=staff.status if staff else None,
    ).model_dump(mode="json")


@router.post("", dependencies=[Depends(require_permission("users.create"))], status_code=201)
async def create_user_account(
    payload: CreateUserAccountRequest,
    current_user: CurrentUser = Depends(require_permission("users.create")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.create_user_account(db, current_user, payload)
    return success_response(data=_to_response(record), message="Account created successfully", status_code=201)


@router.get("", dependencies=[Depends(require_permission("users.view"))])
async def list_user_accounts(
    role: list[str] | None = Query(default=None),
    search: str | None = Query(default=None, max_length=255),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db_session),
):
    roles = role or ["admin", *STAFF_LIKE_ROLES]
    items, total = await service.list_user_accounts(db, roles=roles, search=search, pagination=pagination)
    return success_response(
        data=[_to_response(item) for item in items],
        message="Accounts retrieved",
        meta=pagination_meta(pagination, total),
    )


@router.get("/me")
async def get_own_account(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.get_own_account(db, current_user)
    return success_response(data=_to_response(record), message="Your account")


@router.get("/{user_id}", dependencies=[Depends(require_permission("users.view"))])
async def get_user_account(user_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    record = await service.get_user_account(db, user_id)
    return success_response(data=_to_response(record), message="Account retrieved")


@router.patch("/{user_id}", dependencies=[Depends(require_permission("users.update"))])
async def update_user_account(
    user_id: uuid.UUID,
    payload: UpdateUserAccountRequest,
    current_user: CurrentUser = Depends(require_permission("users.update")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.update_user_account(db, current_user, user_id, payload)
    return success_response(data=_to_response(record), message="Account updated successfully")


@router.delete("/{user_id}", dependencies=[Depends(require_permission("users.delete"))])
async def soft_delete_user_account(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("users.delete")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.soft_delete_user_account(db, current_user, user_id)
    return success_response(data=None, message="Account deleted successfully")


@router.delete("/{user_id}/hard", dependencies=[Depends(require_role("principal"))])
async def hard_delete_user_account(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("principal")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.hard_delete_user_account(db, current_user, user_id)
    return success_response(data=None, message="Account permanently deleted")
