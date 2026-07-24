from pydantic import BaseModel, Field


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
