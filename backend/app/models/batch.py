from sqlalchemy import Column, String, Numeric, Date, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coffee_id = Column(UUID(as_uuid=True), ForeignKey("coffees.id", ondelete="CASCADE"), nullable=False, index=True)
    lot_number = Column(String(100), nullable=False, index=True)
    initial_weight_kg = Column(Numeric(10, 3), nullable=False)
    current_weight_kg = Column(Numeric(10, 3), nullable=False)
    roasted_total_weight_kg = Column(Numeric(10, 3), nullable=False, default=0.000)
    status = Column(String(20), nullable=False, default="active", index=True)
    arrival_date = Column(Date, nullable=True)
    supplier = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    coffee = relationship("Coffee", back_populates="batches")
    roasts = relationship("Roast", back_populates="batch", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('current_weight_kg >= 0', name='batch_current_weight_positive'),
        CheckConstraint('initial_weight_kg > 0', name='batch_initial_weight_positive'),
        CheckConstraint('roasted_total_weight_kg >= 0', name='batch_roasted_weight_positive'),
    )