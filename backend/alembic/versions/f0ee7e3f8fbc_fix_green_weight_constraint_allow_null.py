"""fix_green_weight_constraint_allow_null

Revision ID: f0ee7e3f8fbc
Revises: 019
Create Date: 2026-02-03 13:56:34.951094

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0ee7e3f8fbc'
down_revision: Union[str, None] = '019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Изменить constraint для green_weight_kg, чтобы разрешить NULL и >= 0 вместо > 0
    op.drop_constraint('roast_green_weight_positive', 'roasts', type_='check')
    op.create_check_constraint('roast_green_weight_positive', 'roasts', 'green_weight_kg IS NULL OR green_weight_kg >= 0')


def downgrade() -> None:
    # Вернуть старый constraint
    op.drop_constraint('roast_green_weight_positive', 'roasts', type_='check')
    op.create_check_constraint('roast_green_weight_positive', 'roasts', 'green_weight_kg > 0')
