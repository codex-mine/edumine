import uuid
from datetime import date

from pydantic import BaseModel, Field, model_validator


class SetSalaryStructureRequest(BaseModel):
    teacher_id: uuid.UUID | None = None
    staff_id: uuid.UUID | None = None
    basic_salary: float = Field(..., ge=0)
    allowances: float = Field(default=0, ge=0)
    deductions: float = Field(default=0, ge=0)
    effective_from: date

    @model_validator(mode="after")
    def _exactly_one_employee(self) -> "SetSalaryStructureRequest":
        if (self.teacher_id is None) == (self.staff_id is None):
            raise ValueError("Exactly one of teacher_id or staff_id must be provided")
        return self


class UpdateSalaryStructureRequest(BaseModel):
    basic_salary: float | None = Field(default=None, ge=0)
    allowances: float | None = Field(default=None, ge=0)
    deductions: float | None = Field(default=None, ge=0)
    effective_from: date | None = None


class GeneratePayrollRunRequest(BaseModel):
    period_month: int = Field(..., ge=1, le=12)
    period_year: int = Field(..., ge=2000, le=2100)
