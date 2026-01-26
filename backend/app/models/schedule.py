from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from uuid import uuid4
from app.db.base import Base


class Schedule(Base):
    __tablename__ = "schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    coffee_id = Column(UUID(as_uuid=True), ForeignKey("coffees.id"), nullable=False, index=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    planned_date = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    completed_roast_id = Column(UUID(as_uuid=True), ForeignKey("roasts.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    coffee = relationship("Coffee", back_populates="schedules")
    batch = relationship("Batch")
    completed_roast = relationship("Roast")
