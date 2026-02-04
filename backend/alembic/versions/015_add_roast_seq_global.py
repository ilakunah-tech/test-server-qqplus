"""Add roast_seq global counter for all roasts

Revision ID: 015
Revises: 014
Create Date: 2026-02-02

Adds roast_seq - a global sequential number for every roast (shared across all users).
Uses PostgreSQL SEQUENCE for thread-safe assignment.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create sequence
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS roast_seq_global START 1"))

    # 2. Add column (nullable initially for backfill)
    op.add_column(
        "roasts",
        sa.Column("roast_seq", sa.Integer(), nullable=True),
    )

    # 3. Backfill existing roasts with sequential numbers (by created_at, then id)
    op.execute(sa.text("""
        WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
            FROM roasts
        )
        UPDATE roasts r SET roast_seq = n.rn FROM numbered n WHERE r.id = n.id
    """))

    # 4. Set sequence to continue from max+1
    op.execute(sa.text("""
        SELECT setval(
            'roast_seq_global',
            COALESCE((SELECT MAX(roast_seq) FROM roasts), 1)
        )
    """))

    # 5. Make NOT NULL and set default for new inserts
    op.alter_column(
        "roasts",
        "roast_seq",
        nullable=False,
        server_default=sa.text("nextval('roast_seq_global')"),
    )

    op.create_index("idx_roasts_roast_seq", "roasts", ["roast_seq"], unique=True)


def downgrade() -> None:
    op.drop_index("idx_roasts_roast_seq", table_name="roasts")
    op.drop_column("roasts", "roast_seq")
    op.execute(sa.text("DROP SEQUENCE IF EXISTS roast_seq_global"))
