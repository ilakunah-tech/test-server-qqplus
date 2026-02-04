from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional
from datetime import datetime, date, time as time_type, timedelta
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.production_task import ProductionTask, ProductionTaskHistory
from app.models.user_machine import UserMachine
from app.schemas.production_task import (
    ProductionTaskCreate,
    ProductionTaskUpdate,
    ProductionTaskResponse,
    ProductionTaskListResponse,
    ProductionTaskHistoryResponse,
    ProductionTaskHistoryListResponse,
    ProductionTaskMarkCompletedRequest,
    ProductionTaskSnoozeRequest,
)

router = APIRouter()


def _validate_task_create(data: ProductionTaskCreate) -> None:
    """Validate task creation data based on task_type"""
    if data.task_type == "schedule":
        if data.schedule_day_of_week is None or data.schedule_time is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="schedule_day_of_week and schedule_time are required for schedule tasks"
            )
    elif data.task_type == "counter":
        if data.counter_trigger_value is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="counter_trigger_value is required for counter tasks"
            )
        if data.machine_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="machine_id is required for counter tasks"
            )
    elif data.task_type == "one_time":
        if data.scheduled_date is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="scheduled_date is required for one_time tasks"
            )


@router.get("", response_model=ProductionTaskListResponse)
async def list_tasks(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    task_type: Optional[str] = Query(None, pattern="^(schedule|counter|one_time)$"),
    is_active: Optional[bool] = Query(None),
    machine_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List production tasks with optional filters"""
    query = select(ProductionTask).where(ProductionTask.user_id == current_user.id)
    count_query = select(func.count()).select_from(ProductionTask).where(ProductionTask.user_id == current_user.id)
    
    if task_type:
        query = query.where(ProductionTask.task_type == task_type)
        count_query = count_query.where(ProductionTask.task_type == task_type)
    if is_active is not None:
        query = query.where(ProductionTask.is_active == is_active)
        count_query = count_query.where(ProductionTask.is_active == is_active)
    if machine_id:
        query = query.where(ProductionTask.machine_id == machine_id)
        count_query = count_query.where(ProductionTask.machine_id == machine_id)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get items with machine relationship
    query = query.options(selectinload(ProductionTask.machine))
    query = query.order_by(ProductionTask.created_at.desc())
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    items = []
    for task in tasks:
        task_dict = {
            **task.__dict__,
            "machine_name": task.machine.name if task.machine else None
        }
        items.append(ProductionTaskResponse(**task_dict))
    
    return ProductionTaskListResponse(items=items, total=total)


@router.get("/{task_id}", response_model=ProductionTaskResponse)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single production task"""
    query = select(ProductionTask).where(
        and_(
            ProductionTask.id == task_id,
            ProductionTask.user_id == current_user.id
        )
    ).options(selectinload(ProductionTask.machine))
    
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    task_dict = {
        **task.__dict__,
        "machine_name": task.machine.name if task.machine else None
    }
    return ProductionTaskResponse(**task_dict)


@router.post("", response_model=ProductionTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: ProductionTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new production task"""
    _validate_task_create(data)
    
    # Verify machine belongs to user if provided
    if data.machine_id:
        machine_query = select(UserMachine).where(
            and_(
                UserMachine.id == data.machine_id,
                UserMachine.user_id == current_user.id
            )
        )
        machine_result = await db.execute(machine_query)
        machine = machine_result.scalar_one_or_none()
        if not machine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Machine not found"
            )
    
    task = ProductionTask(
        user_id=current_user.id,
        title=data.title,
        description=data.description,
        notification_text=data.notification_text,
        task_type=data.task_type,
        schedule_day_of_week=data.schedule_day_of_week,
        schedule_time=data.schedule_time,
        counter_trigger_value=data.counter_trigger_value,
        counter_reset_on_trigger=data.counter_reset_on_trigger if data.counter_reset_on_trigger is not None else True,
        machine_id=data.machine_id,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        repeat_after_days=data.repeat_after_days,
        is_active=data.is_active,
    )
    
    db.add(task)
    await db.commit()
    await db.refresh(task, ["machine"])
    
    task_dict = {
        **task.__dict__,
        "machine_name": task.machine.name if task.machine else None
    }
    return ProductionTaskResponse(**task_dict)


@router.put("/{task_id}", response_model=ProductionTaskResponse)
async def update_task(
    task_id: UUID,
    data: ProductionTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a production task"""
    query = select(ProductionTask).where(
        and_(
            ProductionTask.id == task_id,
            ProductionTask.user_id == current_user.id
        )
    )
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Verify machine belongs to user if provided
    if data.machine_id:
        machine_query = select(UserMachine).where(
            and_(
                UserMachine.id == data.machine_id,
                UserMachine.user_id == current_user.id
            )
        )
        machine_result = await db.execute(machine_query)
        machine = machine_result.scalar_one_or_none()
        if not machine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Machine not found"
            )
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    
    await db.commit()
    await db.refresh(task, ["machine"])
    
    task_dict = {
        **task.__dict__,
        "machine_name": task.machine.name if task.machine else None
    }
    return ProductionTaskResponse(**task_dict)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a production task"""
    query = select(ProductionTask).where(
        and_(
            ProductionTask.id == task_id,
            ProductionTask.user_id == current_user.id
        )
    )
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    await db.delete(task)
    await db.commit()
    return None


@router.get("/history/list", response_model=ProductionTaskHistoryListResponse)
async def list_history(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    task_id: Optional[UUID] = Query(None),
    machine_id: Optional[UUID] = Query(None),
    completed_only: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List production task history"""
    query = select(ProductionTaskHistory).where(ProductionTaskHistory.user_id == current_user.id)
    count_query = select(func.count()).select_from(ProductionTaskHistory).where(
        ProductionTaskHistory.user_id == current_user.id
    )
    
    if task_id:
        query = query.where(ProductionTaskHistory.task_id == task_id)
        count_query = count_query.where(ProductionTaskHistory.task_id == task_id)
    if machine_id:
        query = query.where(ProductionTaskHistory.machine_id == machine_id)
        count_query = count_query.where(ProductionTaskHistory.machine_id == machine_id)
    if completed_only:
        query = query.where(ProductionTaskHistory.marked_completed_at.isnot(None))
        count_query = count_query.where(ProductionTaskHistory.marked_completed_at.isnot(None))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    query = query.order_by(ProductionTaskHistory.triggered_at.desc())
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    history_items = result.scalars().all()
    
    items = [ProductionTaskHistoryResponse(**item.__dict__) for item in history_items]
    return ProductionTaskHistoryListResponse(items=items, total=total)


@router.post("/history/{history_id}/complete", response_model=ProductionTaskHistoryResponse)
async def mark_completed(
    history_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a history item as completed"""
    query = select(ProductionTaskHistory).where(
        and_(
            ProductionTaskHistory.id == history_id,
            ProductionTaskHistory.user_id == current_user.id
        )
    )
    result = await db.execute(query)
    history_item = result.scalar_one_or_none()
    
    if not history_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History item not found"
        )
    
    if history_item.marked_completed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already marked as completed"
        )
    
    history_item.marked_completed_at = datetime.utcnow()
    history_item.marked_completed_by_user_id = current_user.id
    
    await db.commit()
    await db.refresh(history_item)
    
    return ProductionTaskHistoryResponse(**history_item.__dict__)


@router.post("/history/{history_id}/snooze", response_model=ProductionTaskHistoryResponse)
async def snooze_task(
    history_id: UUID,
    data: ProductionTaskSnoozeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Snooze a task notification"""
    query = select(ProductionTaskHistory).where(
        and_(
            ProductionTaskHistory.id == history_id,
            ProductionTaskHistory.user_id == current_user.id
        )
    )
    result = await db.execute(query)
    history_item = result.scalar_one_or_none()
    
    if not history_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History item not found"
        )
    
    if data.snooze_until <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Snooze time must be in the future"
        )
    
    history_item.snoozed_until = data.snooze_until
    history_item.snoozed_by_user_id = current_user.id
    
    await db.commit()
    await db.refresh(history_item)
    
    return ProductionTaskHistoryResponse(**history_item.__dict__)
