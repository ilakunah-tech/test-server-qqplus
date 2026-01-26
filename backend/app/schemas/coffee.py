from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class CoffeeBase(BaseModel):
    name: str
    origin: Optional[str] = None
    region: Optional[str] = None
    variety: Optional[str] = None
    processing: Optional[str] = None
    moisture: Optional[float] = None
    density: Optional[float] = None


class CoffeeCreate(CoffeeBase):
    pass


class CoffeeUpdate(BaseModel):
    name: Optional[str] = None
    origin: Optional[str] = None
    region: Optional[str] = None
    variety: Optional[str] = None
    processing: Optional[str] = None
    moisture: Optional[float] = None
    density: Optional[float] = None


class CoffeeResponse(CoffeeBase):
    id: UUID
    hr_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CoffeeListResponse(BaseModel):
    items: list[CoffeeResponse]
    total: int
