from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.common.enums import GenderType, StudentStatus
from app.common.validators import normalize_email


class PendingStudentSummary(BaseModel):
    id: str
    full_name: str
    email: str | None
    phone: str
    admission_number: str
    created_at: datetime


class CreateStudentRequest(BaseModel):
    """Admin/Principal-driven admission — distinct from the self-service
    /auth/register/student + /students/{id}/activate flow (kept unmodified)."""

    full_name: str = Field(..., min_length=1, max_length=150)
    email: str | None = Field(default=None, max_length=255)
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, max_length=255)
    gender: GenderType | None = None
    date_of_birth: date | None = None

    admission_number: str | None = Field(default=None, max_length=30)
    admission_date: date | None = None
    blood_group: str | None = Field(default=None, max_length=5)
    address: str | None = None
    emergency_contact: str | None = Field(default=None, max_length=20)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return normalize_email(value) if value is not None else None


class UpdateStudentRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    gender: GenderType | None = None
    date_of_birth: date | None = None
    is_active: bool | None = None

    blood_group: str | None = Field(default=None, max_length=5)
    address: str | None = None
    emergency_contact: str | None = Field(default=None, max_length=20)
    status: StudentStatus | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return normalize_email(value) if value is not None else None


class StudentResponse(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str | None
    phone: str
    gender: GenderType | None
    date_of_birth: date | None
    is_active: bool
    admission_number: str
    admission_date: date
    blood_group: str | None
    address: str | None
    emergency_contact: str | None
    status: StudentStatus
    created_at: datetime


class LinkedGuardianSummary(BaseModel):
    guardian_id: str
    full_name: str
    phone: str
    relation: str
    is_primary: bool


class StudentDetailResponse(StudentResponse):
    guardians: list[LinkedGuardianSummary] = Field(default_factory=list)


class LinkGuardianRequest(BaseModel):
    relation: str = Field(..., min_length=1, max_length=30)
    is_primary: bool = False


class UpdateGuardianLinkRequest(BaseModel):
    relation: str | None = Field(default=None, min_length=1, max_length=30)
    is_primary: bool | None = None
