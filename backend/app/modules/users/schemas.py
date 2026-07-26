from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.common.enums import EmploymentStatus, GenderType
from app.common.validators import normalize_email

StaffLikeRole = Literal["staff", "accountant", "receptionist"]
UserAccountRole = Literal["admin", "staff", "accountant", "receptionist"]


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


class CreateUserAccountRequest(BaseModel):
    """Creates an Admin, Staff, Accountant, or Receptionist account.

    Admin creation is further restricted to the Principal at the service layer
    (requirements.md 3.1) even though `users.create` is also held by Admin, since
    Admin only manages Accountants/Receptionists/Staff, not other Admins.

    Staff-like accounts (staff/accountant/receptionist) get an auto-generated
    login password derived from date of birth (DDMMYYYY), matching the
    student/teacher onboarding flow — `password` is ignored for them. Admin
    accounts keep a client-supplied password since a DOB-derived password is
    predictable and admin is a higher-privilege role.
    """

    role: UserAccountRole
    full_name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., min_length=7, max_length=20)
    password: str | None = Field(default=None, min_length=8, max_length=255, description="Required for Admin only")
    gender: GenderType | None = None
    date_of_birth: date | None = Field(
        default=None, description="Required for staff-like roles — also generates their login password (DDMMYYYY)"
    )

    # Staff-profile fields — required when role is staff-like, ignored for admin.
    employee_code: str | None = Field(default=None, max_length=30)
    department: str | None = Field(default=None, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    joining_date: date | None = None
    nid_number: str | None = Field(default=None, max_length=30)
    nid_document_url: str | None = Field(default=None, max_length=500)
    previous_employment: str | None = None
    qualifications: list[QualificationInput] = Field(default_factory=list)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class UpdateUserAccountRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    gender: GenderType | None = None
    date_of_birth: date | None = None
    is_active: bool | None = None

    department: str | None = Field(default=None, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    nid_number: str | None = Field(default=None, max_length=30)
    nid_document_url: str | None = Field(default=None, max_length=500)
    previous_employment: str | None = None
    status: EmploymentStatus | None = None
    qualifications: list[QualificationInput] | None = Field(
        default=None, description="When provided, replaces the account's full qualification list."
    )

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return normalize_email(value) if value is not None else None


class UserAccountResponse(BaseModel):
    id: str
    role: UserAccountRole
    full_name: str
    email: str | None
    phone: str
    gender: GenderType | None
    date_of_birth: date | None
    is_active: bool
    created_at: datetime

    # Present only for staff-like roles (null for admin).
    employee_code: str | None = None
    department: str | None = None
    designation: str | None = None
    joining_date: date | None = None
    nid_number: str | None = None
    nid_document_url: str | None = None
    previous_employment: str | None = None
    status: EmploymentStatus | None = None


class UserAccountDetailResponse(UserAccountResponse):
    qualifications: list[QualificationResponse] = Field(default_factory=list)


class CreateUserAccountResponse(UserAccountDetailResponse):
    """Carries the generated login password for staff-like roles (null for Admin,
    which keeps its client-supplied password and is never echoed back)."""

    temporary_password: str | None = None
