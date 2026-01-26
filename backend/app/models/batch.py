from sqlalchemy import Column, String, Float, Date, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from uuid import uuid4
from app.db.base import Base


class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    coffee_id = Column(UUID(as_uuid=True), ForeignKey("coffees.id"), nullable=False, index=True)
    lot_number = Column(String(100), nullable=False, index=True)
    green_stock_kg = Column(Float, nullable=False, default=0.0)
    roasted_total_kg = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), nullable=False, default="active", index=True)
    arrival_date = Column(Date, nullable=True)
    expiration_date = Column(Date, nullable=True)
    supplier = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    coffee = relationship("Coffee", back_populates="batches")
    roasts = relationship("Roast", back_populates="batch", cascade="all, delete-orphan")
