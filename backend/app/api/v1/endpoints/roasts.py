from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from uuid import UUID
from typing import Optional
from datetime import datetime, date
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.roast import Roast
from app.models.batch import Batch
from app.schemas.roast import RoastCreate, RoastUpdate, RoastResponse, RoastListResponse, ProfileUploadResponse
from app.services.file_service import save_alog_file
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/roasts", response_model=dict)
async def list_roasts(
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List roasts with optional date filtering."""
    query = select(Roast)
    
    if date_from:
        query = query.where(Roast.roast_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.where(Roast.roast_date <= datetime.combine(date_to, datetime.max.time()))
    
    count_query = select(func.count()).select_from(Roast)
    if date_from:
        count_query = count_query.where(Roast.roast_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        count_query = count_query.where(Roast.roast_date <= datetime.combine(date_to, datetime.max.time()))
    
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    result = await db.execute(
        query.order_by(Roast.roast_date.desc()).limit(limit).offset(offset)
    )
    roasts = result.scalars().all()
    
    return {
        "data": {
            "items": [RoastResponse.model_validate(r) for r in roasts],
            "total": total,
        }
    }


@router.post("/roasts", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_roast(
    roast_data: RoastCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new roast."""
    # Verify batch and coffee exist
    batch_result = await db.execute(select(Batch).where(Batch.id == roast_data.batch_id))
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    
    # Calculate weight_loss_percent
    weight_loss_percent = None
    if roast_data.green_weight_kg > 0:
        weight_loss_percent = ((roast_data.green_weight_kg - roast_data.roasted_weight_kg) / roast_data.green_weight_kg) * 100
    
    roast = Roast(
        batch_id=roast_data.batch_id,
        coffee_id=roast_data.coffee_id,
        roast_date=roast_data.roast_date,
        operator=roast_data.operator,
        machine=roast_data.machine,
        green_weight_kg=roast_data.green_weight_kg,
        roasted_weight_kg=roast_data.roasted_weight_kg,
        weight_loss_percent=weight_loss_percent,
        roast_time_sec=roast_data.roast_time_sec,
        drop_temp=roast_data.drop_temp,
        first_crack_temp=roast_data.first_crack_temp,
        first_crack_time=roast_data.first_crack_time,
        agtron=roast_data.agtron,
        notes=roast_data.notes,
    )
    db.add(roast)
    await db.commit()
    await db.refresh(roast)
    
    # Update batch roasted_total_kg
    batch.roasted_total_kg += roast_data.roasted_weight_kg
    batch.green_stock_kg -= roast_data.green_weight_kg
    if batch.green_stock_kg <= 0:
        batch.status = "depleted"
    await db.commit()
    
    return {
        "data": RoastResponse.model_validate(roast)
    }


@router.get("/roasts/{roast_id}", response_model=dict)
async def get_roast(
    roast_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a roast by ID."""
    result = await db.execute(select(Roast).where(Roast.id == roast_id))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roast not found")
    
    return {
        "data": RoastResponse.model_validate(roast)
    }


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roast not found")
    
    profile_path = await save_alog_file(roast_id, file)
    roast.profile_file = profile_path
    await db.commit()
    
    return {
        "data": {
            "profile_file": profile_path,
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
    if not roast or not roast.profile_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile file not found")
    
    file_path = f"/app{roast.profile_file}"
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=f"{roast_id}.alog",
    )
