"""Add roast_profiles table for .alog blob storage

Revision ID: 009
Revises: 008
Create Date: 2026-02-01

Store .alog content in DB; serve via temp file on request then delete temp.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009"
down_revision = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roast_profiles",
        sa.Column("roast_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roasts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("roast_profiles")
