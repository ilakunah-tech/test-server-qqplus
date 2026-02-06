"""Add roast_target to schedules (filter, omni, espresso)

Revision ID: 021
Revises: 020
Create Date: 2026-02-06

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "schedules",
        sa.Column("roast_target", sa.String(20), nullable=True, comment="filter, omni, espresso"),
    )


def downgrade() -> None:
    op.drop_column("schedules", "roast_target")
