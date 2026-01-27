from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Optional
from datetime import date, datetime, timezone
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.schedule import Schedule
from app.models.coffee import Coffee
from app.models.batch import Batch
from app.models.roast import Roast
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleListResponse,
    ScheduleCompleteRequest,
)

router = APIRouter()


@router.get("/schedule", response_model=dict)
async def list_schedule(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List schedule items with optional date filtering."""
    query = select(Schedule).where(Schedule.user_id == current_user.id)
    if date_from:
        query = query.where(Schedule.scheduled_date >= date_from)
    if date_to:
        query = query.where(Schedule.scheduled_date <= date_to)

    count_query = select(func.count()).select_from(Schedule).where(Schedule.user_id == current_user.id)
    if date_from:
        count_query = count_query.where(Schedule.scheduled_date >= date_from)
    if date_to:
        count_query = count_query.where(Schedule.scheduled_date <= date_to)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(Schedule.scheduled_date.asc()).limit(limit).offset(offset)
    )
    schedules = result.scalars().all()
    
    return {
        "data": {
            "items": [ScheduleResponse.model_validate(s) for s in schedules],
            "total": total,
        }
    }


@router.post("/schedule", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule_data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new schedule item."""
    if schedule_data.coffee_id:
        coffee_result = await db.execute(select(Coffee).where(Coffee.id == schedule_data.coffee_id))
        if not coffee_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coffee not found")
    if schedule_data.batch_id:
        batch_result = await db.execute(select(Batch).where(Batch.id == schedule_data.batch_id))
        if not batch_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    schedule = Schedule(
        user_id=current_user.id,
        title=schedule_data.title,
        scheduled_date=schedule_data.scheduled_date,
        scheduled_weight_kg=schedule_data.scheduled_weight_kg,
        coffee_id=schedule_data.coffee_id,
        batch_id=schedule_data.batch_id,
        notes=schedule_data.notes,
        status="pending",
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    
    return {
        "data": ScheduleResponse.model_validate(schedule)
    }


@router.put("/schedule/{schedule_id}/complete", response_model=dict)
async def complete_schedule(
    schedule_id: UUID,
    complete_data: ScheduleCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a schedule item as completed and link it to a roast."""
    result = await db.execute(
        select(Schedule).where(Schedule.id == schedule_id, Schedule.user_id == current_user.id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    
    # Verify roast exists
    roast_result = await db.execute(select(Roast).where(Roast.id == complete_data.roast_id))
    roast = roast_result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roast not found")
    
    schedule.status = "completed"
    schedule.completed_at = datetime.now(timezone.utc)
    if complete_data.notes:
        schedule.notes = complete_data.notes
    roast.schedule_id = schedule_id

    await db.commit()
    await db.refresh(schedule)
    
    return {
        "data": ScheduleResponse.model_validate(schedule)
    }


@router.put("/schedule/{schedule_id}", response_model=dict)
async def update_schedule(
    schedule_id: UUID,
    schedule_data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a schedule item."""
    result = await db.execute(
        select(Schedule).where(Schedule.id == schedule_id, Schedule.user_id == current_user.id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    
    update_data = schedule_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(schedule, key, value)
    
    await db.commit()
    await db.refresh(schedule)
    
    return {
        "data": ScheduleResponse.model_validate(schedule)
    }
