"""Schemas for roast goals."""
from pydantic import BaseModel, Field
from typing import Dict, Optional
from datetime import datetime
from uuid import UUID


class GoalParameterConfig(BaseModel):
    """Configuration for a single goal parameter."""
    enabled: bool = Field(default=False, description="Включен ли параметр для проверки")
    tolerance: float = Field(description="Допуск (делится пополам: ±tolerance/2)")


class RoastGoalCreate(BaseModel):
    """Schema for creating a roast goal."""
    name: str = Field(..., description="Наименование цели")
    goal_type: str = Field(default="match_reference", description="Тип цели")
    is_active: bool = Field(default=True, description="Цель активна")
    failed_status: str = Field(default="failed", description="Статус при не пройденной цели: 'failed' или 'warning'")
    missing_value_status: str = Field(default="warning", description="Статус при отсутствии значения: 'failed' или 'warning'")
    parameters: Dict[str, GoalParameterConfig] = Field(default_factory=dict, description="Параметры цели")


class RoastGoalUpdate(BaseModel):
    """Schema for updating a roast goal."""
    name: Optional[str] = None
    goal_type: Optional[str] = None
    is_active: Optional[bool] = None
    failed_status: Optional[str] = None
    missing_value_status: Optional[str] = None
    parameters: Optional[Dict[str, GoalParameterConfig]] = None


class RoastGoalResponse(BaseModel):
    """Schema for roast goal response."""
    id: UUID
    name: str
    goal_type: str
    is_active: bool
    failed_status: str
    missing_value_status: str
    parameters: Dict[str, Dict] = Field(default_factory=dict, description="Параметры цели (dict from JSONB)")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GoalCheckResult(BaseModel):
    """Result of checking a roast against goals."""
    status: str = Field(..., description="'green' | 'yellow' | 'red'")
    checked_parameters: Dict[str, Dict] = Field(default_factory=dict, description="Результаты проверки каждого параметра")
    message: Optional[str] = None
