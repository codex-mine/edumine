from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.common.enums import EmploymentStatus, GenderType
from app.common.validators import normalize_email

StaffLikeRole = Literal["staff", "accountant", "receptionist"]
UserAccountRole = Literal["admin", "staff", "accountant", "receptionist"]


class CreateUserAccountRequest(BaseModel):
    """Creates an Admin, Staff, Accountant, or Receptionist account.

    Admin creation is further restricted to the Principal at the service layer
    (requirements.md 3.1) even though `users.create` is also held by Admin, since
    Admin only manages Accountants/Receptionists/Staff, not other Admins.
    """

    role: UserAccountRole
    full_name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, max_length=255)
    gender: GenderType | None = None
    date_of_birth: date | None = None

    # Staff-profile fields — required when role is staff-like, ignored for admin.
    employee_code: str | None = Field(default=None, max_length=30)
    department: str | None = Field(default=None, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    joining_date: date | None = None

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
    status: EmploymentStatus | None = None

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
    status: EmploymentStatus | None = None
