import uuid
from datetime import date

from pydantic import BaseModel, Field

from app.common.enums import AssetCondition


class CreateAssetCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class UpdateAssetCategoryRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)


class CreateAssetRequest(BaseModel):
    category_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=150)
    room_id: uuid.UUID | None = None
    quantity: int = Field(default=1, ge=0)
    condition: AssetCondition = AssetCondition.good
    purchase_date: date | None = None
    purchase_value: float | None = Field(default=None, ge=0)


class UpdateAssetRequest(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=150)
    room_id: uuid.UUID | None = None
    quantity: int | None = Field(default=None, ge=0)
    condition: AssetCondition | None = None
    purchase_date: date | None = None
    purchase_value: float | None = Field(default=None, ge=0)
