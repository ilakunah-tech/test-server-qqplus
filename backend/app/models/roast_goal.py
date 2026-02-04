"""Roast goals model for quality control."""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class RoastGoal(Base):
    """
    Roast goal (цель обжарки) - defines target parameters and tolerances
    for comparing actual roasts against reference profiles.
    """
    __tablename__ = "roast_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    
    # Goal identification
    name = Column(String(255), nullable=False)  # Наименование цели
    
    # Goal type: "match_reference" - compare against reference profile
    goal_type = Column(String(50), nullable=False, default="match_reference")
    
    # Status settings
    is_active = Column(Boolean, nullable=False, default=True)  # Цель активна
    failed_status = Column(String(20), nullable=False, default="failed")  # "failed" or "warning" - статус при не пройденной цели
    missing_value_status = Column(String(20), nullable=False, default="warning")  # "failed" or "warning" - статус при отсутствии значения
    
    # Parameters configuration (JSONB)
    # Format:
    # {
    #   "charge_temp": {"enabled": true, "tolerance": 10},  # tolerance делится пополам: ±5
    #   "drop_temp": {"enabled": true, "tolerance": 8},
    #   "TP_temp": {"enabled": true, "tolerance": 5},
    #   "total_time": {"enabled": false, "tolerance": 30},  # seconds
    #   "FCs_time": {"enabled": false, "tolerance": 20},
    #   "DEV_time": {"enabled": true, "tolerance": 30},
    #   "DEV_ratio": {"enabled": true, "tolerance": 2.0},  # percentage points
    #   "DRY_time": {"enabled": false, "tolerance": 20},
    #   "green_weight_kg": {"enabled": false, "tolerance": 0.5},
    #   "roasted_weight_kg": {"enabled": false, "tolerance": 0.3},
    #   "weight_loss": {"enabled": true, "tolerance": 1.5},  # percentage points
    #   "whole_color": {"enabled": false, "tolerance": 5},
    #   "ground_color": {"enabled": false, "tolerance": 5}
    # }
    parameters = Column(JSONB, nullable=False, default={})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
