from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID, uuid4
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
        query = query.where(Roast.roasted_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.where(Roast.roasted_at <= datetime.combine(date_to, datetime.max.time()))

    count_query = select(func.count()).select_from(Roast)
    if date_from:
        count_query = count_query.where(Roast.roasted_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        count_query = count_query.where(Roast.roasted_at <= datetime.combine(date_to, datetime.max.time()))

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


@router.post("/roasts", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_roast(
    roast_data: RoastCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new roast."""
    batch = None
    if roast_data.batch_id:
        batch_result = await db.execute(select(Batch).where(Batch.id == roast_data.batch_id))
        batch = batch_result.scalar_one_or_none()
        if not batch:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    roasted_w = (roast_data.roasted_weight_kg or 0)
    roast = Roast(
        id=uuid4(),
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

    if batch is not None:
        batch.roasted_total_weight_kg += roasted_w
        batch.current_weight_kg -= roast_data.green_weight_kg
        if batch.current_weight_kg <= 0:
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile file not found")

    file_path = f"/app{roast.alog_file_path}"
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=f"{roast_id}.alog",
    )
