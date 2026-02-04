from pydantic import BaseModel, EmailStr, Field, model_validator
from uuid import UUID
from datetime import datetime
from typing import Literal, Optional

UserRole = Literal["user", "admin"]


class UserBase(BaseModel):
    email: EmailStr
    username: Optional[str] = Field(None, max_length=64)


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    role: UserRole = "user"
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdateRole(BaseModel):
    role: UserRole


class UserUpdate(BaseModel):
    """Schema for updating user (admin only). All fields optional."""
    username: Optional[str] = Field(None, min_length=1, max_length=64)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=72)
    role: Optional[UserRole] = None


class UserCreateAdmin(BaseModel):
    """Schema for admin to create a new user (with role)."""
    username: str = Field(..., min_length=1, max_length=64)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    role: UserRole = "user"
    is_active: bool = True


class TokenResponse(BaseModel):
    token: str
    user_id: UUID


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    password_confirm: str = Field(..., min_length=8, max_length=72)

    @model_validator(mode='after')
    def passwords_match(self) -> 'RegisterRequest':
        if self.password != self.password_confirm:
            raise ValueError('Passwords do not match')
        return self
