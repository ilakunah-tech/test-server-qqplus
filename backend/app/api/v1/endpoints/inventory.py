from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.coffee import Coffee
from app.models.batch import Batch
from app.schemas.coffee import CoffeeCreate, CoffeeUpdate, CoffeeResponse, CoffeeListResponse
from app.schemas.batch import BatchCreate, BatchUpdate, BatchResponse, BatchListResponse

router = APIRouter()


def generate_hr_id(origin: str, region: str, year: int, sequence: int) -> str:
    """Generate human-readable ID like ETH-YRG-2024-001"""
    origin_code = (origin or "UNK")[:3].upper()
    region_code = (region or "UNK")[:3].upper()
    return f"{origin_code}-{region_code}-{year}-{sequence:03d}"


# ========== COFFEES ==========

@router.get("/coffees", response_model=dict)
async def list_coffees(
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all coffees."""
    count_result = await db.execute(select(func.count()).select_from(Coffee))
    total = count_result.scalar() or 0
    
    result = await db.execute(
        select(Coffee)
        .order_by(Coffee.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    coffees = result.scalars().all()
    
    return {
        "data": {
            "items": [CoffeeResponse.model_validate(c) for c in coffees],
            "total": total,
        }
    }


@router.post("/coffees", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_coffee(
    coffee_data: CoffeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new coffee."""
    # Generate hr_id
    year = datetime.utcnow().year
    count_result = await db.execute(
        select(func.count()).select_from(Coffee).where(
            func.extract("year", Coffee.created_at) == year
        )
    )
    sequence = (count_result.scalar() or 0) + 1
    hr_id = generate_hr_id(coffee_data.origin, coffee_data.region, year, sequence)
    
    coffee = Coffee(
        hr_id=hr_id,
        name=coffee_data.name,
        origin=coffee_data.origin,
        region=coffee_data.region,
        variety=coffee_data.variety,
        processing=coffee_data.processing,
        moisture=coffee_data.moisture,
        density=coffee_data.density,
    )
    db.add(coffee)
    await db.commit()
    await db.refresh(coffee)
    
    return {
        "data": CoffeeResponse.model_validate(coffee)
    }


@router.get("/coffees/{coffee_id}", response_model=dict)
async def get_coffee(
    coffee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a coffee by ID."""
    result = await db.execute(select(Coffee).where(Coffee.id == coffee_id))
    coffee = result.scalar_one_or_none()
    if not coffee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coffee not found")
    
    return {
        "data": CoffeeResponse.model_validate(coffee)
    }


# ========== BATCHES ==========

@router.get("/batches", response_model=dict)
async def list_batches(
    coffee_id: Optional[UUID] = Query(None),
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List batches, optionally filtered by coffee_id."""
    query = select(Batch)
    if coffee_id:
        query = query.where(Batch.coffee_id == coffee_id)
    
    count_query = select(func.count()).select_from(Batch)
    if coffee_id:
        count_query = count_query.where(Batch.coffee_id == coffee_id)
    
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    result = await db.execute(
        query.order_by(Batch.created_at.desc()).limit(limit).offset(offset)
    )
    batches = result.scalars().all()
    
    return {
        "data": {
            "items": [BatchResponse.model_validate(b) for b in batches],
            "total": total,
        }
    }


@router.post("/batches", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_batch(
    batch_data: BatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new batch."""
    # Verify coffee exists
    coffee_result = await db.execute(select(Coffee).where(Coffee.id == batch_data.coffee_id))
    coffee = coffee_result.scalar_one_or_none()
    if not coffee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coffee not found")
    
    batch = Batch(
        coffee_id=batch_data.coffee_id,
        lot_number=batch_data.lot_number,
        green_stock_kg=batch_data.green_stock_kg,
        roasted_total_kg=batch_data.roasted_total_kg,
        status=batch_data.status,
        arrival_date=batch_data.arrival_date,
        expiration_date=batch_data.expiration_date,
        supplier=batch_data.supplier,
        notes=batch_data.notes,
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    
    return {
        "data": BatchResponse.model_validate(batch)
    }


@router.put("/batches/{batch_id}", response_model=dict)
async def update_batch(
    batch_id: UUID,
    batch_data: BatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a batch."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    
    update_data = batch_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(batch, key, value)
    
    await db.commit()
    await db.refresh(batch)
    
    return {
        "data": BatchResponse.model_validate(batch)
    }
