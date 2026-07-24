from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import CreatedAtMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import AssetChangeType, AssetCondition, pg_enum
from app.db.base import Base


class AssetCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "asset_categories"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class Asset(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_category_id", "category_id"),
        Index("ix_assets_room_id", "room_id"),
        CheckConstraint("purchase_value >= 0", name="ck_assets_purchase_value_non_negative"),
    )

    category_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset_categories.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    room_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    condition: Mapped[AssetCondition] = mapped_column(
        pg_enum(AssetCondition, "asset_condition"),
        nullable=False,
        default=AssetCondition.good,
        server_default=text("'good'"),
    )
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_value: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)


class AssetLog(Base, UUIDPrimaryKeyMixin, CreatedAtMixin):
    """Change history for quantity/condition updates."""

    __tablename__ = "asset_logs"

    asset_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
    )
    change_type: Mapped[AssetChangeType] = mapped_column(
        pg_enum(AssetChangeType, "asset_change_type"), nullable=False
    )
    previous_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    new_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
