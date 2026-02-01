"""add artisan telemetry and idempotency support

Revision ID: 004
Revises: 003
Create Date: 2026-01-31 12:00:00

Adds all Artisan roast fields:
- Roast events (charge_temp, TP, DRY, FCs, FCe, SCs, SCe, drop)
- Phase timings (DEV_time, DEV_ratio)
- Quality metrics (whole_color, ground_color, cupping_score)
- Telemetry JSONB (timex, temp1, temp2, air, drum, gas)
- HR IDs for Artisan compatibility (coffee_hr_id, blend_hr_id, location_hr_id)
- Idempotency cache table
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '004'
down_revision = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    roast_columns = [col['name'] for col in inspector.get_columns('roasts')]

    # ========================================
    # 1. DROP old constraint (we need to allow hr_id only roasts)
    # ========================================
    try:
        op.drop_constraint('chk_roast_coffee_or_blend', 'roasts', type_='check')
    except Exception:
        pass  # Constraint might not exist

    # ========================================
    # 2. ALTER TABLE roasts - add Artisan fields
    # ========================================
    
    # Batch identification
    if 'batch_number' not in roast_columns:
        op.add_column('roasts', sa.Column('batch_number', sa.Integer(), server_default='0', nullable=False))
    if 'label' not in roast_columns:
        op.add_column('roasts', sa.Column('label', sa.String(255), server_default='', nullable=False))
    
    # Roast events - temperatures
    if 'charge_temp' not in roast_columns:
        op.add_column('roasts', sa.Column('charge_temp', sa.Float(), nullable=True))
    if 'TP_temp' not in roast_columns:
        op.add_column('roasts', sa.Column('TP_temp', sa.Float(), nullable=True))
    if 'DRY_temp' not in roast_columns:
        op.add_column('roasts', sa.Column('DRY_temp', sa.Float(), nullable=True))
    if 'FCs_temp' not in roast_columns:
        op.add_column('roasts', sa.Column('FCs_temp', sa.Float(), nullable=True))
    if 'FCe_temp' not in roast_columns:
        op.add_column('roasts', sa.Column('FCe_temp', sa.Float(), nullable=True))
    if 'SCs_temp' not in roast_columns:
        op.add_column('roasts', sa.Column('SCs_temp', sa.Float(), nullable=True))
    if 'SCe_temp' not in roast_columns:
        op.add_column('roasts', sa.Column('SCe_temp', sa.Float(), nullable=True))
    if 'drop_temp' not in roast_columns:
        op.add_column('roasts', sa.Column('drop_temp', sa.Float(), nullable=True))
    
    # Roast events - times (seconds)
    if 'TP_time' not in roast_columns:
        op.add_column('roasts', sa.Column('TP_time', sa.Integer(), nullable=True))
    if 'DRY_time' not in roast_columns:
        op.add_column('roasts', sa.Column('DRY_time', sa.Integer(), nullable=True))
    if 'FCs_time' not in roast_columns:
        op.add_column('roasts', sa.Column('FCs_time', sa.Integer(), nullable=True))
    if 'FCe_time' not in roast_columns:
        op.add_column('roasts', sa.Column('FCe_time', sa.Integer(), nullable=True))
    if 'SCs_time' not in roast_columns:
        op.add_column('roasts', sa.Column('SCs_time', sa.Integer(), nullable=True))
    if 'SCe_time' not in roast_columns:
        op.add_column('roasts', sa.Column('SCe_time', sa.Integer(), nullable=True))
    if 'drop_time' not in roast_columns:
        op.add_column('roasts', sa.Column('drop_time', sa.Integer(), nullable=True))
    
    # Phase timings
    if 'DEV_time' not in roast_columns:
        op.add_column('roasts', sa.Column('DEV_time', sa.Integer(), nullable=True))
    if 'DEV_ratio' not in roast_columns:
        op.add_column('roasts', sa.Column('DEV_ratio', sa.Float(), nullable=True))
    
    # Weights
    if 'weight_loss' not in roast_columns:
        op.add_column('roasts', sa.Column('weight_loss', sa.Float(), nullable=True))
    if 'defects_weight' not in roast_columns:
        op.add_column('roasts', sa.Column('defects_weight', sa.Float(), server_default='0', nullable=False))
    
    # HR IDs (Artisan string identifiers)
    if 'coffee_hr_id' not in roast_columns:
        op.add_column('roasts', sa.Column('coffee_hr_id', sa.String(50), nullable=True))
    if 'blend_hr_id' not in roast_columns:
        op.add_column('roasts', sa.Column('blend_hr_id', sa.String(50), nullable=True))
    if 'location_hr_id' not in roast_columns:
        op.add_column('roasts', sa.Column('location_hr_id', sa.String(50), nullable=True))
    if 'blend_spec' not in roast_columns:
        op.add_column('roasts', sa.Column('blend_spec', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    
    # Roaster info
    if 'machine' not in roast_columns:
        op.add_column('roasts', sa.Column('machine', sa.String(100), nullable=True))
    if 'operator' not in roast_columns:
        op.add_column('roasts', sa.Column('operator', sa.String(100), nullable=True))
    if 'email' not in roast_columns:
        op.add_column('roasts', sa.Column('email', sa.String(255), nullable=True))
    
    # Quality metrics
    if 'whole_color' not in roast_columns:
        op.add_column('roasts', sa.Column('whole_color', sa.Integer(), server_default='0', nullable=False))
    if 'ground_color' not in roast_columns:
        op.add_column('roasts', sa.Column('ground_color', sa.Integer(), server_default='0', nullable=False))
    if 'cupping_score' not in roast_columns:
        op.add_column('roasts', sa.Column('cupping_score', sa.Integer(), server_default='0', nullable=False))
    
    # Temperature mode
    if 'mode' not in roast_columns:
        op.add_column('roasts', sa.Column('mode', sa.String(1), server_default='C', nullable=False))
    if 'temp_unit' not in roast_columns:
        op.add_column('roasts', sa.Column('temp_unit', sa.String(1), server_default='C', nullable=False))
    
    # Telemetry (JSONB for timex, temp1, temp2, air, drum, gas arrays)
    if 'telemetry' not in roast_columns:
        op.add_column('roasts', sa.Column('telemetry', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False))
    
    # Timezone offset
    if 'GMT_offset' not in roast_columns:
        op.add_column('roasts', sa.Column('GMT_offset', sa.Integer(), server_default='0', nullable=False))
    
    # Modified timestamp with milliseconds precision
    if 'modified_at' not in roast_columns:
        op.add_column('roasts', sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    
    # ========================================
    # 3. CREATE INDEXES
    # ========================================
    op.create_index('idx_roasts_batch_number', 'roasts', ['batch_number'], if_not_exists=True)
    op.create_index('idx_roasts_machine', 'roasts', ['machine'], if_not_exists=True)
    op.create_index('idx_roasts_operator', 'roasts', ['operator'], if_not_exists=True)
    op.create_index('idx_roasts_coffee_hr_id', 'roasts', ['coffee_hr_id'], if_not_exists=True)
    op.create_index('idx_roasts_blend_hr_id', 'roasts', ['blend_hr_id'], if_not_exists=True)
    op.create_index('idx_roasts_modified_at', 'roasts', ['modified_at'], if_not_exists=True)
    op.create_index('idx_roasts_telemetry_gin', 'roasts', ['telemetry'], postgresql_using='gin', if_not_exists=True)
    op.create_index('idx_roasts_blend_spec_gin', 'roasts', ['blend_spec'], postgresql_using='gin', if_not_exists=True)
    
    # ========================================
    # 4. UPDATE existing records
    # ========================================
    op.execute("""
        UPDATE roasts 
        SET modified_at = COALESCE(updated_at, created_at, NOW())
        WHERE modified_at IS NULL
    """)
    
    # ========================================
    # 5. CREATE idempotency_cache table
    # ========================================
    op.create_table(
        'idempotency_cache',
        sa.Column('idempotency_key', sa.String(64), primary_key=True),
        sa.Column('endpoint', sa.String(100), nullable=False),
        sa.Column('response', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_idempotency_created', 'idempotency_cache', ['created_at'])
    
    # ========================================
    # 6. COMMENTS
    # ========================================
    op.execute("COMMENT ON COLUMN roasts.telemetry IS 'JSONB with timex, temp1, temp2, air, drum, gas arrays for chart rendering'")
    op.execute("COMMENT ON COLUMN roasts.blend_spec IS 'JSONB with blend label and ingredients array for detailed display'")
    op.execute("COMMENT ON COLUMN roasts.coffee_hr_id IS 'Artisan hr_id string for coffee (e.g. C1001)'")
    op.execute("COMMENT ON COLUMN roasts.blend_hr_id IS 'Artisan hr_id string for blend (e.g. B1007)'")
    op.execute("COMMENT ON COLUMN roasts.location_hr_id IS 'Artisan hr_id string for location/store (e.g. L1000)'")
    op.execute("COMMENT ON COLUMN roasts.modified_at IS 'ISO8601 with milliseconds for conflict detection'")
    op.execute("COMMENT ON TABLE idempotency_cache IS 'Cache for idempotent POST requests (24h TTL)'")

    # ========================================
    # 7. Update constraint to allow blend_spec (inline blends from Artisan)
    # ========================================
    try:
        op.drop_constraint('chk_roast_coffee_or_blend', 'roasts', type_='check')
    except Exception:
        pass
    op.create_check_constraint(
        'chk_roast_coffee_or_blend',
        'roasts',
        '(coffee_id IS NOT NULL) OR (blend_id IS NOT NULL) OR (blend_spec IS NOT NULL)',
    )


def downgrade() -> None:
    # Drop idempotency_cache table
    op.drop_index('idx_idempotency_created', table_name='idempotency_cache')
    op.drop_table('idempotency_cache')
    
    # Drop indexes
    op.drop_index('idx_roasts_blend_spec_gin', table_name='roasts', if_exists=True)
    op.drop_index('idx_roasts_telemetry_gin', table_name='roasts', if_exists=True)
    op.drop_index('idx_roasts_modified_at', table_name='roasts', if_exists=True)
    op.drop_index('idx_roasts_blend_hr_id', table_name='roasts', if_exists=True)
    op.drop_index('idx_roasts_coffee_hr_id', table_name='roasts', if_exists=True)
    op.drop_index('idx_roasts_operator', table_name='roasts', if_exists=True)
    op.drop_index('idx_roasts_machine', table_name='roasts', if_exists=True)
    op.drop_index('idx_roasts_batch_number', table_name='roasts', if_exists=True)
    
    # Drop columns (reverse order)
    columns_to_drop = [
        'modified_at', 'GMT_offset', 'telemetry', 'temp_unit', 'mode',
        'cupping_score', 'ground_color', 'whole_color',
        'email', 'operator', 'machine',
        'blend_spec', 'location_hr_id', 'blend_hr_id', 'coffee_hr_id',
        'defects_weight', 'weight_loss',
        'DEV_ratio', 'DEV_time',
        'drop_time', 'SCe_time', 'SCs_time', 'FCe_time', 'FCs_time', 'DRY_time', 'TP_time',
        'drop_temp', 'SCe_temp', 'SCs_temp', 'FCe_temp', 'FCs_temp', 'DRY_temp', 'TP_temp', 'charge_temp',
        'label', 'batch_number',
    ]
    for col in columns_to_drop:
        try:
            op.drop_column('roasts', col)
        except Exception:
            pass
    
    # Restore constraint (original strict XOR for downgrade)
    op.create_check_constraint(
        'chk_roast_coffee_or_blend',
        'roasts',
        '(coffee_id IS NOT NULL AND blend_id IS NULL) OR (coffee_id IS NULL AND blend_id IS NOT NULL)',
    )
