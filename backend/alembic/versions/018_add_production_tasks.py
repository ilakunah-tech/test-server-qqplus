"""Add production tasks and history

Revision ID: 018
Revises: 017
Create Date: 2026-02-03

Adds production_tasks and production_task_history tables for maintenance reminders.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "018"
down_revision = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Production tasks table
    op.create_table(
        "production_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notification_text", sa.Text(), nullable=False),
        sa.Column("task_type", sa.String(20), nullable=False),
        sa.Column("schedule_day_of_week", sa.Integer(), nullable=True),
        sa.Column("schedule_time", sa.Time(), nullable=True),
        sa.Column("counter_trigger_value", sa.Integer(), nullable=True),
        sa.Column("counter_current_value", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("counter_reset_on_trigger", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("scheduled_time", sa.Time(), nullable=True),
        sa.Column("repeat_after_days", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_triggered_roast_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["machine_id"], ["user_machines.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_production_tasks_user_id", "production_tasks", ["user_id"])
    op.create_index("ix_production_tasks_task_type", "production_tasks", ["task_type"])
    op.create_index("ix_production_tasks_is_active", "production_tasks", ["is_active"])
    op.create_index("ix_production_tasks_machine_id", "production_tasks", ["machine_id"])

    # Production task history table
    op.create_table(
        "production_task_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("notification_text", sa.Text(), nullable=False),
        sa.Column("task_type", sa.String(20), nullable=False),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("machine_name", sa.String(255), nullable=True),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("triggered_by_roast_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trigger_reason", sa.String(100), nullable=True),
        sa.Column("marked_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("marked_completed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("snoozed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["task_id"], ["production_tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_production_task_history_task_id", "production_task_history", ["task_id"])
    op.create_index("ix_production_task_history_user_id", "production_task_history", ["user_id"])
    op.create_index("ix_production_task_history_triggered_at", "production_task_history", ["triggered_at"])


def downgrade() -> None:
    op.drop_index("ix_production_task_history_triggered_at", table_name="production_task_history")
    op.drop_index("ix_production_task_history_user_id", table_name="production_task_history")
    op.drop_index("ix_production_task_history_task_id", table_name="production_task_history")
    op.drop_table("production_task_history")
    op.drop_index("ix_production_tasks_machine_id", table_name="production_tasks")
    op.drop_index("ix_production_tasks_is_active", table_name="production_tasks")
    op.drop_index("ix_production_tasks_task_type", table_name="production_tasks")
    op.drop_index("ix_production_tasks_user_id", table_name="production_tasks")
    op.drop_table("production_tasks")
