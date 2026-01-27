"""add hr_id, stock_weight_kg, schedules, roasts tables

Revision ID: 002
Revises: 001_initial
Create Date: 2026-01-26 18:20:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '002'
down_revision = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========================================
    # 1. ALTER coffees table
    # ========================================
    
    # Переименовать name → label (если существует)
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    coffee_columns = [col['name'] for col in inspector.get_columns('coffees')]
    
    if 'name' in coffee_columns and 'label' not in coffee_columns:
        op.alter_column('coffees', 'name', new_column_name='label')
    
    # Добавить stock_weight_kg (если не существует)
    if 'stock_weight_kg' not in coffee_columns:
        op.add_column('coffees', sa.Column('stock_weight_kg', sa.Numeric(10, 3), server_default='0.000', nullable=False))
    
    # Изменить moisture и density с Float на Numeric
    op.alter_column('coffees', 'moisture', type_=sa.Numeric(4, 2), existing_type=sa.Float(), postgresql_using='moisture::numeric(4,2)')
    op.alter_column('coffees', 'density', type_=sa.Numeric(6, 2), existing_type=sa.Float(), postgresql_using='density::numeric(6,2)')
    
    # Изменить processing length
    op.alter_column('coffees', 'processing', type_=sa.String(100), existing_type=sa.String(50))
    
    # Добавить check constraint
    op.create_check_constraint('coffee_stock_weight_positive', 'coffees', 'stock_weight_kg >= 0')
    
    # ========================================
    # 2. ALTER batches table
    # ========================================
    
    # Проверить существующие колонки
    batch_columns = [col['name'] for col in inspector.get_columns('batches')]
    
    # Переименовать green_stock_kg → current_weight_kg (если green_stock_kg существует и current_weight_kg НЕ существует)
    # Это нужно, так как миграция 001 создала green_stock_kg, но мы хотим использовать current_weight_kg
    if 'green_stock_kg' in batch_columns and 'current_weight_kg' not in batch_columns:
        op.alter_column('batches', 'green_stock_kg', new_column_name='current_weight_kg')
        # Обновить batch_columns после переименования
        batch_columns = [col['name'] for col in inspector.get_columns('batches')]
    
    # Добавить initial_weight_kg (если не существует)
    if 'initial_weight_kg' not in batch_columns:
        op.add_column('batches', sa.Column('initial_weight_kg', sa.Numeric(10, 3), nullable=True))
        
        # Заполнить initial_weight_kg = current_weight_kg (current_weight_kg должна существовать)
        if 'current_weight_kg' in batch_columns:
            op.execute("UPDATE batches SET initial_weight_kg = current_weight_kg WHERE initial_weight_kg IS NULL")
        
        # Сделать NOT NULL после заполнения
        op.alter_column('batches', 'initial_weight_kg', nullable=False)
    
    # Переименовать roasted_total_kg → roasted_total_weight_kg (только если roasted_total_kg существует и roasted_total_weight_kg НЕ существует)
    if 'roasted_total_kg' in batch_columns and 'roasted_total_weight_kg' not in batch_columns:
        op.alter_column('batches', 'roasted_total_kg', new_column_name='roasted_total_weight_kg')
    
    # Обновить batch_columns после переименования
    batch_columns = [col['name'] for col in inspector.get_columns('batches')]
    
    # Изменить current_weight_kg с Float на Numeric (если существует)
    if 'current_weight_kg' in batch_columns:
        op.alter_column('batches', 'current_weight_kg', type_=sa.Numeric(10, 3), existing_type=sa.Float(), postgresql_using='current_weight_kg::numeric(10,3)')
    
    # Изменить roasted_total_weight_kg с Float на Numeric (если существует)
    if 'roasted_total_weight_kg' in batch_columns:
        op.alter_column('batches', 'roasted_total_weight_kg', type_=sa.Numeric(10, 3), existing_type=sa.Float(), postgresql_using='roasted_total_weight_kg::numeric(10,3)', server_default='0.000')
    
    # Удалить expiration_date (если существует)
    if 'expiration_date' in batch_columns:
        op.drop_column('batches', 'expiration_date')
    
    # Изменить supplier length
    op.alter_column('batches', 'supplier', type_=sa.String(200), existing_type=sa.String(255))
    
    # Обновить foreign key с CASCADE
    op.drop_constraint('batches_coffee_id_fkey', 'batches', type_='foreignkey')
    op.create_foreign_key('batches_coffee_id_fkey', 'batches', 'coffees', ['coffee_id'], ['id'], ondelete='CASCADE')
    
    # Добавить check constraints (с проверкой на существование)
    try:
        op.create_check_constraint('batch_current_weight_positive', 'batches', 'current_weight_kg >= 0')
    except Exception:
        pass  # Constraint might already exist
    
    try:
        op.create_check_constraint('batch_initial_weight_positive', 'batches', 'initial_weight_kg > 0')
    except Exception:
        pass  # Constraint might already exist
    
    try:
        op.create_check_constraint('batch_roasted_weight_positive', 'batches', 'roasted_total_weight_kg >= 0')
    except Exception:
        pass  # Constraint might already exist
    
    # ========================================
    # 3. ALTER schedules table
    # ========================================
    
    schedule_columns = [col['name'] for col in inspector.get_columns('schedules')]
    
    # Добавить user_id
    if 'user_id' not in schedule_columns:
        op.add_column('schedules', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key('schedules_user_id_fkey', 'schedules', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    
    # Сделать coffee_id и batch_id nullable и обновить foreign keys
    op.alter_column('schedules', 'coffee_id', nullable=True)
    try:
        op.drop_constraint('schedules_coffee_id_fkey', 'schedules', type_='foreignkey')
    except Exception:
        pass  # Constraint might not exist
    op.create_foreign_key('schedules_coffee_id_fkey', 'schedules', 'coffees', ['coffee_id'], ['id'], ondelete='SET NULL')
    
    op.alter_column('schedules', 'batch_id', nullable=True)
    try:
        op.drop_constraint('schedules_batch_id_fkey', 'schedules', type_='foreignkey')
    except Exception:
        pass  # Constraint might not exist
    op.create_foreign_key('schedules_batch_id_fkey', 'schedules', 'batches', ['batch_id'], ['id'], ondelete='SET NULL')
    
    # Добавить title
    if 'title' not in schedule_columns:
        op.add_column('schedules', sa.Column('title', sa.String(255), nullable=True))
        op.execute("UPDATE schedules SET title = CONCAT('Schedule ', id::text) WHERE title IS NULL")
        op.alter_column('schedules', 'title', nullable=False)
    
    # Переименовать planned_date → scheduled_date и изменить на Date
    if 'planned_date' in schedule_columns:
        op.alter_column('schedules', 'planned_date', new_column_name='scheduled_date')
        op.execute("""
            ALTER TABLE schedules 
            ALTER COLUMN scheduled_date TYPE DATE 
            USING scheduled_date::DATE
        """)
    
    # Добавить scheduled_weight_kg
    if 'scheduled_weight_kg' not in schedule_columns:
        op.add_column('schedules', sa.Column('scheduled_weight_kg', sa.Numeric(10, 3), nullable=True))
    
    # Переименовать completed_roast_id → completed_at
    if 'completed_roast_id' in schedule_columns:
        try:
            op.drop_constraint('schedules_completed_roast_id_fkey', 'schedules', type_='foreignkey')
        except Exception:
            pass  # Constraint might not exist
        op.drop_column('schedules', 'completed_roast_id')
        op.add_column('schedules', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    
    # Добавить updated_at
    if 'updated_at' not in schedule_columns:
        op.add_column('schedules', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    
    # Заполнить user_id для существующих записей
    op.execute("""
        UPDATE schedules 
        SET user_id = (SELECT id FROM users LIMIT 1)
        WHERE user_id IS NULL
    """)
    op.alter_column('schedules', 'user_id', nullable=False)
    
    # ========================================
    # 4. ALTER roasts table
    # ========================================
    
    roast_columns = [col['name'] for col in inspector.get_columns('roasts')]
    
    # Добавить user_id
    if 'user_id' not in roast_columns:
        op.add_column('roasts', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key('roasts_user_id_fkey', 'roasts', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    
    # Добавить schedule_id
    if 'schedule_id' not in roast_columns:
        op.add_column('roasts', sa.Column('schedule_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key('roasts_schedule_id_fkey', 'roasts', 'schedules', ['schedule_id'], ['id'], ondelete='SET NULL')
    
    # Сделать coffee_id и batch_id nullable и обновить foreign keys
    op.alter_column('roasts', 'coffee_id', nullable=True)
    try:
        op.drop_constraint('roasts_coffee_id_fkey', 'roasts', type_='foreignkey')
    except Exception:
        pass  # Constraint might not exist
    op.create_foreign_key('roasts_coffee_id_fkey', 'roasts', 'coffees', ['coffee_id'], ['id'], ondelete='SET NULL')
    
    op.alter_column('roasts', 'batch_id', nullable=True)
    try:
        op.drop_constraint('roasts_batch_id_fkey', 'roasts', type_='foreignkey')
    except Exception:
        pass  # Constraint might not exist
    op.create_foreign_key('roasts_batch_id_fkey', 'roasts', 'batches', ['batch_id'], ['id'], ondelete='SET NULL')
    
    # Переименовать roast_date → roasted_at
    if 'roast_date' in roast_columns:
        op.alter_column('roasts', 'roast_date', new_column_name='roasted_at')
    
    # Изменить green_weight_kg и roasted_weight_kg с Float на Numeric
    op.alter_column('roasts', 'green_weight_kg', type_=sa.Numeric(10, 3), existing_type=sa.Float(), postgresql_using='green_weight_kg::numeric(10,3)', nullable=False)
    op.alter_column('roasts', 'roasted_weight_kg', type_=sa.Numeric(10, 3), existing_type=sa.Float(), postgresql_using='roasted_weight_kg::numeric(10,3)', nullable=True)
    
    # Добавить title и roast_level
    if 'title' not in roast_columns:
        op.add_column('roasts', sa.Column('title', sa.String(255), nullable=True))
    if 'roast_level' not in roast_columns:
        op.add_column('roasts', sa.Column('roast_level', sa.String(50), nullable=True))
    
    # Переименовать profile_file → alog_file_path
    if 'profile_file' in roast_columns:
        op.alter_column('roasts', 'profile_file', new_column_name='alog_file_path')
        op.alter_column('roasts', 'alog_file_path', type_=sa.String(500), existing_type=sa.String(512))
    
    # Удалить неиспользуемые колонки
    columns_to_drop = ['operator', 'machine', 'weight_loss_percent', 'roast_time_sec', 
                       'drop_temp', 'first_crack_temp', 'first_crack_time', 'agtron']
    for col in columns_to_drop:
        if col in roast_columns:
            op.drop_column('roasts', col)
    
    # Добавить updated_at
    if 'updated_at' not in roast_columns:
        op.add_column('roasts', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    
    # Заполнить user_id для существующих записей
    op.execute("""
        UPDATE roasts 
        SET user_id = (SELECT id FROM users LIMIT 1)
        WHERE user_id IS NULL
    """)
    op.alter_column('roasts', 'user_id', nullable=False)
    
    # Добавить check constraints
    op.create_check_constraint('roast_green_weight_positive', 'roasts', 'green_weight_kg > 0')
    op.create_check_constraint('roast_roasted_weight_positive', 'roasts', 'roasted_weight_kg >= 0')


def downgrade() -> None:
    # Откат в обратном порядке
    
    # Удалить constraints roasts
    op.drop_constraint('roast_roasted_weight_positive', 'roasts', type_='check')
    op.drop_constraint('roast_green_weight_positive', 'roasts', type_='check')
    
    # Откат roasts table
    op.drop_column('roasts', 'updated_at')
    op.add_column('roasts', sa.Column('agtron', sa.Integer(), nullable=True))
    op.add_column('roasts', sa.Column('first_crack_time', sa.Integer(), nullable=True))
    op.add_column('roasts', sa.Column('first_crack_temp', sa.Integer(), nullable=True))
    op.add_column('roasts', sa.Column('drop_temp', sa.Integer(), nullable=True))
    op.add_column('roasts', sa.Column('roast_time_sec', sa.Integer(), nullable=True))
    op.add_column('roasts', sa.Column('weight_loss_percent', sa.Float(), nullable=True))
    op.add_column('roasts', sa.Column('machine', sa.String(100), nullable=True))
    op.add_column('roasts', sa.Column('operator', sa.String(100), nullable=True))
    op.alter_column('roasts', 'alog_file_path', new_column_name='profile_file')
    op.alter_column('roasts', 'profile_file', type_=sa.String(512), existing_type=sa.String(500))
    op.drop_column('roasts', 'roast_level')
    op.drop_column('roasts', 'title')
    op.alter_column('roasts', 'roasted_weight_kg', type_=sa.Float(), existing_type=sa.Numeric(10, 3), nullable=False)
    op.alter_column('roasts', 'green_weight_kg', type_=sa.Float(), existing_type=sa.Numeric(10, 3))
    op.alter_column('roasts', 'roasted_at', new_column_name='roast_date')
    op.drop_constraint('roasts_batch_id_fkey', 'roasts', type_='foreignkey')
    op.create_foreign_key('roasts_batch_id_fkey', 'roasts', 'batches', ['batch_id'], ['id'])
    op.alter_column('roasts', 'batch_id', nullable=False)
    op.drop_constraint('roasts_coffee_id_fkey', 'roasts', type_='foreignkey')
    op.create_foreign_key('roasts_coffee_id_fkey', 'roasts', 'coffees', ['coffee_id'], ['id'])
    op.alter_column('roasts', 'coffee_id', nullable=False)
    op.drop_constraint('roasts_schedule_id_fkey', 'roasts', type_='foreignkey')
    op.drop_column('roasts', 'schedule_id')
    op.drop_constraint('roasts_user_id_fkey', 'roasts', type_='foreignkey')
    op.drop_column('roasts', 'user_id')
    
    # Откат schedules table
    op.alter_column('schedules', 'user_id', nullable=True)
    op.drop_constraint('schedules_user_id_fkey', 'schedules', type_='foreignkey')
    op.drop_column('schedules', 'user_id')
    op.drop_column('schedules', 'updated_at')
    op.add_column('schedules', sa.Column('completed_roast_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('schedules_completed_roast_id_fkey', 'schedules', 'roasts', ['completed_roast_id'], ['id'])
    op.drop_column('schedules', 'completed_at')
    op.drop_column('schedules', 'scheduled_weight_kg')
    op.execute("""
        ALTER TABLE schedules 
        ALTER COLUMN scheduled_date TYPE TIMESTAMP WITH TIME ZONE 
        USING scheduled_date::TIMESTAMP WITH TIME ZONE
    """)
    op.alter_column('schedules', 'scheduled_date', new_column_name='planned_date')
    op.drop_column('schedules', 'title')
    op.drop_constraint('schedules_batch_id_fkey', 'schedules', type_='foreignkey')
    op.create_foreign_key('schedules_batch_id_fkey', 'schedules', 'batches', ['batch_id'], ['id'])
    op.alter_column('schedules', 'batch_id', nullable=True)
    op.drop_constraint('schedules_coffee_id_fkey', 'schedules', type_='foreignkey')
    op.create_foreign_key('schedules_coffee_id_fkey', 'schedules', 'coffees', ['coffee_id'], ['id'])
    op.alter_column('schedules', 'coffee_id', nullable=False)
    
    # Откат batches table
    try:
        op.drop_constraint('batch_roasted_weight_positive', 'batches', type_='check')
    except Exception:
        pass
    try:
        op.drop_constraint('batch_initial_weight_positive', 'batches', type_='check')
    except Exception:
        pass
    try:
        op.drop_constraint('batch_current_weight_positive', 'batches', type_='check')
    except Exception:
        pass
    
    op.drop_constraint('batches_coffee_id_fkey', 'batches', type_='foreignkey')
    op.create_foreign_key('batches_coffee_id_fkey', 'batches', 'coffees', ['coffee_id'], ['id'])
    op.alter_column('batches', 'supplier', type_=sa.String(255), existing_type=sa.String(200))
    op.add_column('batches', sa.Column('expiration_date', sa.Date(), nullable=True))
    op.drop_column('batches', 'initial_weight_kg')
    
    # Переименовать roasted_total_weight_kg → roasted_total_kg (если существует)
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    batch_columns = [col['name'] for col in inspector.get_columns('batches')]
    
    if 'roasted_total_weight_kg' in batch_columns:
        op.alter_column('batches', 'roasted_total_weight_kg', type_=sa.Float(), existing_type=sa.Numeric(10, 3), server_default='0.0')
        op.alter_column('batches', 'roasted_total_weight_kg', new_column_name='roasted_total_kg')
    
    # НЕ переименовывать current_weight_kg → green_stock_kg, так как green_stock_kg не существует в миграции 001
    # current_weight_kg остается как есть (изменение типа откатывается автоматически при изменении типа обратно на Float)
    if 'current_weight_kg' in batch_columns:
        op.alter_column('batches', 'current_weight_kg', type_=sa.Float(), existing_type=sa.Numeric(10, 3), server_default='0.0')
    
    # Откат coffees table
    op.drop_constraint('coffee_stock_weight_positive', 'coffees', type_='check')
    op.alter_column('coffees', 'processing', type_=sa.String(50), existing_type=sa.String(100))
    op.alter_column('coffees', 'density', type_=sa.Float(), existing_type=sa.Numeric(6, 2))
    op.alter_column('coffees', 'moisture', type_=sa.Float(), existing_type=sa.Numeric(4, 2))
    op.drop_column('coffees', 'stock_weight_kg')
    op.alter_column('coffees', 'label', new_column_name='name')
