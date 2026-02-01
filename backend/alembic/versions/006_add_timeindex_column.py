"""Add timeindex JSONB column for event indices

Revision ID: 006
Revises: 005
Create Date: 2026-01-31 22:00:00

Adds timeindex column to store Artisan event indices:
[CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL_END]
This allows computing control points from telemetry arrays without .alog file.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "006"
down_revision = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add timeindex JSONB column
    op.add_column(
        "roasts",
        sa.Column("timeindex", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("roasts", "timeindex")
