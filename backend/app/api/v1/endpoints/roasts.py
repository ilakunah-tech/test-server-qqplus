from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Optional
from datetime import datetime, date, timezone
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.roast import Roast
from app.models.batch import Batch
from app.models.schedule import Schedule
from app.schemas.roast import RoastCreate, RoastResponse
from app.services.file_service import save_alog_file
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter()


@router.get("/roasts", response_model=dict)
async def list_roasts(
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    coffee_id: Optional[UUID] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List roasts with optional filters (date range, coffee_id, batch_id)."""
    query = select(Roast)
    count_query = select(func.count()).select_from(Roast)
    if date_from:
        q_from = datetime.combine(date_from, datetime.min.time())
        query = query.where(Roast.roasted_at >= q_from)
        count_query = count_query.where(Roast.roasted_at >= q_from)
    if date_to:
        q_to = datetime.combine(date_to, datetime.max.time())
        query = query.where(Roast.roasted_at <= q_to)
        count_query = count_query.where(Roast.roasted_at <= q_to)
    if coffee_id:
        query = query.where(Roast.coffee_id == coffee_id)
        count_query = count_query.where(Roast.coffee_id == coffee_id)
    if batch_id:
        query = query.where(Roast.batch_id == batch_id)
        count_query = count_query.where(Roast.batch_id == batch_id)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    result = await db.execute(
        query.order_by(Roast.roasted_at.desc()).limit(limit).offset(offset)
    )
    roasts = result.scalars().all()
    return {
        "data": {
            "items": [RoastResponse.model_validate(r) for r in roasts],
            "total": total,
        }
    }


@router.post("/roasts")
async def create_roast(
    roast_data: RoastCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new roast with idempotency (client provides UUID).
    Atomically deducts batch weight and auto-completes schedule.
    Returns 200 OK with existing roast when ID already exists; 201 Created for new roast.
    """
    # 1. ИДЕМПОТЕНТНОСТЬ: проверяем первым делом
    existing_result = await db.execute(
        select(Roast).where(Roast.id == roast_data.id)
    )
    existing_roast = existing_result.scalar_one_or_none()
    if existing_roast:
        return JSONResponse(
            status_code=200,
            content={
                "data": RoastResponse.model_validate(existing_roast).model_dump(mode="json")
            },
        )

    # 2. Deduct batch weight (with SELECT FOR UPDATE)
    if roast_data.batch_id:
        batch_result = await db.execute(
            select(Batch).where(Batch.id == roast_data.batch_id).with_for_update()
        )
        batch = batch_result.scalar_one_or_none()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        green_weight = Decimal(str(roast_data.green_weight_kg))
        roasted_weight = Decimal(str(roast_data.roasted_weight_kg or 0))
        if batch.current_weight_kg < green_weight:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient batch weight. Available: {batch.current_weight_kg} kg, "
                       f"requested: {green_weight} kg"
            )

        batch.current_weight_kg -= green_weight
        batch.roasted_total_weight_kg += roasted_weight
        if batch.current_weight_kg == 0:
            batch.status = "depleted"

    # 3. Auto-complete schedule (with SELECT FOR UPDATE)
    if roast_data.schedule_id:
        schedule_result = await db.execute(
            select(Schedule).where(Schedule.id == roast_data.schedule_id).with_for_update()
        )
        if schedule := schedule_result.scalar_one_or_none():
            if schedule.status == "pending":
                schedule.status = "completed"
                schedule.completed_at = datetime.now(timezone.utc)

    # 4. Create roast
    roast = Roast(
        id=roast_data.id,  # UUID from client
        user_id=current_user.id,
        batch_id=roast_data.batch_id,
        coffee_id=roast_data.coffee_id,
        schedule_id=roast_data.schedule_id,
        roasted_at=roast_data.roasted_at,
        green_weight_kg=roast_data.green_weight_kg,
        roasted_weight_kg=roast_data.roasted_weight_kg,
        title=roast_data.title,
        roast_level=roast_data.roast_level,
        notes=roast_data.notes,
    )
    db.add(roast)

    await db.commit()
    await db.refresh(roast)
    return JSONResponse(
        status_code=201,
        content={
            "data": RoastResponse.model_validate(roast).model_dump(mode="json")
        },
    )


@router.get("/roasts/{roast_id}", response_model=dict)
async def get_roast(
    roast_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single roast by ID."""
    result = await db.execute(select(Roast).where(Roast.id == roast_id))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    return {"data": RoastResponse.model_validate(roast)}


@router.delete("/roasts/{roast_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_roast(
    roast_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a roast by ID.
    Optionally restores batch weight when roast has batch_id (green weight back, roasted_total adjusted).
    """
    result = await db.execute(select(Roast).where(Roast.id == roast_id))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")

    if roast.batch_id:
        batch_result = await db.execute(
            select(Batch).where(Batch.id == roast.batch_id).with_for_update()
        )
        if batch := batch_result.scalar_one_or_none():
            batch.current_weight_kg += Decimal(str(roast.green_weight_kg))
            if roast.roasted_weight_kg is not None:
                batch.roasted_total_weight_kg -= Decimal(str(roast.roasted_weight_kg))
            if batch.status == "depleted" and batch.current_weight_kg > 0:
                batch.status = "active"

    await db.delete(roast)
    await db.commit()


@router.post("/roasts/{roast_id}/upload-profile", response_model=dict)
async def upload_profile(
    roast_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload .alog profile file for a roast."""
    result = await db.execute(select(Roast).where(Roast.id == roast_id))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    
    profile_path = await save_alog_file(roast_id, file)
    roast.alog_file_path = profile_path
    await db.commit()

    return {
        "data": {
            "alog_file_path": profile_path,
        }
    }


@router.get("/roasts/{roast_id}/profile")
async def download_profile(
    roast_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download .alog profile file for a roast."""
    result = await db.execute(select(Roast).where(Roast.id == roast_id))
    roast = result.scalar_one_or_none()
    if not roast or not roast.alog_file_path:
        raise HTTPException(status_code=404, detail="Profile file not found")

    file_path = f"/app{roast.alog_file_path}"
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=f"{roast_id}.alog",
    )
