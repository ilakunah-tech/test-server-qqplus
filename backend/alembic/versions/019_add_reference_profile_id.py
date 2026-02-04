"""Add reference_profile_id to roasts

Revision ID: 019
Revises: 018
Create Date: 2026-02-03

Adds reference_profile_id field to store UUID of selected reference profile for background.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "019"
down_revision = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "roasts",
        sa.Column(
            "reference_profile_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="UUID выбранного эталонного профиля для background"
        ),
    )
    op.create_foreign_key(
        "fk_roasts_reference_profile_id",
        "roasts",
        "roasts",
        ["reference_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_roasts_reference_profile_id",
        "roasts",
        ["reference_profile_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_roasts_reference_profile_id", table_name="roasts")
    op.drop_constraint("fk_roasts_reference_profile_id", "roasts", type_="foreignkey")
    op.drop_column("roasts", "reference_profile_id")
