"""Add QC cupping and espresso fields to roasts

Revision ID: 011
Revises: 010
Create Date: 2026-02-01

cupping_date, cupping_verdict (green/yellow/red), espresso_date, espresso_verdict, espresso_notes
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("roasts", sa.Column("cupping_date", sa.Date(), nullable=True))
    op.add_column("roasts", sa.Column("cupping_verdict", sa.String(20), nullable=True))
    op.add_column("roasts", sa.Column("espresso_date", sa.Date(), nullable=True))
    op.add_column("roasts", sa.Column("espresso_verdict", sa.String(20), nullable=True))
    op.add_column("roasts", sa.Column("espresso_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("roasts", "espresso_notes")
    op.drop_column("roasts", "espresso_verdict")
    op.drop_column("roasts", "espresso_date")
    op.drop_column("roasts", "cupping_verdict")
    op.drop_column("roasts", "cupping_date")
