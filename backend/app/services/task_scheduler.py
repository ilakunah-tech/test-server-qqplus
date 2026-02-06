"""
Background service for checking and triggering production tasks.

Uses the TZ env-var (set in docker-compose) to determine local time.
Falls back to Europe/Moscow when TZ is unset (Docker default = UTC).
"""
import os
import structlog
from datetime import datetime, date, time, timedelta
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import pytz  # already installed via APScheduler

from app.db.session import AsyncSessionLocal
from app.models.production_task import ProductionTask, ProductionTaskHistory
from app.models.user_machine import UserMachine
from app.ws.notifications import manager

logger = structlog.get_logger(__name__)

# Determine the timezone we operate in (defaults to Moscow when TZ is unset or "UTC")
_tz_name = os.environ.get("TZ") or "Europe/Moscow"
try:
    LOCAL_TZ = pytz.timezone(_tz_name)
except pytz.exceptions.UnknownTimeZoneError:
    LOCAL_TZ = pytz.timezone("Europe/Moscow")


def _local_now() -> datetime:
    """Return current date-time in the configured local timezone (naive)."""
    return datetime.now(LOCAL_TZ).replace(tzinfo=None)

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
        task.last_triggered_at = _local_now()
        if triggered_by_roast_id:
            task.last_triggered_roast_id = triggered_by_roast_id
        
        await db.commit()
        await db.refresh(history)
        
        # Send WebSocket notification (only to task owner)
        await manager.send_notification(
            event_type="production_task",
            payload={
                "task_id": str(task.id),
                "history_id": str(history.id),
                "user_id": str(task.user_id),
                "title": task.title,
                "notification_text": task.notification_text,
                "task_type": task.task_type,
                "machine_id": str(task.machine_id) if task.machine_id else None,
                "machine_name": machine_name,
                "triggered_at": history.triggered_at.isoformat(),
                "trigger_reason": trigger_reason,
            },
            target_user_id=str(task.user_id),
        )
        
        logger.info("Triggered task notification", task_id=str(task.id), title=task.title, ws_connections=len(manager.active_connections))
        
    except Exception as e:
        logger.error("Error triggering task notification", error=str(e), exc_info=True)
        await db.rollback()


async def check_scheduled_tasks() -> None:
    """Check and trigger schedule-type tasks.
    Uses datetime.now() so the container TZ env var controls the timezone.
    """
    async with AsyncSessionLocal() as db:
        try:
            now = _local_now()
            current_day = now.weekday()  # 0=Monday, 6=Sunday
            current_time = now.time().replace(second=0, microsecond=0)

            logger.debug("Checking scheduled tasks", day=current_day, time=str(current_time), tz=_tz_name)

            # Get all active schedule tasks for today's weekday
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
                # Check if already triggered today (strip tz from DB value for safe compare)
                today_start = datetime.combine(now.date(), time.min)
                lta = task.last_triggered_at.replace(tzinfo=None) if task.last_triggered_at and task.last_triggered_at.tzinfo else task.last_triggered_at
                if lta and lta >= today_start:
                    continue  # Already triggered today

                logger.info("Triggering scheduled task", task_id=str(task.id), title=task.title)
                await trigger_task_notification(
                    db,
                    task,
                    trigger_reason="schedule_time"
                )

        except Exception as e:
            logger.error("Error checking scheduled tasks", error=str(e), exc_info=True)


async def check_one_time_tasks() -> None:
    """Check and trigger one_time tasks.
    Fires when scheduled_date <= today AND (no time set OR scheduled_time <= now).
    Uses datetime.now() so the container TZ env var controls the timezone.
    """
    async with AsyncSessionLocal() as db:
        try:
            now = _local_now()
            current_date = now.date()
            current_time = now.time().replace(second=0, microsecond=0)

            logger.info("Checking one_time tasks", date=str(current_date), time=str(current_time), tz=_tz_name)

            # Get all active one_time tasks where the date has arrived
            query = select(ProductionTask).where(
                and_(
                    ProductionTask.task_type == "one_time",
                    ProductionTask.is_active == True,
                    ProductionTask.scheduled_date <= current_date
                )
            )

            result = await db.execute(query)
            tasks = result.scalars().all()

            for task in tasks:
                # If scheduled_time is set and the date is today, check the time
                if task.scheduled_time and task.scheduled_date == current_date:
                    task_time = task.scheduled_time.replace(second=0, microsecond=0)
                    if task_time > current_time:
                        continue  # Not yet time today

                # Check if already triggered today (strip tz from DB value for safe compare)
                today_start = datetime.combine(current_date, time.min)
                lta = task.last_triggered_at.replace(tzinfo=None) if task.last_triggered_at and task.last_triggered_at.tzinfo else task.last_triggered_at
                if lta and lta >= today_start:
                    continue  # Already triggered today

                logger.info("Triggering one_time task", task_id=str(task.id), title=task.title)
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
            logger.error("Error checking one_time tasks", error=str(e), exc_info=True)


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
        logger.error("Error checking counter tasks", error=str(e), exc_info=True)
        await db.rollback()


async def remind_uncompleted_tasks() -> None:
    """Re-send WebSocket notifications for uncompleted task history items.

    Runs every 5 minutes.  Only items triggered within the last 24 hours
    that have NOT been marked completed (and are not currently snoozed)
    will receive a reminder.
    """
    async with AsyncSessionLocal() as db:
        try:
            # Use SQL func.now() so Postgres handles tz-aware comparison internally
            cutoff = func.now() - timedelta(hours=24)

            query = select(ProductionTaskHistory).where(
                and_(
                    ProductionTaskHistory.marked_completed_at.is_(None),
                    ProductionTaskHistory.triggered_at >= cutoff,
                    or_(
                        ProductionTaskHistory.snoozed_until.is_(None),
                        ProductionTaskHistory.snoozed_until <= func.now(),
                    ),
                )
            )

            result = await db.execute(query)
            items = result.scalars().all()

            sent = 0
            for item in items:
                await manager.send_notification(
                    event_type="production_task",
                    payload={
                        "task_id": str(item.task_id),
                        "history_id": str(item.id),
                        "user_id": str(item.user_id),
                        "title": item.title,
                        "notification_text": item.notification_text,
                        "task_type": item.task_type,
                        "machine_id": str(item.machine_id) if item.machine_id else None,
                        "machine_name": item.machine_name,
                        "triggered_at": item.triggered_at.isoformat() if item.triggered_at else None,
                        "trigger_reason": item.trigger_reason,
                        "is_reminder": True,
                    },
                    target_user_id=str(item.user_id),
                )
                sent += 1

            if sent:
                logger.info("Sent reminder notifications", count=sent)

        except Exception as e:
            logger.error("Error sending task reminders", error=str(e), exc_info=True)


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

    # Remind about uncompleted tasks every 5 minutes
    scheduler.add_job(
        remind_uncompleted_tasks,
        trigger=CronTrigger(minute="*/5", second=30),  # at :30s to avoid overlap with checks
        id="remind_uncompleted_tasks",
        replace_existing=True
    )

    scheduler.start()
    logger.info("Task scheduler started", timezone=_tz_name, local_now=str(_local_now()))


def stop_scheduler() -> None:
    """Stop the background scheduler"""
    scheduler.shutdown()
    logger.info("Task scheduler stopped")
