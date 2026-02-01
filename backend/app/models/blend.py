from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from uuid import uuid4
from app.db.base import Base
from app.models.roast import Roast  # for foreign_keys (Roast has blend_id and reference_for_blend_id -> blends)


class Blend(Base):
    __tablename__ = "blends"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    recipe = Column(JSONB, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="blends")
    roasts = relationship(
        "Roast",
        back_populates="blend",
        foreign_keys=[Roast.blend_id],
    )
