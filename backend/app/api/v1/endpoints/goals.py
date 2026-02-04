"""Roast goals API endpoints."""
import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.roast_goal import RoastGoal
from app.schemas.roast_goal import (
    RoastGoalCreate,
    RoastGoalUpdate,
    RoastGoalResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[RoastGoalResponse])
async def get_goals(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all roast goals."""
    query = select(RoastGoal)
    if is_active is not None:
        query = query.where(RoastGoal.is_active == is_active)
    query = query.order_by(RoastGoal.created_at.desc())
    
    result = await db.execute(query)
    goals = result.scalars().all()
    return goals


@router.get("/{goal_id}", response_model=RoastGoalResponse)
async def get_goal(
    goal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific roast goal."""
    result = await db.execute(select(RoastGoal).where(RoastGoal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return goal


@router.post("/", response_model=RoastGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: RoastGoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new roast goal."""
    try:
        logger.info(f"Creating goal: {goal_data.name}, parameters: {len(goal_data.parameters)}")
        goal = RoastGoal(
            name=goal_data.name,
            goal_type=goal_data.goal_type,
            is_active=goal_data.is_active,
            failed_status=goal_data.failed_status,
            missing_value_status=goal_data.missing_value_status,
            parameters={
                param_name: {"enabled": param_config.enabled, "tolerance": param_config.tolerance}
                for param_name, param_config in goal_data.parameters.items()
            },
        )
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        logger.info(f"Goal created successfully: {goal.id}")
        return goal
    except Exception as e:
        logger.error(f"Error creating goal: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{goal_id}", response_model=RoastGoalResponse)
async def update_goal(
    goal_id: UUID,
    goal_data: RoastGoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a roast goal."""
    result = await db.execute(select(RoastGoal).where(RoastGoal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    
    update_data = goal_data.model_dump(exclude_unset=True)
    if "parameters" in update_data and update_data["parameters"]:
        # Convert Pydantic models to dicts if needed
        if isinstance(update_data["parameters"], dict):
            new_params = {}
            for param_name, param_config in update_data["parameters"].items():
                if isinstance(param_config, dict):
                    # Already a dict (from JSONB)
                    new_params[param_name] = param_config
                else:
                    # Pydantic model
                    new_params[param_name] = {"enabled": param_config.enabled, "tolerance": param_config.tolerance}
            update_data["parameters"] = new_params
    
    for key, value in update_data.items():
        setattr(goal, key, value)
    
    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a roast goal."""
    result = await db.execute(select(RoastGoal).where(RoastGoal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    
    await db.delete(goal)
    await db.commit()
    return None
