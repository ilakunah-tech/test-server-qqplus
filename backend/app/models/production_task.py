from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Boolean, Time, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class ProductionTask(Base):
    """
    Production task model for maintenance and operational reminders.
    
    Supports three types:
    - schedule: Recurring tasks based on day of week and time
    - counter: Tasks triggered after N roasts on a specific machine
    - one_time: One-time tasks that can be scheduled for a specific date
    """
    __tablename__ = "production_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Basic information
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    notification_text = Column(Text, nullable=False)  # Text shown in notification
    
    # Task type: 'schedule', 'counter', 'one_time'
    task_type = Column(String(20), nullable=False, index=True)
    
    # Settings for schedule type (recurring weekly)
    schedule_day_of_week = Column(Integer, nullable=True)  # 0-6 (Monday=0, Sunday=6)
    schedule_time = Column(Time, nullable=True)  # Time of day (e.g., 12:00)
    
    # Settings for counter type
    counter_trigger_value = Column(Integer, nullable=True)  # Trigger after N roasts
    counter_current_value = Column(Integer, nullable=False, default=0)
    counter_reset_on_trigger = Column(Boolean, default=True)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("user_machines.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Settings for one_time type
    scheduled_date = Column(Date, nullable=True)  # Date for one-time task
    scheduled_time = Column(Time, nullable=True)  # Time for one-time task
    repeat_after_days = Column(Integer, nullable=True)  # Repeat after N days (null = don't repeat)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    last_triggered_roast_id = Column(UUID(as_uuid=True), nullable=True)  # For counter tasks
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    machine = relationship("UserMachine")


class ProductionTaskHistory(Base):
    """
    History of triggered production tasks.
    """
    __tablename__ = "production_task_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("production_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Task snapshot at trigger time
    title = Column(String(255), nullable=False)
    notification_text = Column(Text, nullable=False)
    task_type = Column(String(20), nullable=False)
    machine_id = Column(UUID(as_uuid=True), nullable=True)
    machine_name = Column(String(255), nullable=True)  # Snapshot of machine name
    
    # Trigger information
    triggered_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    triggered_by_roast_id = Column(UUID(as_uuid=True), nullable=True)  # For counter tasks
    trigger_reason = Column(String(100), nullable=True)  # e.g., "counter_reached", "schedule_time", "one_time_date"
    
    # User actions
    marked_completed_at = Column(DateTime(timezone=True), nullable=True)
    marked_completed_by_user_id = Column(UUID(as_uuid=True), nullable=True)
    snoozed_until = Column(DateTime(timezone=True), nullable=True)
    snoozed_by_user_id = Column(UUID(as_uuid=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    task = relationship("ProductionTask")
    user = relationship("User")
