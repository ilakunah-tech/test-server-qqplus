from sqlalchemy import Column, String, Numeric, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class Coffee(Base):
    __tablename__ = "coffees"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hr_id = Column(String(50), unique=True, nullable=False, index=True)
    label = Column(String(255), nullable=False, index=True)
    origin = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)
    variety = Column(String(100), nullable=True)
    processing = Column(String(100), nullable=True)
    moisture = Column(Numeric(4, 2), nullable=True)
    density = Column(Numeric(6, 2), nullable=True)
    stock_weight_kg = Column(Numeric(10, 3), nullable=False, default=0.000)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    batches = relationship("Batch", back_populates="coffee", cascade="all, delete-orphan")
    roasts = relationship("Roast", back_populates="coffee", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="coffee", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('stock_weight_kg >= 0', name='coffee_stock_weight_positive'),
    )