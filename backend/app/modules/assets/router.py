import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission
from app.common.enums import AssetCondition
from app.common.schemas import PaginationParams, pagination_meta
from app.core.response import success_response
from app.modules.assets import service
from app.modules.assets.schemas import (
    CreateAssetCategoryRequest,
    CreateAssetRequest,
    UpdateAssetCategoryRequest,
    UpdateAssetRequest,
)

router = APIRouter(prefix="/assets", tags=["assets"])


# --- Asset categories --------------------------------------------------------------------
# asset_categories carries no deleted_at column (database.md 4.10) — no delete endpoint.


@router.get("/categories", dependencies=[Depends(require_permission("assets.view"))])
async def list_asset_categories(db: AsyncSession = Depends(get_db_session)):
    data = await service.list_asset_categories(db)
    return success_response(data=data, message="Asset categories retrieved")


@router.post("/categories", dependencies=[Depends(require_permission("assets.manage"))])
async def create_asset_category(
    payload: CreateAssetCategoryRequest,
    current_user: CurrentUser = Depends(require_permission("assets.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.create_asset_category(db, current_user, payload)
    return success_response(data=data, message="Asset category created", status_code=201)


@router.patch("/categories/{category_id}", dependencies=[Depends(require_permission("assets.manage"))])
async def update_asset_category(
    category_id: uuid.UUID,
    payload: UpdateAssetCategoryRequest,
    current_user: CurrentUser = Depends(require_permission("assets.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.update_asset_category(db, current_user, category_id, payload)
    return success_response(data=data, message="Asset category updated")


# --- Rooms (read-only lookup so Staff, who may lack academic.view, can still
# pick a location when registering an asset) ---------------------------------------------


@router.get("/rooms", dependencies=[Depends(require_permission("assets.view"))])
async def list_rooms(db: AsyncSession = Depends(get_db_session)):
    data = await service.list_rooms(db)
    return success_response(data=data, message="Rooms retrieved")


# --- Assets --------------------------------------------------------------------------------


@router.post("", dependencies=[Depends(require_permission("assets.manage"))])
async def create_asset(
    payload: CreateAssetRequest,
    current_user: CurrentUser = Depends(require_permission("assets.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.create_asset(db, current_user, payload)
    return success_response(data=data, message="Asset registered", status_code=201)


@router.get("", dependencies=[Depends(require_permission("assets.view"))])
async def list_assets(
    category_id: uuid.UUID | None = Query(default=None),
    room_id: uuid.UUID | None = Query(default=None),
    condition: AssetCondition | None = Query(default=None),
    search: str | None = Query(default=None, max_length=255),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_assets(
        db, category_id=category_id, room_id=room_id, condition=condition, search=search, page=page, limit=limit
    )
    meta = pagination_meta(PaginationParams(page=page, limit=limit), total)
    return success_response(data=items, message="Assets retrieved", meta=meta)


@router.get("/{asset_id}", dependencies=[Depends(require_permission("assets.view"))])
async def get_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    data = await service.get_asset_detail(db, asset_id)
    return success_response(data=data, message="Asset retrieved")


@router.patch("/{asset_id}", dependencies=[Depends(require_permission("assets.manage"))])
async def update_asset(
    asset_id: uuid.UUID,
    payload: UpdateAssetRequest,
    current_user: CurrentUser = Depends(require_permission("assets.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.update_asset(db, current_user, asset_id, payload)
    return success_response(data=data, message="Asset updated")


@router.get("/{asset_id}/logs", dependencies=[Depends(require_permission("assets.view"))])
async def get_asset_logs(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    data = await service.get_asset_logs(db, asset_id)
    return success_response(data=data, message="Asset change history retrieved")
