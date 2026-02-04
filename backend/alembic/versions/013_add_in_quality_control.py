"""Add in_quality_control field to roasts

Revision ID: 013
Revises: 012
Create Date: 2026-02-02

Add in_quality_control boolean field to mark roasts that should appear in Quality Control table.
Roasters manually select which roasts go to QC.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("roasts", sa.Column("in_quality_control", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("roasts", "in_quality_control")
