from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    coffee_id = Column(UUID(as_uuid=True), ForeignKey("coffees.id", ondelete="SET NULL"), nullable=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("user_machines.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(255), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    scheduled_weight_kg = Column(Numeric(10, 3), nullable=True)
    roast_target = Column(String(20), nullable=True)  # filter, omni, espresso
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User")
    coffee = relationship("Coffee", back_populates="schedules")
    batch = relationship("Batch")
    machine = relationship("UserMachine", back_populates="schedules")