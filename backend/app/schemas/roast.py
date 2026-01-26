from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class RoastBase(BaseModel):
    roast_date: datetime
    operator: Optional[str] = None
    machine: Optional[str] = None
    green_weight_kg: float
    roasted_weight_kg: float
    roast_time_sec: Optional[int] = None
    drop_temp: Optional[int] = None
    first_crack_temp: Optional[int] = None
    first_crack_time: Optional[int] = None
    agtron: Optional[int] = None
    notes: Optional[str] = None


class RoastCreate(RoastBase):
    batch_id: UUID
    coffee_id: UUID


class RoastUpdate(BaseModel):
    roast_date: Optional[datetime] = None
    operator: Optional[str] = None
    machine: Optional[str] = None
    green_weight_kg: Optional[float] = None
    roasted_weight_kg: Optional[float] = None
    roast_time_sec: Optional[int] = None
    drop_temp: Optional[int] = None
    first_crack_temp: Optional[int] = None
    first_crack_time: Optional[int] = None
    agtron: Optional[int] = None
    notes: Optional[str] = None


class RoastResponse(RoastBase):
    id: UUID
    batch_id: UUID
    coffee_id: UUID
    weight_loss_percent: Optional[float] = None
    profile_file: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class RoastListResponse(BaseModel):
    items: list[RoastResponse]
    total: int


class ProfileUploadResponse(BaseModel):
    profile_file: str
