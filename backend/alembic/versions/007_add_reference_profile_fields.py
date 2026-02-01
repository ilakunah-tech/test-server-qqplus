"""Add reference profile fields to roasts

Revision ID: 007
Revises: 006
Create Date: 2026-02-01

Adds is_reference, reference_name, reference_for_coffee_id, reference_for_blend_id,
reference_machine for эталонные профили (reference profiles).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "007"
down_revision = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "roasts",
        sa.Column("is_reference", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "roasts",
        sa.Column("reference_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "roasts",
        sa.Column("reference_for_coffee_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "roasts",
        sa.Column("reference_for_blend_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "roasts",
        sa.Column("reference_machine", sa.String(100), nullable=True),
    )
    op.create_foreign_key(
        "fk_roasts_reference_for_coffee_id",
        "roasts",
        "coffees",
        ["reference_for_coffee_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_roasts_reference_for_blend_id",
        "roasts",
        "blends",
        ["reference_for_blend_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_roasts_reference_lookup",
        "roasts",
        ["is_reference", "reference_for_coffee_id", "reference_machine"],
        postgresql_where=sa.text("is_reference = true"),
    )
    op.create_index(
        "ix_roasts_reference_blend_lookup",
        "roasts",
        ["is_reference", "reference_for_blend_id", "reference_machine"],
        postgresql_where=sa.text("is_reference = true"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_roasts_reference_blend_lookup",
        table_name="roasts",
        postgresql_where=sa.text("is_reference = true"),
    )
    op.drop_index(
        "ix_roasts_reference_lookup",
        table_name="roasts",
        postgresql_where=sa.text("is_reference = true"),
    )
    op.drop_constraint("fk_roasts_reference_for_blend_id", "roasts", type_="foreignkey")
    op.drop_constraint("fk_roasts_reference_for_coffee_id", "roasts", type_="foreignkey")
    op.drop_column("roasts", "reference_machine")
    op.drop_column("roasts", "reference_for_blend_id")
    op.drop_column("roasts", "reference_for_coffee_id")
    op.drop_column("roasts", "reference_name")
    op.drop_column("roasts", "is_reference")
