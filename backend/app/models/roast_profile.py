"""Store .alog profile blob per roast (optional; fallback to disk)."""
from sqlalchemy import Column, DateTime, LargeBinary, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class RoastProfile(Base):
    """Binary .alog profile for a roast. Served via temp file then discarded."""
    __tablename__ = "roast_profiles"

    roast_id = Column(
        UUID(as_uuid=True),
        ForeignKey("roasts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    data = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
