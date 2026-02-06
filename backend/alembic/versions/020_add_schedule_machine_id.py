"""Add machine_id to schedules

Revision ID: 020
Revises: 019
Create Date: 2026-02-06

Optional link to user_machines so schedule items can be assigned to a roaster.
Artisan sync unchanged: all schedule items still returned.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "020"
down_revision = "f0ee7e3f8fbc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "schedules",
        sa.Column(
            "machine_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_machines.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("schedules", "machine_id")
