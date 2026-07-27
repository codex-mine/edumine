import uuid
from datetime import date

from pydantic import BaseModel, Field


class CreateExpenseCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class UpdateExpenseCategoryRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)


class CreateExpenseRequest(BaseModel):
    category_id: uuid.UUID
    amount: float = Field(..., ge=0)
    description: str | None = None
    expense_date: date
