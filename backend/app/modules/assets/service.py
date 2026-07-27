import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import AssetChangeType, AssetCondition
from app.core.exceptions import ConflictException, NotFoundException
from app.modules.assets import repository
from app.modules.assets.models import Asset, AssetCategory
from app.modules.assets.repository import AssetRow
from app.modules.assets.schemas import (
    CreateAssetCategoryRequest,
    CreateAssetRequest,
    UpdateAssetCategoryRequest,
    UpdateAssetRequest,
)

UNASSIGNED_ROOM_LABEL = "Unassigned"

# --- Asset categories --------------------------------------------------------------------


def _category_response(entity: AssetCategory) -> dict:
    return {
        "id": str(entity.id),
        "name": entity.name,
        "created_at": entity.created_at.isoformat(),
    }


async def list_asset_categories(db: AsyncSession) -> list[dict]:
    entities = await repository.list_categories(db)
    return [_category_response(e) for e in entities]


async def create_asset_category(db: AsyncSession, actor: CurrentUser, payload: CreateAssetCategoryRequest) -> dict:
    existing = await repository.get_category_by_name(db, payload.name)
    if existing is not None:
        raise ConflictException(f"An asset category named '{payload.name}' already exists")

    entity = await repository.create_category(db, name=payload.name)
    await record_audit_log(
        db, actor_id=actor.id, action="create", entity_type="asset_category", entity_id=entity.id,
        new_value={"name": payload.name},
    )
    await db.commit()
    return _category_response(entity)


async def _get_category_or_404(db: AsyncSession, category_id: uuid.UUID) -> AssetCategory:
    entity = await repository.get_category(db, category_id)
    if entity is None:
        raise NotFoundException("Asset category not found")
    return entity


async def update_asset_category(
    db: AsyncSession, actor: CurrentUser, category_id: uuid.UUID, payload: UpdateAssetCategoryRequest
) -> dict:
    entity = await _get_category_or_404(db, category_id)
    fields = payload.model_dump(exclude_unset=True)
    if "name" in fields:
        existing = await repository.get_category_by_name(db, fields["name"])
        if existing is not None and existing.id != entity.id:
            raise ConflictException(f"An asset category named '{fields['name']}' already exists")

    if fields:
        await repository.update_category_fields(db, entity, fields)
        await record_audit_log(
            db, actor_id=actor.id, action="update", entity_type="asset_category", entity_id=entity.id, new_value=fields
        )
        await db.commit()
    return _category_response(entity)


# --- Rooms (read-only, for the asset registration form) ---------------------------------


async def list_rooms(db: AsyncSession) -> list[dict]:
    rooms = await repository.list_rooms(db)
    return [{"id": str(room.id), "name": room.name, "capacity": room.capacity} for room in rooms]


# --- Assets ------------------------------------------------------------------------------


def _asset_response(row: AssetRow) -> dict:
    asset, category, room = row
    return {
        "id": str(asset.id),
        "category_id": str(asset.category_id),
        "category_name": category.name,
        "name": asset.name,
        "room_id": str(asset.room_id) if asset.room_id else None,
        "room_name": room.name if room else None,
        "quantity": asset.quantity,
        "condition": asset.condition,
        "purchase_date": asset.purchase_date.isoformat() if asset.purchase_date else None,
        "purchase_value": float(asset.purchase_value) if asset.purchase_value is not None else None,
        "created_at": asset.created_at.isoformat(),
        "updated_at": asset.updated_at.isoformat(),
    }


async def _get_room_or_404(db: AsyncSession, room_id: uuid.UUID):
    room = await repository.get_room(db, room_id)
    if room is None:
        raise NotFoundException("Room not found")
    return room


async def create_asset(db: AsyncSession, actor: CurrentUser, payload: CreateAssetRequest) -> dict:
    category = await repository.get_category(db, payload.category_id)
    if category is None:
        raise NotFoundException("Asset category not found")
    if payload.room_id is not None:
        await _get_room_or_404(db, payload.room_id)

    entity = await repository.create_asset(
        db,
        category_id=payload.category_id,
        name=payload.name,
        room_id=payload.room_id,
        quantity=payload.quantity,
        condition=payload.condition,
        purchase_date=payload.purchase_date,
        purchase_value=payload.purchase_value,
    )
    await record_audit_log(
        db, actor_id=actor.id, action="create", entity_type="asset", entity_id=entity.id,
        new_value={
            "category_id": str(payload.category_id),
            "name": payload.name,
            "room_id": str(payload.room_id) if payload.room_id else None,
            "quantity": payload.quantity,
            "condition": payload.condition.value,
        },
    )
    await db.commit()

    row = await repository.get_asset_row(db, entity.id)
    assert row is not None
    return _asset_response(row)


async def _get_asset_or_404(db: AsyncSession, asset_id: uuid.UUID) -> Asset:
    entity = await repository.get_asset(db, asset_id)
    if entity is None:
        raise NotFoundException("Asset not found")
    return entity


async def get_asset_detail(db: AsyncSession, asset_id: uuid.UUID) -> dict:
    row = await repository.get_asset_row(db, asset_id)
    if row is None:
        raise NotFoundException("Asset not found")
    return _asset_response(row)


async def list_assets(
    db: AsyncSession,
    *,
    category_id: uuid.UUID | None,
    room_id: uuid.UUID | None,
    condition: AssetCondition | None,
    search: str | None,
    page: int,
    limit: int,
) -> tuple[list[dict], int]:
    rows, total = await repository.list_assets(
        db,
        category_id=category_id,
        room_id=room_id,
        condition=condition,
        search=search,
        offset=(page - 1) * limit,
        limit=limit,
    )
    return [_asset_response(row) for row in rows], total


async def _room_label(db: AsyncSession, room_id: uuid.UUID | None) -> str:
    if room_id is None:
        return UNASSIGNED_ROOM_LABEL
    room = await repository.get_room(db, room_id)
    return room.name if room is not None else UNASSIGNED_ROOM_LABEL


async def update_asset(db: AsyncSession, actor: CurrentUser, asset_id: uuid.UUID, payload: UpdateAssetRequest) -> dict:
    entity = await _get_asset_or_404(db, asset_id)
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        row = await repository.get_asset_row(db, entity.id)
        assert row is not None
        return _asset_response(row)

    if "category_id" in fields:
        category = await repository.get_category(db, fields["category_id"])
        if category is None:
            raise NotFoundException("Asset category not found")
    if fields.get("room_id") is not None:
        await _get_room_or_404(db, fields["room_id"])

    pending_logs: list[tuple[AssetChangeType, str | None, str | None]] = []

    if "quantity" in fields and fields["quantity"] != entity.quantity:
        pending_logs.append((AssetChangeType.quantity_update, str(entity.quantity), str(fields["quantity"])))

    if "condition" in fields and fields["condition"] != entity.condition:
        new_condition: AssetCondition = fields["condition"]
        change_type = (
            AssetChangeType.disposal if new_condition == AssetCondition.disposed else AssetChangeType.condition_update
        )
        pending_logs.append((change_type, entity.condition.value, new_condition.value))

    if "room_id" in fields and fields["room_id"] != entity.room_id:
        previous_label = await _room_label(db, entity.room_id)
        new_label = await _room_label(db, fields["room_id"])
        pending_logs.append((AssetChangeType.relocation, previous_label, new_label))

    await repository.update_asset_fields(db, entity, fields)

    for change_type, previous_value, new_value in pending_logs:
        await repository.create_asset_log(
            db,
            asset_id=entity.id,
            change_type=change_type,
            previous_value=previous_value,
            new_value=new_value,
            updated_by=actor.id,
        )

    await record_audit_log(db, actor_id=actor.id, action="update", entity_type="asset", entity_id=entity.id, new_value=fields)
    await db.commit()

    row = await repository.get_asset_row(db, entity.id)
    assert row is not None
    return _asset_response(row)


# --- Asset logs --------------------------------------------------------------------------


async def get_asset_logs(db: AsyncSession, asset_id: uuid.UUID) -> list[dict]:
    await _get_asset_or_404(db, asset_id)
    rows = await repository.list_asset_logs(db, asset_id)
    return [
        {
            "id": str(log.id),
            "asset_id": str(log.asset_id),
            "change_type": log.change_type,
            "previous_value": log.previous_value,
            "new_value": log.new_value,
            "updated_by": str(log.updated_by),
            "updated_by_name": updated_by_name,
            "created_at": log.created_at.isoformat(),
        }
        for log, updated_by_name in rows
    ]
