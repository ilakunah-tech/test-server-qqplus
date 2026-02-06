from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import get_db, require_full_access
from app.models.user import User
from app.models.blend import Blend
from app.models.coffee import Coffee
from app.models.roast import Roast
from app.schemas.blend import BlendCreate, BlendUpdate
from app.services.blend_calculator import calculate_blend_available_weight

router = APIRouter()


async def _enrich_recipe_with_coffee_names(recipe: list, db: AsyncSession) -> list[dict]:
    """Enrich each recipe component with coffee_name from Coffee.label."""
    enriched = []
    for component in recipe:
        raw_id = component.get("coffee_id")
        if not raw_id:
            enriched.append({**dict(component), "coffee_name": "Unknown"})
            continue
        coffee_id = raw_id if isinstance(raw_id, UUID) else UUID(str(raw_id))
        result = await db.execute(select(Coffee).where(Coffee.id == coffee_id))
        coffee = result.scalar_one_or_none()
        name = coffee.label if coffee else "Unknown"
        enriched.append({**dict(component), "coffee_name": name})
    return enriched


async def _blend_to_detail_response(blend: Blend, db: AsyncSession) -> dict:
    """Build BlendDetailResponse dict with available_weight_kg and enriched recipe."""
    recipe_enriched = await _enrich_recipe_with_coffee_names(blend.recipe, db)
    available = await calculate_blend_available_weight(blend, db)
    return {
        "id": blend.id,
        "user_id": blend.user_id,
        "name": blend.name,
        "description": blend.description,
        "recipe": [
            {
                "coffee_id": c.get("coffee_id"),
                "percentage": c.get("percentage"),
                "coffee_name": c.get("coffee_name", "Unknown"),
            }
            for c in recipe_enriched
        ],
        "available_weight_kg": available,
        "created_at": blend.created_at,
        "updated_at": blend.updated_at,
    }


@router.get("", response_model=dict)
async def list_blends(
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Список блендов текущего пользователя с available_weight_kg и обогащённым recipe."""
    count_result = await db.execute(
        select(func.count()).select_from(Blend).where(Blend.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Blend)
        .where(Blend.user_id == current_user.id)
        .order_by(Blend.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    blends = result.scalars().all()

    items = [await _blend_to_detail_response(b, db) for b in blends]

    return {
        "data": {
            "items": items,
            "total": total,
        }
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_blend(
    blend_data: BlendCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Создать бленд. Валидация: все coffee_id существуют."""
    for comp in blend_data.recipe:
        r = await db.execute(select(Coffee).where(Coffee.id == comp.coffee_id))
        coffee = r.scalar_one_or_none()
        if not coffee:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Coffee with id {comp.coffee_id} not found",
            )

    recipe_json = [
        {"coffee_id": str(c.coffee_id), "percentage": c.percentage}
        for c in blend_data.recipe
    ]

    blend = Blend(
        user_id=current_user.id,
        name=blend_data.name,
        description=blend_data.description,
        recipe=recipe_json,
    )
    db.add(blend)
    await db.commit()
    await db.refresh(blend)

    data = await _blend_to_detail_response(blend, db)
    return {"data": data}


@router.get("/{blend_id}", response_model=dict)
async def get_blend(
    blend_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Детали бленда по ID. 403 если не владелец."""
    result = await db.execute(select(Blend).where(Blend.id == blend_id))
    blend = result.scalar_one_or_none()
    if not blend:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blend not found")
    if blend.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner of this blend")

    data = await _blend_to_detail_response(blend, db)
    return {"data": data}


@router.put("/{blend_id}", response_model=dict)
async def update_blend(
    blend_id: UUID,
    blend_data: BlendUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Обновить бленд. При обновлении recipe валидируем coffee_id."""
    result = await db.execute(select(Blend).where(Blend.id == blend_id))
    blend = result.scalar_one_or_none()
    if not blend:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blend not found")
    if blend.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner of this blend")

    update_dict = blend_data.model_dump(exclude_unset=True)
    if "recipe" in update_dict and update_dict["recipe"] is not None:
        recipe_list = update_dict["recipe"]
        for comp in recipe_list:
            cid = comp["coffee_id"] if isinstance(comp, dict) else comp.coffee_id
            r = await db.execute(select(Coffee).where(Coffee.id == cid))
            if r.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Coffee with id {cid} not found",
                )
        blend.recipe = [
            {"coffee_id": str(c["coffee_id"] if isinstance(c, dict) else c.coffee_id), "percentage": c["percentage"] if isinstance(c, dict) else c.percentage}
            for c in recipe_list
        ]
        del update_dict["recipe"]

    for key, value in update_dict.items():
        setattr(blend, key, value)

    blend.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(blend)

    data = await _blend_to_detail_response(blend, db)
    return {"data": data}


@router.delete("/{blend_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blend(
    blend_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_full_access),
):
    """Удалить бленд. 400 если есть roasts с этим blend_id."""
    result = await db.execute(select(Blend).where(Blend.id == blend_id))
    blend = result.scalar_one_or_none()
    if not blend:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blend not found")
    if blend.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner of this blend")

    roast_count_result = await db.execute(
        select(func.count()).select_from(Roast).where(Roast.blend_id == blend_id)
    )
    roast_count = roast_count_result.scalar() or 0
    if roast_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete blend with {roast_count} roasts. Delete roasts first.",
        )

    await db.delete(blend)
    await db.commit()
