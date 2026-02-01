"""add blends support

Revision ID: 003
Revises: 002
Create Date: 2026-01-29 22:15:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '003'
down_revision = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. CREATE TABLE blends
    op.create_table(
        'blends',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('recipe', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )

    # 2. CREATE INDEXES для blends
    op.create_index('idx_blends_user_id', 'blends', ['user_id'])
    op.create_index('idx_blends_recipe_gin', 'blends', ['recipe'], postgresql_using='gin')

    # 3. ALTER TABLE roasts - добавить blend_id
    op.add_column('roasts', sa.Column('blend_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('roasts_blend_id_fkey', 'roasts', 'blends', ['blend_id'], ['id'], ondelete='SET NULL')
    op.create_index('idx_roasts_blend_id', 'roasts', ['blend_id'])

    # 4. ALTER TABLE roasts - добавить deducted_components
    op.add_column('roasts', sa.Column('deducted_components', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # 5. Исправить данные перед constraint: заполнить coffee_id из batch, удалить невалидные записи
    op.execute("""
        UPDATE roasts
        SET coffee_id = batches.coffee_id
        FROM batches
        WHERE roasts.batch_id = batches.id
          AND roasts.coffee_id IS NULL
    """)
    op.execute("""
        DELETE FROM roasts
        WHERE coffee_id IS NULL AND batch_id IS NULL
    """)

    # 6. Добавить constraint: coffee_id XOR blend_id
    op.create_check_constraint(
        'chk_roast_coffee_or_blend',
        'roasts',
        '(coffee_id IS NOT NULL AND blend_id IS NULL) OR (coffee_id IS NULL AND blend_id IS NOT NULL)',
    )

    # 7. Комментарии
    op.execute("COMMENT ON TABLE blends IS 'Рецепты блендов (смесей зелёного кофе)'")
    op.execute(
        "COMMENT ON COLUMN blends.recipe IS 'JSON массив компонентов: [{\"coffee_id\": \"uuid\", \"percentage\": 60}, ...]'"
    )
    op.execute(
        "COMMENT ON COLUMN roasts.blend_id IS 'Если обжарка бленда, то ID бленда (взаимоисключающе с coffee_id)'"
    )
    op.execute(
        "COMMENT ON COLUMN roasts.deducted_components IS 'История списаний веса по coffee_id (для восстановления при DELETE). Формат: [{\"coffee_id\": \"uuid\", \"deducted_weight_kg\": 2.5}]'"
    )


def downgrade() -> None:
    # Откат в обратном порядке
    op.drop_constraint('chk_roast_coffee_or_blend', 'roasts', type_='check')
    op.drop_column('roasts', 'deducted_components')
    op.drop_index('idx_roasts_blend_id', table_name='roasts')
    op.drop_constraint('roasts_blend_id_fkey', 'roasts', type_='foreignkey')
    op.drop_column('roasts', 'blend_id')
    op.drop_index('idx_blends_recipe_gin', table_name='blends')
    op.drop_index('idx_blends_user_id', table_name='blends')
    op.drop_table('blends')
