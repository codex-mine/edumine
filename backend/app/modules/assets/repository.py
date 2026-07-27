import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import AssetCondition
from app.modules.academic.models import Room
from app.modules.assets.models import Asset, AssetCategory, AssetLog
from app.modules.auth.models import User

# --- Asset categories ------------------------------------------------------------------


async def get_category_by_name(db: AsyncSession, name: str) -> AssetCategory | None:
    result = await db.execute(select(AssetCategory).where(AssetCategory.name == name))
    return result.scalar_one_or_none()


async def get_category(db: AsyncSession, category_id: uuid.UUID) -> AssetCategory | None:
    result = await db.execute(select(AssetCategory).where(AssetCategory.id == category_id))
    return result.scalar_one_or_none()


async def create_category(db: AsyncSession, *, name: str) -> AssetCategory:
    entity = AssetCategory(name=name)
    db.add(entity)
    await db.flush()
    return entity


async def list_categories(db: AsyncSession) -> list[AssetCategory]:
    result = await db.execute(select(AssetCategory).order_by(AssetCategory.name.asc()))
    return list(result.scalars().all())


async def update_category_fields(db: AsyncSession, entity: AssetCategory, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


# --- Rooms (read-only lookup for the asset registration form) --------------------------


async def get_room(db: AsyncSession, room_id: uuid.UUID) -> Room | None:
    result = await db.execute(select(Room).where(Room.id == room_id, Room.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def list_rooms(db: AsyncSession) -> list[Room]:
    result = await db.execute(select(Room).where(Room.deleted_at.is_(None)).order_by(Room.name.asc()))
    return list(result.scalars().all())


# --- Assets ------------------------------------------------------------------------------

AssetRow = tuple[Asset, AssetCategory, Room | None]


def _asset_select():
    return (
        select(Asset, AssetCategory, Room)
        .join(AssetCategory, AssetCategory.id == Asset.category_id)
        .outerjoin(Room, Room.id == Asset.room_id)
    )


async def create_asset(
    db: AsyncSession,
    *,
    category_id: uuid.UUID,
    name: str,
    room_id: uuid.UUID | None,
    quantity: int,
    condition: AssetCondition,
    purchase_date,
    purchase_value: float | None,
) -> Asset:
    entity = Asset(
        category_id=category_id,
        name=name,
        room_id=room_id,
        quantity=quantity,
        condition=condition,
        purchase_date=purchase_date,
        purchase_value=purchase_value,
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_asset(db: AsyncSession, asset_id: uuid.UUID) -> Asset | None:
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_asset_row(db: AsyncSession, asset_id: uuid.UUID) -> AssetRow | None:
    result = await db.execute(_asset_select().where(Asset.id == asset_id, Asset.deleted_at.is_(None)))
    return result.first()


async def list_assets(
    db: AsyncSession,
    *,
    category_id: uuid.UUID | None,
    room_id: uuid.UUID | None,
    condition: AssetCondition | None,
    search: str | None,
    offset: int,
    limit: int,
) -> tuple[list[AssetRow], int]:
    filters = [Asset.deleted_at.is_(None)]
    if category_id is not None:
        filters.append(Asset.category_id == category_id)
    if room_id is not None:
        filters.append(Asset.room_id == room_id)
    if condition is not None:
        filters.append(Asset.condition == condition)
    if search:
        filters.append(Asset.name.ilike(f"%{search}%"))

    count_result = await db.execute(select(func.count()).select_from(Asset).where(*filters))
    total = count_result.scalar_one()

    result = await db.execute(
        _asset_select().where(*filters).order_by(Asset.name.asc()).offset(offset).limit(limit)
    )
    return list(result.all()), total


async def update_asset_fields(db: AsyncSession, entity: Asset, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


# --- Asset logs --------------------------------------------------------------------------


async def create_asset_log(
    db: AsyncSession,
    *,
    asset_id: uuid.UUID,
    change_type,
    previous_value: str | None,
    new_value: str | None,
    updated_by: uuid.UUID,
) -> AssetLog:
    entity = AssetLog(
        asset_id=asset_id,
        change_type=change_type,
        previous_value=previous_value,
        new_value=new_value,
        updated_by=updated_by,
    )
    db.add(entity)
    await db.flush()
    return entity


async def list_asset_logs(db: AsyncSession, asset_id: uuid.UUID) -> list[tuple[AssetLog, str]]:
    result = await db.execute(
        select(AssetLog, User.full_name)
        .join(User, User.id == AssetLog.updated_by)
        .where(AssetLog.asset_id == asset_id)
        .order_by(AssetLog.created_at.desc())
    )
    return list(result.all())
