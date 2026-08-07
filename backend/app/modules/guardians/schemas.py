from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.common.enums import GenderType
from app.common.validators import normalize_email


class CreateGuardianRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, max_length=255)
    gender: GenderType | None = None
    date_of_birth: date | None = None

    occupation: str | None = Field(default=None, max_length=100)
    address: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class UpdateGuardianRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    gender: GenderType | None = None
    date_of_birth: date | None = None
    is_active: bool | None = None

    occupation: str | None = Field(default=None, max_length=100)
    address: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return normalize_email(value) if value is not None else None


class GuardianResponse(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str | None
    phone: str
    gender: GenderType | None
    date_of_birth: date | None
    profile_photo_url: str | None = None
    is_active: bool
    occupation: str | None
    address: str | None
    created_at: datetime


class LinkedStudentSummary(BaseModel):
    student_id: str
    full_name: str
    admission_number: str
    relation: str
    is_primary: bool


class GuardianDetailResponse(GuardianResponse):
    students: list[LinkedStudentSummary] = Field(default_factory=list)
