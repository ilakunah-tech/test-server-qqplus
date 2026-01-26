"""Initial migration

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Coffees table
    op.create_table(
        'coffees',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('hr_id', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('origin', sa.String(100), nullable=True),
        sa.Column('region', sa.String(100), nullable=True),
        sa.Column('variety', sa.String(100), nullable=True),
        sa.Column('processing', sa.String(50), nullable=True),
        sa.Column('moisture', sa.Float(), nullable=True),
        sa.Column('density', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Batches table
    op.create_table(
        'batches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('coffee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('coffees.id'), nullable=False, index=True),
        sa.Column('lot_number', sa.String(100), nullable=False, index=True),
        sa.Column('green_stock_kg', sa.Float(), nullable=False, default=0.0),
        sa.Column('roasted_total_kg', sa.Float(), nullable=False, default=0.0),
        sa.Column('status', sa.String(20), nullable=False, default='active', index=True),
        sa.Column('arrival_date', sa.Date(), nullable=True),
        sa.Column('expiration_date', sa.Date(), nullable=True),
        sa.Column('supplier', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Roasts table
    op.create_table(
        'roasts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('batches.id'), nullable=False, index=True),
        sa.Column('coffee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('coffees.id'), nullable=False, index=True),
        sa.Column('roast_date', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('operator', sa.String(100), nullable=True),
        sa.Column('machine', sa.String(100), nullable=True),
        sa.Column('green_weight_kg', sa.Float(), nullable=False),
        sa.Column('roasted_weight_kg', sa.Float(), nullable=False),
        sa.Column('weight_loss_percent', sa.Float(), nullable=True),
        sa.Column('roast_time_sec', sa.Integer(), nullable=True),
        sa.Column('drop_temp', sa.Integer(), nullable=True),
        sa.Column('first_crack_temp', sa.Integer(), nullable=True),
        sa.Column('first_crack_time', sa.Integer(), nullable=True),
        sa.Column('agtron', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('profile_file', sa.String(512), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # Schedules table
    op.create_table(
        'schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('coffee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('coffees.id'), nullable=False, index=True),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('batches.id'), nullable=True),
        sa.Column('planned_date', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('status', sa.String(20), nullable=False, default='pending', index=True),
        sa.Column('completed_roast_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('roasts.id'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('schedules')
    op.drop_table('roasts')
    op.drop_table('batches')
    op.drop_table('coffees')
    op.drop_table('users')
