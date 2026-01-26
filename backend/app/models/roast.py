from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from uuid import uuid4
from app.db.base import Base


class Roast(Base):
    __tablename__ = "roasts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True)
    coffee_id = Column(UUID(as_uuid=True), ForeignKey("coffees.id"), nullable=False, index=True)
    roast_date = Column(DateTime(timezone=True), nullable=False, index=True)
    operator = Column(String(100), nullable=True)
    machine = Column(String(100), nullable=True)
    green_weight_kg = Column(Float, nullable=False)
    roasted_weight_kg = Column(Float, nullable=False)
    weight_loss_percent = Column(Float, nullable=True)
    roast_time_sec = Column(Integer, nullable=True)
    drop_temp = Column(Integer, nullable=True)
    first_crack_temp = Column(Integer, nullable=True)
    first_crack_time = Column(Integer, nullable=True)
    agtron = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    profile_file = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    batch = relationship("Batch", back_populates="roasts")
    coffee = relationship("Coffee", back_populates="roasts")
