from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from uuid import uuid4
from app.db.base import Base


class Coffee(Base):
    __tablename__ = "coffees"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    hr_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    origin = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)
    variety = Column(String(100), nullable=True)
    processing = Column(String(50), nullable=True)
    moisture = Column(Float, nullable=True)
    density = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    batches = relationship("Batch", back_populates="coffee", cascade="all, delete-orphan")
    roasts = relationship("Roast", back_populates="coffee", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="coffee", cascade="all, delete-orphan")
