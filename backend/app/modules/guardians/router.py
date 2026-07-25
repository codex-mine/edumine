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
from app.modules.guardians import service
from app.modules.guardians.schemas import (
    CreateGuardianRequest,
    GuardianDetailResponse,
    GuardianResponse,
    UpdateGuardianRequest,
)

router = APIRouter(prefix="/guardians", tags=["guardians"])


def _to_response(record) -> dict:
    guardian, user = record
    return GuardianResponse(
        id=str(guardian.id),
        user_id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
        is_active=user.is_active,
        occupation=guardian.occupation,
        address=guardian.address,
        created_at=guardian.created_at,
    ).model_dump(mode="json")


async def _to_detail_response(db: AsyncSession, record) -> dict:
    base = _to_response(record)
    guardian, _ = record
    students = await service.get_linked_students(db, guardian.id)
    return GuardianDetailResponse(**base, students=students).model_dump(mode="json")


@router.post("", dependencies=[Depends(require_permission("guardians.create"))], status_code=201)
async def create_guardian(
    payload: CreateGuardianRequest,
    current_user: CurrentUser = Depends(require_permission("guardians.create")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.create_guardian(db, current_user, payload)
    return success_response(data=_to_response(record), message="Guardian created successfully", status_code=201)


@router.get("", dependencies=[Depends(require_permission("guardians.view"))])
async def list_guardians(
    search: str | None = Query(default=None, max_length=255),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_guardians(db, search=search, pagination=pagination)
    return success_response(
        data=[_to_response(item) for item in items],
        message="Guardians retrieved",
        meta=pagination_meta(pagination, total),
    )


@router.get("/me")
async def get_own_guardian_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.get_own_guardian_profile(db, current_user)
    return success_response(data=await _to_detail_response(db, record), message="Your guardian profile")


@router.get("/{guardian_id}", dependencies=[Depends(require_permission("guardians.view"))])
async def get_guardian(guardian_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    record = await service.get_guardian(db, guardian_id)
    return success_response(data=await _to_detail_response(db, record), message="Guardian retrieved")


@router.patch("/{guardian_id}", dependencies=[Depends(require_permission("guardians.update"))])
async def update_guardian(
    guardian_id: uuid.UUID,
    payload: UpdateGuardianRequest,
    current_user: CurrentUser = Depends(require_permission("guardians.update")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.update_guardian(db, current_user, guardian_id, payload)
    return success_response(data=_to_response(record), message="Guardian updated successfully")


@router.delete("/{guardian_id}", dependencies=[Depends(require_permission("guardians.delete"))])
async def soft_delete_guardian(
    guardian_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("guardians.delete")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.soft_delete_guardian(db, current_user, guardian_id)
    return success_response(data=None, message="Guardian deleted successfully")


@router.delete("/{guardian_id}/hard", dependencies=[Depends(require_role("principal"))])
async def hard_delete_guardian(
    guardian_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("principal")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.hard_delete_guardian(db, current_user, guardian_id)
    return success_response(data=None, message="Guardian permanently deleted")
