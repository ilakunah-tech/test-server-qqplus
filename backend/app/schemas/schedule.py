from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class ScheduleBase(BaseModel):
    planned_date: datetime
    notes: Optional[str] = None


class ScheduleCreate(ScheduleBase):
    coffee_id: UUID
    batch_id: Optional[UUID] = None


class ScheduleUpdate(BaseModel):
    planned_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ScheduleCompleteRequest(BaseModel):
    roast_id: UUID
    roasted_weight_kg: float
    notes: Optional[str] = None


class ScheduleResponse(ScheduleBase):
    id: UUID
    coffee_id: UUID
    batch_id: Optional[UUID] = None
    status: str
    completed_roast_id: Optional[UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ScheduleListResponse(BaseModel):
    items: list[ScheduleResponse]
    total: int
