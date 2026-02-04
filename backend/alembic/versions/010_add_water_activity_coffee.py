"""Add water_activity to coffees table

Revision ID: 010
Revises: 009
Create Date: 2026-02-01

Water activity (aw) - unitless 0.00-1.00.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("coffees", sa.Column("water_activity", sa.Numeric(3, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("coffees", "water_activity")
