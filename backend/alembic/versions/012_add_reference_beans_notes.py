"""Add reference_beans_notes field to roasts

Revision ID: 012
Revises: 011
Create Date: 2026-02-02

Add reference_beans_notes field to store notes that will be displayed in Beans field
when a reference profile is selected in Artisan Roast Properties dialog.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("roasts", sa.Column("reference_beans_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("roasts", "reference_beans_notes")
