"""
Background service for checking and triggering production tasks.
"""
import asyncio
import logging
from datetime import datetime, date, time, timedelta
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

from app.db.session import AsyncSessionLocal
from app.models.production_task import ProductionTask, ProductionTaskHistory
from app.models.user_machine import UserMachine
from app.ws.notifications import manager

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def trigger_task_notification(
    db: AsyncSession,
    task: ProductionTask,
    trigger_reason: str,
    triggered_by_roast_id: Optional[UUID] = None
) -> None:
    """Trigger a task notification and create history entry"""
    try:
        # Get machine name if applicable
        machine_name = None
        if task.machine_id:
            machine_query = select(UserMachine).where(UserMachine.id == task.machine_id)
            machine_result = await db.execute(machine_query)
            machine = machine_result.scalar_one_or_none()
            machine_name = machine.name if machine else None
        
        # Create history entry
        history = ProductionTaskHistory(
            task_id=task.id,
            user_id=task.user_id,
            title=task.title,
            notification_text=task.notification_text,
            task_type=task.task_type,
            machine_id=task.machine_id,
            machine_name=machine_name,
            triggered_by_roast_id=triggered_by_roast_id,
            trigger_reason=trigger_reason,
        )
        db.add(history)
        
        # Update task
        task.last_triggered_at = datetime.utcnow()
        if triggered_by_roast_id:
            task.last_triggered_roast_id = triggered_by_roast_id
        
        await db.commit()
        await db.refresh(history)
        
        # Send WebSocket notification
        await manager.send_notification(
            event_type="production_task",
            payload={
                "task_id": str(task.id),
                "history_id": str(history.id),
                "title": task.title,
                "notification_text": task.notification_text,
                "task_type": task.task_type,
                "machine_id": str(task.machine_id) if task.machine_id else None,
                "machine_name": machine_name,
                "triggered_at": history.triggered_at.isoformat(),
                "trigger_reason": trigger_reason,
            }
        )
        
        logger.info(f"Triggered task notification: {task.id} - {task.title}")
        
    except Exception as e:
        logger.error(f"Error triggering task notification: {e}", exc_info=True)
        await db.rollback()


async def check_scheduled_tasks() -> None:
    """Check and trigger schedule-type tasks"""
    async with AsyncSessionLocal() as db:
        try:
            now = datetime.utcnow()
            current_day = now.weekday()  # 0=Monday, 6=Sunday
            current_time = now.time().replace(second=0, microsecond=0)
            
            # Get all active schedule tasks
            query = select(ProductionTask).where(
                and_(
                    ProductionTask.task_type == "schedule",
                    ProductionTask.is_active == True,
                    ProductionTask.schedule_day_of_week == current_day,
                    ProductionTask.schedule_time == current_time
                )
            )
            
            result = await db.execute(query)
            tasks = result.scalars().all()
            
            for task in tasks:
                # Check if already triggered today
                today_start = datetime.combine(now.date(), time.min)
                if task.last_triggered_at and task.last_triggered_at >= today_start:
                    continue  # Already triggered today
                
                await trigger_task_notification(
                    db,
                    task,
                    trigger_reason="schedule_time"
                )
                
        except Exception as e:
            logger.error(f"Error checking scheduled tasks: {e}", exc_info=True)


async def check_one_time_tasks() -> None:
    """Check and trigger one_time tasks"""
    async with AsyncSessionLocal() as db:
        try:
            now = datetime.utcnow()
            current_date = now.date()
            current_time = now.time().replace(second=0, microsecond=0)
            
            # Get all active one_time tasks
            query = select(ProductionTask).where(
                and_(
                    ProductionTask.task_type == "one_time",
                    ProductionTask.is_active == True,
                    ProductionTask.scheduled_date == current_date
                )
            )
            
            result = await db.execute(query)
            tasks = result.scalars().all()
            
            for task in tasks:
                # Check if scheduled_time matches (if specified)
                if task.scheduled_time:
                    if task.scheduled_time != current_time:
                        continue
                
                # Check if already triggered today
                today_start = datetime.combine(current_date, time.min)
                if task.last_triggered_at and task.last_triggered_at >= today_start:
                    continue  # Already triggered today
                
                await trigger_task_notification(
                    db,
                    task,
                    trigger_reason="one_time_date"
                )
                
                # Handle repeat_after_days if set
                if task.repeat_after_days:
                    task.scheduled_date = current_date + timedelta(days=task.repeat_after_days)
                    task.last_triggered_at = None  # Reset so it can trigger again
                    await db.commit()
                else:
                    # Deactivate one-time task if not repeating
                    task.is_active = False
                    await db.commit()
                    
        except Exception as e:
            logger.error(f"Error checking one_time tasks: {e}", exc_info=True)


async def check_counter_tasks(db: AsyncSession, roast_id: UUID, machine_id: Optional[UUID] = None) -> None:
    """
    Check and trigger counter-type tasks after a roast is created.
    This should be called from the roast creation endpoint.
    """
    try:
        # Get all active counter tasks for this machine (or all machines if machine_id is None)
        query = select(ProductionTask).where(
            and_(
                ProductionTask.task_type == "counter",
                ProductionTask.is_active == True
            )
        )
        
        if machine_id:
            # Check tasks for this specific machine or tasks without machine filter
            query = query.where(
                or_(
                    ProductionTask.machine_id == machine_id,
                    ProductionTask.machine_id.is_(None)
                )
            )
        
        result = await db.execute(query)
        tasks = result.scalars().all()
        
        for task in tasks:
            # Skip if task is for a different machine
            if task.machine_id and machine_id and task.machine_id != machine_id:
                continue
            
            # Increment counter
            task.counter_current_value += 1
            
            # Check if trigger value reached
            if task.counter_current_value >= task.counter_trigger_value:
                await trigger_task_notification(
                    db,
                    task,
                    trigger_reason="counter_reached",
                    triggered_by_roast_id=roast_id
                )
                
                # Reset counter if configured
                if task.counter_reset_on_trigger:
                    task.counter_current_value = 0
                
                await db.commit()
            else:
                await db.commit()
                
    except Exception as e:
        logger.error(f"Error checking counter tasks: {e}", exc_info=True)
        await db.rollback()


def start_scheduler() -> None:
    """Start the background scheduler"""
    # Check scheduled tasks every minute
    scheduler.add_job(
        check_scheduled_tasks,
        trigger=CronTrigger(second=0),  # Every minute at :00 seconds
        id="check_scheduled_tasks",
        replace_existing=True
    )
    
    # Check one_time tasks every minute
    scheduler.add_job(
        check_one_time_tasks,
        trigger=CronTrigger(second=0),
        id="check_one_time_tasks",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Task scheduler started")


def stop_scheduler() -> None:
    """Stop the background scheduler"""
    scheduler.shutdown()
    logger.info("Task scheduler stopped")
