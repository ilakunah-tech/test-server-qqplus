from pydantic import BaseModel, Field
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
    lot_number: Optional[str] = None
    current_weight_kg: Optional[float] = None
    roasted_total_weight_kg: Optional[float] = None
    status: Optional[str] = None
    arrival_date: Optional[date] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


class BatchDeductRequest(BaseModel):
    """Request to deduct weight from batch (atomic, with SELECT FOR UPDATE)."""
    weight_kg: float = Field(..., gt=0, description="Weight to deduct in kg")


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
