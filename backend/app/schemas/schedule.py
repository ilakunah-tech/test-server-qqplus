from pydantic import BaseModel
from uuid import UUID
from datetime import date, datetime
from typing import Optional


class ScheduleBase(BaseModel):
    title: str
    scheduled_date: date
    scheduled_weight_kg: Optional[float] = None
    notes: Optional[str] = None


class ScheduleCreate(ScheduleBase):
    coffee_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None


class ScheduleUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_weight_kg: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ScheduleCompleteRequest(BaseModel):
    roast_id: UUID
    roasted_weight_kg: Optional[float] = None
    notes: Optional[str] = None


class ScheduleResponse(ScheduleBase):
    id: UUID
    user_id: UUID
    coffee_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScheduleListResponse(BaseModel):
    items: list[ScheduleResponse]
    total: int
