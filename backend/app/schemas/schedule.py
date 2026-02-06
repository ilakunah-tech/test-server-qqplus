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
    machine_id: Optional[UUID] = None


class ScheduleUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_weight_kg: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    machine_id: Optional[UUID] = None


class ScheduleBulkItemCreate(BaseModel):
    """Single item for bulk schedule create (title required, rest optional)."""
    title: str
    scheduled_weight_kg: Optional[float] = None
    coffee_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    roast_target: Optional[str] = None  # filter, omni, espresso
    notes: Optional[str] = None


class ScheduleBulkCreate(BaseModel):
    """Create many schedule items at once (e.g. full day list)."""
    scheduled_date: date
    machine_id: Optional[UUID] = None
    items: list[ScheduleBulkItemCreate]


class ScheduleCompleteRequest(BaseModel):
    roast_id: UUID
    roasted_weight_kg: Optional[float] = None
    notes: Optional[str] = None


class ScheduleResponse(ScheduleBase):
    id: UUID
    user_id: UUID
    coffee_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    machine_id: Optional[UUID] = None
    roast_target: Optional[str] = None
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScheduleListResponse(BaseModel):
    items: list[ScheduleResponse]
    total: int
