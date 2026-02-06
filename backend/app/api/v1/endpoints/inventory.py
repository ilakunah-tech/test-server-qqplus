from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Optional, Any
from datetime import datetime, timezone, date
from app.api.deps import get_db, require_full_access
from app.models.user import User
from app.models.coffee import Coffee
from app.models.batch import Batch
from app.models.schedule import Schedule
from app.models.blend import Blend
from app.schemas.coffee import CoffeeCreate, CoffeeUpdate, CoffeeResponse, CoffeeListResponse, AddStockRequest
from app.schemas.batch import (
    BatchCreate,
    BatchUpdate,
    BatchResponse,
    BatchDeductRequest,
)

router = APIRouter()


# ========== ARTISAN-COMPATIBLE STOCK (single endpoint for Artisan desktop) ==========

@router.get("/stock", response_model=dict)
async def get_stock_artisan(
    today: Optional[str] = Query(None),
    lsrt: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """
    Artisan-compatible stock: returns coffees, batches, schedule in the format
    expected by Artisan desktop (success, result.coffees with stock[], result.schedule, etc.).
    """
    # Coffees: list all with stock as single "default" location
    coffees_result = await db.execute(
        select(Coffee).order_by(Coffee.created_at.desc())
    )
    coffees_rows = coffees_result.scalars().all()
    coffees: list[dict[str, Any]] = []
    for c in coffees_rows:
        amount_kg = float(c.stock_weight_kg) if c.stock_weight_kg is not None else 0.0
        coffees.append({
            "id": str(c.id),
            "hr_id": c.hr_id,
            "label": c.label,
            "origin": c.origin,
            "region": c.region,
            "variety": c.variety,
            "processing": c.processing,
            "moisture": float(c.moisture) if c.moisture is not None else None,
            "density": float(c.density) if c.density is not None else None,
            "water_activity": float(c.water_activity) if c.water_activity is not None else None,
            "stock": [
                {
                    "location_hr_id": "default",
                    "location_label": "Stock",
                    "amount": amount_kg,
                }
            ],
        })

    # Schedule: user's schedule in Artisan ScheduledItem format
    # Artisan requires: _id, date, title, amount, location, count, coffee (or blend)
    # Artisan rejects items with date in the past
    today_local = date.today()
    schedule_result = await db.execute(
        select(Schedule, Coffee.hr_id)
        .outerjoin(Coffee, Schedule.coffee_id == Coffee.id)
        .where(
            Schedule.user_id == current_user.id,
            Schedule.scheduled_date >= today_local,  # Artisan rejects past dates
            Schedule.coffee_id.isnot(None),  # Artisan requires coffee or blend
        )
        .order_by(Schedule.scheduled_date.asc())
    )
    ROAST_TARGET_LABELS = {"filter": "фильтр", "omni": "омни", "espresso": "эспрессо"}
    schedule_rows = schedule_result.all()
    schedule: list[dict[str, Any]] = []
    for row in schedule_rows:
        s, coffee_hr_id = row[0], row[1]
        if not coffee_hr_id:
            continue
        base_title = (s.title or "").strip()
        if getattr(s, "roast_target", None) and s.roast_target in ROAST_TARGET_LABELS:
            label = ROAST_TARGET_LABELS.get(s.roast_target, s.roast_target)
            title = f"{base_title} ({label})" if base_title else label
        else:
            title = base_title
        schedule.append({
            "_id": str(s.id),
            "date": s.scheduled_date.isoformat() if s.scheduled_date else "",
            "title": title,
            "amount": float(s.scheduled_weight_kg) if s.scheduled_weight_kg is not None else 0.0,
            "coffee": coffee_hr_id,
            "location": "default",  # Required by Artisan; matches stock location_hr_id
            "count": 1,  # Required by Artisan; number of roasts planned
            "status": s.status,
        })

    # Blends: user's blends in Artisan format (label, hr_id, ingredients with coffee as hr_id)
    blends_result = await db.execute(
        select(Blend)
        .where(Blend.user_id == current_user.id)
        .order_by(Blend.created_at.desc())
    )
    blends_rows = blends_result.scalars().all()
    blends: list[dict[str, Any]] = []
    for b in blends_rows:
        ingredients: list[dict[str, Any]] = []
        for comp in (b.recipe or []):
            coffee_id = comp.get("coffee_id")
            percentage = comp.get("percentage", 0)
            coffee_hr_id = None
            if coffee_id:
                coffee_uuid = coffee_id if isinstance(coffee_id, UUID) else UUID(str(coffee_id))
                c_res = await db.execute(select(Coffee.hr_id).where(Coffee.id == coffee_uuid))
                coffee_hr_id = c_res.scalar_one_or_none() or str(coffee_id)
            ingredients.append({
                "ratio": float(percentage) / 100.0 if percentage is not None else 0,
                "coffee": coffee_hr_id or "",
            })
        blends.append({
            "hr_id": str(b.id),
            "label": b.name or "",
            "ingredients": ingredients,
        })

    server_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    result = {
        "coffees": coffees,
        "batches": [],
        "schedule": schedule,
        "blends": blends,
        "replBlends": [],
        "serverTime": server_time_ms,
    }
    return {
        "success": True,
        "result": result,
        "ol": {},
        "pu": "",
        "notifications": {"unqualified": 0, "machines": []},
    }


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
    current_user: User = Depends(require_full_access),
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
    current_user: User = Depends(require_full_access),
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
        label=coffee_data.label,
        origin=coffee_data.origin,
        region=coffee_data.region,
        variety=coffee_data.variety,
        processing=coffee_data.processing,
        moisture=coffee_data.moisture,
        density=coffee_data.density,
        water_activity=coffee_data.water_activity,
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
    current_user: User = Depends(require_full_access),
):
    """Get a coffee by ID."""
    result = await db.execute(select(Coffee).where(Coffee.id == coffee_id))
    coffee = result.scalar_one_or_none()
    if not coffee:
        raise HTTPException(status_code=404, detail="Coffee not found")
    
    return {"data": CoffeeResponse.model_validate(coffee)}


@router.put("/coffees/{coffee_id}", response_model=dict)
async def update_coffee(
    coffee_id: UUID,
    coffee_data: CoffeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Update a coffee by ID."""
    result = await db.execute(select(Coffee).where(Coffee.id == coffee_id))
    coffee = result.scalar_one_or_none()
    if not coffee:
        raise HTTPException(status_code=404, detail="Coffee not found")
    
    update_data = coffee_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(coffee, key, value)
    
    await db.commit()
    await db.refresh(coffee)
    return {"data": CoffeeResponse.model_validate(coffee)}


@router.post("/coffees/{coffee_id}/add-stock", response_model=dict)
async def add_coffee_stock(
    coffee_id: UUID,
    body: AddStockRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Add green bean stock (приход) when coffee arrives at warehouse."""
    result = await db.execute(select(Coffee).where(Coffee.id == coffee_id).with_for_update())
    coffee = result.scalar_one_or_none()
    if not coffee:
        raise HTTPException(status_code=404, detail="Coffee not found")
    current = float(coffee.stock_weight_kg or 0)
    coffee.stock_weight_kg = Decimal(str(current + body.weight_kg))
    await db.commit()
    await db.refresh(coffee)
    return {"data": CoffeeResponse.model_validate(coffee)}


@router.delete("/coffees/{coffee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coffee(
    coffee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Delete a coffee by ID."""
    result = await db.execute(select(Coffee).where(Coffee.id == coffee_id))
    coffee = result.scalar_one_or_none()
    if not coffee:
        raise HTTPException(status_code=404, detail="Coffee not found")
    
    batch_count_result = await db.execute(
        select(func.count()).select_from(Batch).where(Batch.coffee_id == coffee_id)
    )
    if (batch_count_result.scalar() or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete coffee with existing batches",
        )
    
    await db.delete(coffee)
    await db.commit()


# ========== BATCHES ==========

@router.get("/batches", response_model=dict)
async def list_batches(
    coffee_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """List batches with optional filters (coffee_id, status)."""
    query = select(Batch)
    count_query = select(func.count()).select_from(Batch)
    if coffee_id:
        query = query.where(Batch.coffee_id == coffee_id)
        count_query = count_query.where(Batch.coffee_id == coffee_id)
    if status:
        query = query.where(Batch.status == status)
        count_query = count_query.where(Batch.status == status)
    
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
    current_user: User = Depends(require_full_access),
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
        initial_weight_kg=batch_data.initial_weight_kg,
        current_weight_kg=batch_data.initial_weight_kg,
        roasted_total_weight_kg=batch_data.roasted_total_weight_kg,
        status=batch_data.status,
        arrival_date=batch_data.arrival_date,
        supplier=batch_data.supplier,
        notes=batch_data.notes,
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    
    return {"data": BatchResponse.model_validate(batch)}


@router.get("/batches/{batch_id}", response_model=dict)
async def get_batch(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Get a single batch by ID."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"data": BatchResponse.model_validate(batch)}


@router.put("/batches/{batch_id}", response_model=dict)
async def update_batch(
    batch_id: UUID,
    batch_data: BatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Update a batch by ID."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    update_data = batch_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(batch, key, value)
    
    await db.commit()
    await db.refresh(batch)
    return {"data": BatchResponse.model_validate(batch)}


@router.put("/batches/{batch_id}/deduct", response_model=dict)
async def deduct_batch_weight(
    batch_id: UUID,
    deduct_data: BatchDeductRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """
    Atomically deduct weight from batch (with SELECT FOR UPDATE).
    This prevents race conditions when multiple roasts happen simultaneously.
    """
    result = await db.execute(
        select(Batch).where(Batch.id == batch_id).with_for_update()
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    deduct_weight = Decimal(str(deduct_data.weight_kg))
    if batch.current_weight_kg < deduct_weight:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient weight. Available: {batch.current_weight_kg} kg, "
                   f"requested: {deduct_weight} kg"
        )

    batch.current_weight_kg -= deduct_weight
    if batch.current_weight_kg == 0:
        batch.status = "depleted"

    await db.commit()
    await db.refresh(batch)
    return {"data": BatchResponse.model_validate(batch)}


@router.delete("/batches/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_batch(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Delete a batch by ID."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    from app.models.roast import Roast
    roast_count_result = await db.execute(
        select(func.count()).select_from(Roast).where(Roast.batch_id == batch_id)
    )
    if (roast_count_result.scalar() or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete batch with existing roasts",
        )
    await db.delete(batch)
    await db.commit()
