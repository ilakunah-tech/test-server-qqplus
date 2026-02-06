from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from uuid import uuid4
from app.db.base import Base

# Role names stored in DB (use string for simplicity and future roles)
USER_ROLE_USER = "user"
USER_ROLE_ADMIN = "admin"
USER_ROLE_QC = "qc"
USER_ROLE_SM = "sm"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    username = Column(String(64), unique=True, nullable=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String(32), nullable=False, default=USER_ROLE_USER)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    blends = relationship("Blend", back_populates="user", passive_deletes=True)
    machines = relationship("UserMachine", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_admin(self) -> bool:
        return self.role == USER_ROLE_ADMIN
