from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.common.enums import EmploymentStatus, GenderType
from app.common.validators import normalize_email


class CreateTeacherRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, max_length=255)
    gender: GenderType | None = None
    date_of_birth: date | None = None

    employee_code: str | None = Field(default=None, max_length=30)
    joining_date: date
    designation: str | None = Field(default=None, max_length=100)
    qualification: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class UpdateTeacherRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    gender: GenderType | None = None
    date_of_birth: date | None = None
    is_active: bool | None = None

    designation: str | None = Field(default=None, max_length=100)
    qualification: str | None = None
    status: EmploymentStatus | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return normalize_email(value) if value is not None else None


class TeacherResponse(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str | None
    phone: str
    gender: GenderType | None
    date_of_birth: date | None
    is_active: bool
    employee_code: str
    joining_date: date
    designation: str | None
    qualification: str | None
    status: EmploymentStatus
    created_at: datetime
