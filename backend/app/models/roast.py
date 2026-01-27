from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Roast(Base):
    __tablename__ = "roasts"

    # КРИТИЧНО: UUID БЕЗ DEFAULT! Клиент передаёт UUID
    id = Column(UUID(as_uuid=True), primary_key=True)
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    coffee_id = Column(UUID(as_uuid=True), ForeignKey("coffees.id", ondelete="SET NULL"), nullable=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("schedules.id", ondelete="SET NULL"), nullable=True)
    
    roasted_at = Column(DateTime(timezone=True), nullable=False)
    green_weight_kg = Column(Numeric(10, 3), nullable=False)
    roasted_weight_kg = Column(Numeric(10, 3), nullable=True)
    roast_level = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    alog_file_path = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    batch = relationship("Batch", back_populates="roasts")
    coffee = relationship("Coffee", back_populates="roasts")
    schedule = relationship("Schedule")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('green_weight_kg > 0', name='roast_green_weight_positive'),
        CheckConstraint('roasted_weight_kg >= 0', name='roast_roasted_weight_positive'),
    )