from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class IdempotencyCache(Base):
    """
    Cache table for idempotent POST requests.
    
    Stores the response for a given idempotency key so that
    retried requests return the same response without re-processing.
    
    TTL: 24 hours (cleaned up by cron job or background task).
    """
    __tablename__ = "idempotency_cache"

    idempotency_key = Column(String(64), primary_key=True)
    endpoint = Column(String(100), nullable=False)
    response = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
