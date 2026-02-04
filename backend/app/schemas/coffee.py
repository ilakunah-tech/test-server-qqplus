from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class CoffeeBase(BaseModel):
    label: str
    origin: Optional[str] = None
    region: Optional[str] = None
    variety: Optional[str] = None
    processing: Optional[str] = None
    moisture: Optional[float] = None
    density: Optional[float] = None
    water_activity: Optional[float] = None


class CoffeeCreate(CoffeeBase):
    pass


class CoffeeUpdate(BaseModel):
    label: Optional[str] = None
    origin: Optional[str] = None
    region: Optional[str] = None
    variety: Optional[str] = None
    processing: Optional[str] = None
    moisture: Optional[float] = None
    density: Optional[float] = None
    water_activity: Optional[float] = None


class CoffeeResponse(CoffeeBase):
    id: UUID
    hr_id: str
    stock_weight_kg: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CoffeeListResponse(BaseModel):
    items: list[CoffeeResponse]
    total: int


class AddStockRequest(BaseModel):
    weight_kg: float = Field(..., gt=0, description="Weight to add in kg")
