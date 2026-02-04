"""Add username column to users

Revision ID: 017
Revises: 016
Create Date: 2026-02-03

Adds username column (unique, nullable for existing users).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("username", sa.String(64), nullable=True),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
