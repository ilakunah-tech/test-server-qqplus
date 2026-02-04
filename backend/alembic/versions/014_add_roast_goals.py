"""Add roast_goals table for quality control goals

Revision ID: 014
Revises: 013
Create Date: 2026-02-02

Add roast_goals table to store goals for comparing roasts against reference profiles.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "014"
down_revision = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roast_goals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("goal_type", sa.String(50), nullable=False, server_default="match_reference"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("failed_status", sa.String(20), nullable=False, server_default="failed"),
        sa.Column("missing_value_status", sa.String(20), nullable=False, server_default="warning"),
        sa.Column("parameters", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("roast_goals")
