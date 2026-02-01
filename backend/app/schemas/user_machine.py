from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class UserMachineResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserMachineCreate(BaseModel):
    name: str
