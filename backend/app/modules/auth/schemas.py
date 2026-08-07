import re
from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.common.enums import GenderType

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1, max_length=255, description="Phone or email")
    password: str = Field(..., min_length=1, max_length=255)


class AuthenticatedUser(BaseModel):
    id: str
    full_name: str
    role: str
    email: str | None
    phone: str
    permissions: list[str]


class RegisterStudentRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, max_length=255)
    gender: GenderType | None = None
    date_of_birth: date | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not EMAIL_PATTERN.match(value):
            raise ValueError("Invalid email format")
        return value.lower()


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not EMAIL_PATTERN.match(value):
            raise ValueError("Invalid email format")
        return value.lower()


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=255)


class ChangePasswordRequest(BaseModel):
    """Self-service password change for a signed-in user — unlike the reset flow
    it proves ownership with the current password instead of an emailed token."""

    current_password: str = Field(..., min_length=1, max_length=255)
    new_password: str = Field(..., min_length=8, max_length=255)
