from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.common.enums import EmploymentStatus, GenderType
from app.common.validators import normalize_email


class QualificationInput(BaseModel):
    education_title: str = Field(..., min_length=1, max_length=150)
    institute: str = Field(..., min_length=1, max_length=200)
    grade: str | None = Field(default=None, max_length=30)
    passing_year: int | None = Field(default=None, ge=1950, le=2100)
    additional_info: str | None = None
    certificate_url: str | None = Field(default=None, max_length=500)
    marksheet_url: str | None = Field(default=None, max_length=500)


class QualificationResponse(QualificationInput):
    id: str


class CreateTeacherRequest(BaseModel):
    """Admin/Principal-driven onboarding. The initial login password is
    generated automatically from the teacher's date of birth (DDMMYYYY),
    matching the student admission flow — it is never accepted from the client."""

    full_name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., min_length=7, max_length=20)
    gender: GenderType | None = None
    date_of_birth: date = Field(..., description="Also used to generate the teacher's login password (DDMMYYYY)")

    employee_code: str | None = Field(default=None, max_length=30)
    joining_date: date
    designation: str | None = Field(default=None, max_length=100)
    qualification: str | None = None
    nid_number: str | None = Field(default=None, max_length=30)
    nid_document_url: str | None = Field(default=None, max_length=500)
    previous_employment: str | None = None
    qualifications: list[QualificationInput] = Field(default_factory=list)

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
    nid_number: str | None = Field(default=None, max_length=30)
    nid_document_url: str | None = Field(default=None, max_length=500)
    previous_employment: str | None = None
    status: EmploymentStatus | None = None
    qualifications: list[QualificationInput] | None = Field(
        default=None, description="When provided, replaces the teacher's full qualification list."
    )

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
    nid_number: str | None
    nid_document_url: str | None
    previous_employment: str | None
    status: EmploymentStatus
    created_at: datetime


class TeacherDetailResponse(TeacherResponse):
    qualifications: list[QualificationResponse] = Field(default_factory=list)


class CreateTeacherResponse(TeacherDetailResponse):
    """Returned only from the create-teacher endpoint — carries the
    system-generated login password so the admin can hand it to the teacher."""

    temporary_password: str
