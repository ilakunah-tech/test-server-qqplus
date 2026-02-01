from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from uuid import uuid4
from app.db.base import Base


class UserMachine(Base):
    """Machine added by a user to their organization (for reference profiles, etc.)."""
    __tablename__ = "user_machines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="machines")

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_machines_user_name"),)
