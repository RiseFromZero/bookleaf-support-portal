from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class LoginRequest(BaseModel):
    """Validates incoming email & password login payload."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Safe public representation of a User (never exposes password_hash)."""
    id: int
    author_code: Optional[str] = None
    name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    city: Optional[str] = None
    joined_date: Optional[str] = None

    # Allows Pydantic to read data directly from SQLAlchemy ORM models
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Returned on successful login with JWT Bearer token + user profile."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse