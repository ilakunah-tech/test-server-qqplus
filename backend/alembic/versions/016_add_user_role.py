"""Add user role column

Revision ID: 016
Revises: 015
Create Date: 2026-02-02

Adds role column to users (user | admin). Existing users get role 'user'.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(32), nullable=False, server_default="user"),
    )
    # First user (by created_at) becomes admin if no admin exists yet
    op.execute(sa.text("""
        UPDATE users SET role = 'admin'
        WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
    """))


def downgrade() -> None:
    op.drop_column("users", "role")
