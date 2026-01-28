from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class RoastBase(BaseModel):
    roasted_at: datetime
    green_weight_kg: float
    roasted_weight_kg: Optional[float] = None
    title: Optional[str] = None
    roast_level: Optional[str] = None
    notes: Optional[str] = None


class RoastCreate(RoastBase):
    id: UUID  # Client-provided UUID for idempotency
    batch_id: Optional[UUID] = None
    coffee_id: Optional[UUID] = None
    schedule_id: Optional[UUID] = None


class RoastUpdate(BaseModel):
    roasted_at: Optional[datetime] = None
    green_weight_kg: Optional[float] = None
    roasted_weight_kg: Optional[float] = None
    title: Optional[str] = None
    roast_level: Optional[str] = None
    notes: Optional[str] = None


class RoastResponse(RoastBase):
    id: UUID
    user_id: UUID
    batch_id: Optional[UUID] = None
    coffee_id: Optional[UUID] = None
    schedule_id: Optional[UUID] = None
    alog_file_path: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RoastListResponse(BaseModel):
    items: list[RoastResponse]
    total: int


class ProfileUploadResponse(BaseModel):
    alog_file_path: str
