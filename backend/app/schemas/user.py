from pydantic import BaseModel, EmailStr, Field, model_validator
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    token: str
    user_id: UUID


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    password_confirm: str = Field(..., min_length=8, max_length=72)
    
    @model_validator(mode='after')
    def passwords_match(self) -> 'RegisterRequest':
        if self.password != self.password_confirm:
            raise ValueError('Passwords do not match')
        return self
