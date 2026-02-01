"""split telemetry into separate JSONB columns

Revision ID: 005
Revises: 004
Create Date: 2026-01-31 12:00:00

Replaces single telemetry JSONB with separate columns:
timex, temp1, temp2, extra_temp1, extra_temp2, air, drum, gas, fan, heater
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TELEMETRY_COLUMNS = [
    "timex",
    "temp1",
    "temp2",
    "extra_temp1",
    "extra_temp2",
    "air",
    "drum",
    "gas",
    "fan",
    "heater",
]


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    roast_columns = [col["name"] for col in inspector.get_columns("roasts")]

    # 1. Add separate JSONB columns
    for col in TELEMETRY_COLUMNS:
        if col not in roast_columns:
            op.add_column(
                "roasts",
                sa.Column(col, postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            )

    # 2. Migrate data from telemetry JSONB into new columns (if telemetry exists)
    if "telemetry" in roast_columns:
        for col in TELEMETRY_COLUMNS:
            op.execute(
                sa.text(
                    'UPDATE roasts SET "'
                    + col
                    + '" = telemetry->:key WHERE telemetry IS NOT NULL AND telemetry ? :key'
                ).bindparams(key=col)
            )

    # 3. Drop GIN index on telemetry if exists
    try:
        op.drop_index("idx_roasts_telemetry_gin", table_name="roasts", if_exists=True)
    except Exception:
        pass

    # 4. Drop telemetry column
    if "telemetry" in roast_columns:
        op.drop_column("roasts", "telemetry")


def downgrade() -> None:
    # Re-add telemetry column
    op.add_column(
        "roasts",
        sa.Column(
            "telemetry",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )

    # Rebuild telemetry from separate columns (PostgreSQL: jsonb_build_object)
    op.execute(
        sa.text("""
        UPDATE roasts SET telemetry = jsonb_build_object(
            'timex', COALESCE(timex, '[]'::jsonb),
            'temp1', COALESCE(temp1, '[]'::jsonb),
            'temp2', COALESCE(temp2, '[]'::jsonb),
            'extra_temp1', COALESCE(extra_temp1, '[]'::jsonb),
            'extra_temp2', COALESCE(extra_temp2, '[]'::jsonb),
            'air', COALESCE(air, '[]'::jsonb),
            'drum', COALESCE(drum, '[]'::jsonb),
            'gas', COALESCE(gas, '[]'::jsonb),
            'fan', COALESCE(fan, '[]'::jsonb),
            'heater', COALESCE(heater, '[]'::jsonb)
        )
        """)
    )

    op.create_index(
        "idx_roasts_telemetry_gin",
        "roasts",
        ["telemetry"],
        postgresql_using="gin",
        if_not_exists=True,
    )

    for col in TELEMETRY_COLUMNS:
        try:
            op.drop_column("roasts", col)
        except Exception:
            pass
