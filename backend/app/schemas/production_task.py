from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime, time
from typing import Optional


class ProductionTaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    notification_text: str = Field(..., min_length=1)
    task_type: str = Field(..., pattern="^(schedule|counter|one_time)$")
    machine_id: Optional[UUID] = None


class ProductionTaskScheduleSettings(BaseModel):
    """Settings for schedule type tasks"""
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    time_of_day: time = Field(..., alias="time", description="Time of day (HH:MM)")


class ProductionTaskCounterSettings(BaseModel):
    """Settings for counter type tasks"""
    trigger_value: int = Field(..., gt=0, description="Trigger after N roasts")
    reset_on_trigger: bool = Field(default=True)
    machine_id: UUID = Field(..., description="Required: machine to track")


class ProductionTaskOneTimeSettings(BaseModel):
    """Settings for one_time type tasks"""
    scheduled_date: date
    scheduled_time: Optional[time] = None
    repeat_after_days: Optional[int] = Field(None, gt=0, description="Repeat after N days (null = don't repeat)")


class ProductionTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    notification_text: str = Field(..., min_length=1)
    task_type: str = Field(..., pattern="^(schedule|counter|one_time)$")
    
    # Schedule settings
    schedule_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    schedule_time: Optional[time] = None
    
    # Counter settings
    counter_trigger_value: Optional[int] = Field(None, gt=0)
    counter_reset_on_trigger: Optional[bool] = True
    machine_id: Optional[UUID] = None
    
    # One-time settings
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    repeat_after_days: Optional[int] = Field(None, gt=0)
    
    is_active: bool = Field(default=True)


class ProductionTaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    notification_text: Optional[str] = Field(None, min_length=1)
    is_active: Optional[bool] = None
    
    # Schedule settings
    schedule_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    schedule_time: Optional[time] = None
    
    # Counter settings
    counter_trigger_value: Optional[int] = Field(None, gt=0)
    counter_reset_on_trigger: Optional[bool] = None
    machine_id: Optional[UUID] = None
    counter_current_value: Optional[int] = Field(None, ge=0)
    
    # One-time settings
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    repeat_after_days: Optional[int] = Field(None, gt=0)


class ProductionTaskResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    notification_text: str
    task_type: str
    schedule_day_of_week: Optional[int]
    schedule_time: Optional[time]
    counter_trigger_value: Optional[int]
    counter_current_value: int
    counter_reset_on_trigger: bool
    machine_id: Optional[UUID]
    machine_name: Optional[str] = None  # Populated from relationship
    scheduled_date: Optional[date]
    scheduled_time: Optional[time]
    repeat_after_days: Optional[int]
    is_active: bool
    last_triggered_at: Optional[datetime]
    last_triggered_roast_id: Optional[UUID]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProductionTaskListResponse(BaseModel):
    items: list[ProductionTaskResponse]
    total: int


class ProductionTaskHistoryResponse(BaseModel):
    id: UUID
    task_id: UUID
    user_id: UUID
    title: str
    notification_text: str
    task_type: str
    machine_id: Optional[UUID]
    machine_name: Optional[str]
    triggered_at: datetime
    triggered_by_roast_id: Optional[UUID]
    trigger_reason: Optional[str]
    marked_completed_at: Optional[datetime]
    marked_completed_by_user_id: Optional[UUID]
    snoozed_until: Optional[datetime]
    snoozed_by_user_id: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True


class ProductionTaskHistoryListResponse(BaseModel):
    items: list[ProductionTaskHistoryResponse]
    total: int


class ProductionTaskMarkCompletedRequest(BaseModel):
    history_id: UUID


class ProductionTaskSnoozeRequest(BaseModel):
    history_id: UUID
    snooze_until: datetime
