from pydantic import BaseModel
from uuid import UUID
from datetime import date, datetime
from typing import Optional


class BatchBase(BaseModel):
    lot_number: str
    initial_weight_kg: float
    current_weight_kg: float = 0.0
    roasted_total_weight_kg: float = 0.0
    status: str = "active"
    arrival_date: Optional[date] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


class BatchCreate(BatchBase):
    coffee_id: UUID


class BatchUpdate(BaseModel):
    current_weight_kg: Optional[float] = None
    roasted_total_weight_kg: Optional[float] = None
    status: Optional[str] = None
    arrival_date: Optional[date] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


class BatchResponse(BatchBase):
    id: UUID
    coffee_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatchListResponse(BaseModel):
    items: list[BatchResponse]
    total: int
