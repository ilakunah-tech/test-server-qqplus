"""
Roast API endpoints with full Artisan Plus protocol support.

Features:
- Gzip decompression
- Idempotency-Key handling
- Suppression field restoration
- 409 Conflict on modified_at conflict
- Telemetry storage in JSONB
"""
import gzip
import json
import os
import tempfile
import zipfile
from pathlib import Path
import logging
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Header, BackgroundTasks
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, and_
from uuid import UUID
from typing import Optional, Any, List
from datetime import datetime, date, timezone, timedelta
from app.api.deps import get_db, get_current_user, require_roasts_can_edit, require_roasts_mutate
from app.models.user import User
from app.models.roast import Roast
from app.models.roast_profile import RoastProfile
from app.models.batch import Batch
from app.models.schedule import Schedule
from app.models.coffee import Coffee
from app.models.blend import Blend
from app.models.idempotency import IdempotencyCache
from app.models.roast_goal import RoastGoal
from app.schemas.roast import (
    RoastCreate,
    RoastUpdate,
    RoastResponse,
    TelemetryData,
    CreateReferenceBody,
    ReplaceReferenceBody,
)
from app.schemas.roast_goal import (
    RoastGoalCreate,
    RoastGoalUpdate,
    RoastGoalResponse,
    GoalParameterConfig,
)
from app.services.file_service import (
    save_alog_file,
    save_alog_file_from_bytes,
    get_alog_file,
    read_and_parse_alog,
    compute_computed_from_timeindex,
    compute_computed_from_telemetry_arrays,
    ensure_artisan_background_profile,
)
from app.services.blend_calculator import calculate_blend_available_weight
from app.services.goals_service import check_roast_against_goals
from app.services.task_scheduler import check_counter_tasks
from app.models.user_machine import UserMachine
from fastapi.responses import FileResponse, JSONResponse, Response

router = APIRouter()
logger = logging.getLogger(__name__)

# ==================== CONSTANTS ====================

# Fields that are ALWAYS sent (even if None/0) per Artisan protocol
ALWAYS_SENT_FIELDS = ['roast_id', 'location', 'coffee', 'blend', 'amount', 'end_weight', 'defects_weight']

# Default values for suppressed fields (пустые массивы восстанавливаются как [])
SUPPRESSION_DEFAULTS = {
    'batch_number': 0,
    'label': '',
    'notes': '',
    'whole_color': 0,
    'ground_color': 0,
    'cupping_score': 0,
    'defects_weight': 0,
    'weight_loss': None,
    'FCe_temp': None,
    'FCe_time': None,
    'SCs_temp': None,
    'SCs_time': None,
    'SCe_temp': None,
    'SCe_time': None,
    'extra_temp1': [],
    'extra_temp2': [],
    'air': [],
    'drum': [],
    'gas': [],
    'fan': [],
    'heater': [],
    'timex': [],
    'temp1': [],
    'temp2': [],
    'mode': 'C',
    'temp_unit': 'C',
    'GMT_offset': 0,
}

# Idempotency cache TTL (24 hours)
IDEMPOTENCY_TTL_HOURS = 24


# ==================== HELPER FUNCTIONS ====================

def _parse_roast_id(roast_id_str: str) -> UUID:
    """Parse roast_id: UUID with dashes or 32 hex chars (Artisan format)."""
    s = (roast_id_str or "").strip().replace("-", "").lower()
    if len(s) == 32 and all(c in "0123456789abcdef" for c in s):
        return UUID(hex=s)
    return UUID(roast_id_str)


def _parse_schedule_id(body: dict) -> Optional[UUID]:
    """Parse schedule_id from body. Artisan sends s_item_id, web may send schedule_id."""
    raw = body.get("schedule_id") or body.get("s_item_id")
    if not raw:
        return None
    try:
        s = str(raw).strip().replace("-", "").lower()
        if len(s) == 32 and all(c in "0123456789abcdef" for c in s):
            return UUID(hex=s)
        return UUID(raw)
    except (ValueError, TypeError):
        return None


def _parse_artisan_date(date_str: Any) -> datetime:
    """Parse ISO8601 date from Artisan (with Z or +00:00 suffix)."""
    if not date_str:
        return datetime.now(timezone.utc)
    s = str(date_str).replace("Z", "+00:00")
    if "T" in s:
        return datetime.fromisoformat(s)
    return datetime.fromisoformat(s + "T00:00:00+00:00") if s else datetime.now(timezone.utc)


def _restore_suppressed_fields(data: dict) -> dict:
    """Restore suppressed fields to their default values."""
    for key, default in SUPPRESSION_DEFAULTS.items():
        if key not in data:
            data[key] = default
    return data


TELEMETRY_FIELDS = ['timex', 'temp1', 'temp2', 'extra_temp1', 'extra_temp2', 'air', 'drum', 'gas', 'fan', 'heater', 'timeindex']


def _extract_telemetry_columns(data: dict) -> dict:
    """
    Из payload извлечь телеметрию: либо из объекта telemetry, либо из отдельных полей.
    Возвращает dict с ключами timex, temp1, ... для записи в раздельные JSONB колонки.
    """
    result = {}
    if 'telemetry' in data and isinstance(data.get('telemetry'), dict):
        t = data['telemetry']
        for field in TELEMETRY_FIELDS:
            result[field] = t.get(field) if t.get(field) is not None else []
    for field in TELEMETRY_FIELDS:
        if field not in result and field in data and data[field] is not None:
            result[field] = data[field]
    for field in TELEMETRY_FIELDS:
        if field not in result:
            result[field] = []
    return result


def _roast_telemetry(roast: Roast) -> TelemetryData:
    """Собрать telemetry из раздельных полей модели."""
    return TelemetryData(
        timex=roast.timex or [],
        temp1=roast.temp1 or [],
        temp2=roast.temp2 or [],
        extra_temp1=roast.extra_temp1 or [],
        extra_temp2=roast.extra_temp2 or [],
        air=roast.air or [],
        drum=roast.drum or [],
        gas=roast.gas or [],
        fan=roast.fan or [],
        heater=roast.heater or [],
    )


def _roast_to_response(roast: Roast) -> RoastResponse:
    """Построить RoastResponse из Roast (telemetry собирается из раздельных полей)."""
    data = {f: getattr(roast, f) for f in RoastResponse.model_fields if f != "telemetry" and hasattr(roast, f)}
    data["telemetry"] = _roast_telemetry(roast)
    return RoastResponse.model_validate(data)


async def _enrich_roast_from_profile(roast: Roast, db: AsyncSession) -> dict[str, Any]:
    """
    Extract operator, DEV_time, DEV_ratio, weight_loss from roast's .alog profile
    when they are missing in the Roast record. Used to populate list/detail responses.
    """
    out: dict[str, Any] = {}
    if roast.operator is not None and roast.DEV_time is not None and roast.DEV_ratio is not None and roast.weight_loss is not None:
        return out  # Nothing to enrich

    profile_data: dict | None = None
    # Try roast_profiles blob first
    rp_result = await db.execute(select(RoastProfile).where(RoastProfile.roast_id == roast.id))
    rp = rp_result.scalar_one_or_none()
    if rp and rp.data:
        try:
            fd, temp_path = tempfile.mkstemp(suffix=".alog", prefix="roast_")
            try:
                os.write(fd, rp.data)
            finally:
                try:
                    os.close(fd)
                except OSError:
                    pass
            try:
                profile_data = read_and_parse_alog(Path(temp_path))
                profile_data = compute_computed_from_timeindex(profile_data)
            finally:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass
        except (json.JSONDecodeError, ValueError, zipfile.BadZipFile):
            pass

    if profile_data is None and roast.alog_file_path:
        alog_path = Path(f"/app{roast.alog_file_path}")
        if alog_path.exists():
            try:
                profile_data = read_and_parse_alog(alog_path)
                profile_data = compute_computed_from_timeindex(profile_data)
            except (json.JSONDecodeError, ValueError, zipfile.BadZipFile):
                pass

    if not profile_data:
        return out

    if roast.operator is None and profile_data.get("operator"):
        out["operator"] = str(profile_data["operator"]).strip() or None

    computed = profile_data.get("computed") or {}
    if roast.DEV_time is None:
        fin = computed.get("finishphasetime")
        if fin is not None:
            out["DEV_time"] = int(fin) if isinstance(fin, (int, float)) else None
    if roast.DEV_ratio is None:
        tot = computed.get("totaltime") or computed.get("DROP_time")
        fin = computed.get("finishphasetime")
        if tot and tot > 0 and fin is not None:
            pct = (float(fin) / float(tot)) * 100
            out["DEV_ratio"] = round(pct, 1)
    if roast.weight_loss is None:
        wl = computed.get("weight_loss")
        if wl is not None:
            vl = float(wl)
            # Artisan stores weight_loss as decimal (0..1) or percentage (>1)
            pct = vl * 100.0 if vl <= 1 else vl
            # Sanity: coffee weight loss is typically 10-25%, never > 50%
            if 0 < pct < 50:
                out["weight_loss"] = pct

    return out


def _roast_to_artisan_result(roast: Roast) -> dict[str, Any]:
    """Convert Roast to Artisan-compatible result dict."""
    modified = roast.modified_at or roast.updated_at or roast.roasted_at
    result = {
        "roast_id": str(roast.id),
        "modified_at": modified.isoformat() if modified else None,
        "date": roast.roasted_at.isoformat() if roast.roasted_at else None,
        "amount": float(roast.green_weight_kg) if roast.green_weight_kg is not None else None,
        "end_weight": float(roast.roasted_weight_kg) if roast.roasted_weight_kg is not None else None,
        "coffee_id": str(roast.coffee_id) if roast.coffee_id else None,
        "blend_id": str(roast.blend_id) if roast.blend_id else None,
        "message": "Roast saved successfully",
    }
    # Add reference_profile_id if present (for Artisan to load background)
    if roast.reference_profile_id:
        result["reference_profile_id"] = str(roast.reference_profile_id)
    return result


def _artisan_response(content: dict[str, Any], status_code: int = 200) -> JSONResponse:
    """Create Artisan-compatible JSON response."""
    if "success" not in content:
        content["success"] = True
    if "ol" not in content:
        content["ol"] = {}
    if "pu" not in content:
        content["pu"] = ""
    if "notifications" not in content:
        content["notifications"] = {"unqualified": 0, "machines": []}
    return JSONResponse(status_code=status_code, content=content)


async def _get_idempotency_cached(
    db: AsyncSession, 
    idempotency_key: str, 
    endpoint: str
) -> Optional[dict]:
    """Get cached response for idempotency key."""
    if not idempotency_key:
        return None
    result = await db.execute(
        select(IdempotencyCache).where(
            IdempotencyCache.idempotency_key == idempotency_key,
            IdempotencyCache.endpoint == endpoint
        )
    )
    cached = result.scalar_one_or_none()
    if cached:
        return cached.response
    return None


async def _save_idempotency_cache(
    db: AsyncSession,
    idempotency_key: str,
    endpoint: str,
    response: dict
) -> None:
    """Save response to idempotency cache."""
    if not idempotency_key:
        return
    cache_entry = IdempotencyCache(
        idempotency_key=idempotency_key,
        endpoint=endpoint,
        response=response
    )
    db.add(cache_entry)
    # Don't commit here - let the main transaction handle it


async def _cleanup_old_idempotency(db: AsyncSession) -> None:
    """Clean up idempotency cache entries older than TTL."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=IDEMPOTENCY_TTL_HOURS)
    await db.execute(
        delete(IdempotencyCache).where(IdempotencyCache.created_at < cutoff)
    )


# ==================== ENDPOINTS ====================

# Goals endpoints must be registered BEFORE the catch-all "" route
# ==================== GOALS ENDPOINTS (nested under /roasts/goals) ====================

@router.get("/goals")
async def list_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all roast goals."""
    try:
        logger.info(f"GET /goals called")
        query = select(RoastGoal).order_by(RoastGoal.created_at.desc())
        
        result = await db.execute(query)
        goals = result.scalars().all()
        logger.info(f"Found {len(goals)} goals in DB, returning them")
        # Convert to dict for JSON serialization
        goals_list = [
            {
                "id": str(goal.id),
                "name": goal.name,
                "goal_type": goal.goal_type,
                "is_active": goal.is_active,
                "failed_status": goal.failed_status,
                "missing_value_status": goal.missing_value_status,
                "parameters": goal.parameters or {},
                "created_at": goal.created_at.isoformat() if goal.created_at else None,
                "updated_at": goal.updated_at.isoformat() if goal.updated_at else None,
            }
            for goal in goals
        ]
        logger.info(f"Returning {len(goals_list)} goals")
        return goals_list
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing goals: {e}", exc_info=True, stack_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("", response_model=dict)
async def list_roasts(
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    coffee_id: Optional[UUID] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    in_quality_control: Optional[bool] = Query(None, description="Filter by quality control flag"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all roasts with optional filters (date range, coffee_id, batch_id, in_quality_control). All users can see all roasts."""
    # NOTE: No user_id filter - all users can see all roasts
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
    if in_quality_control is not None:
        query = query.where(Roast.in_quality_control == in_quality_control)
        count_query = count_query.where(Roast.in_quality_control == in_quality_control)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    result = await db.execute(
        query.order_by(Roast.roasted_at.desc()).limit(limit).offset(offset)
    )
    roasts = result.scalars().all()

    items = []
    for r in roasts:
        resp = _roast_to_response(r).model_dump(mode="json")
        enriched = await _enrich_roast_from_profile(r, db)
        if enriched:
            resp.update(enriched)
        # Check goals status (only if there are active goals)
        try:
            goals_check = await check_roast_against_goals(r, db)
            if goals_check:
                resp["goals_status"] = goals_check["status"]  # "green" | "yellow" | "red"
            # Если goals_check == None, значит нет активных целей - не устанавливаем статус
        except Exception as e:
            logger.warning(f"Error checking goals for roast {r.id}: {e}")
            # Не устанавливаем статус при ошибке, если нет активных целей
        items.append(resp)

    return {
        "data": {
            "items": items,
            "total": total,
        }
    }


@router.get("/references", response_model=dict)
async def list_references(
    coffee_id: Optional[UUID] = Query(None),
    blend_id: Optional[UUID] = Query(None),
    coffee_hr_id: Optional[str] = Query(None),
    blend_hr_id: Optional[str] = Query(None),
    machine: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List reference profiles (эталоны) filtered by coffee/blend and machine.
    Accepts coffee_id or blend_id (UUID), or coffee_hr_id or blend_hr_id (for Artisan).
    """
    resolved_coffee_id: Optional[UUID] = coffee_id
    resolved_blend_id: Optional[UUID] = blend_id
    if coffee_hr_id and not resolved_coffee_id:
        res = await db.execute(select(Coffee.id).where(Coffee.hr_id == coffee_hr_id.strip()).limit(1))
        row = res.scalar_one_or_none()
        if row is not None:
            resolved_coffee_id = row
    if blend_hr_id and not resolved_blend_id:
        res = await db.execute(select(Blend.id).where(Blend.name == blend_hr_id.strip()).limit(1))
        row = res.scalar_one_or_none()
        if row is not None:
            resolved_blend_id = row
        else:
            # Blend might be identified by recipe/hr_id in plus; try id if blend_hr_id looks like UUID
            try:
                resolved_blend_id = UUID(blend_hr_id.strip())
            except (ValueError, TypeError):
                pass
    if resolved_coffee_id is not None and resolved_blend_id is not None:
        raise HTTPException(status_code=400, detail="Pass either coffee or blend, not both")

    query = select(Roast).where(Roast.is_reference == True)
    if resolved_coffee_id is not None:
        query = query.where(Roast.reference_for_coffee_id == resolved_coffee_id)
    elif resolved_blend_id is not None:
        query = query.where(Roast.reference_for_blend_id == resolved_blend_id)
    # If both None: return all reference roasts (no coffee/blend filter)

    machine_clean = machine.strip() if machine and machine.strip() else None
    if machine_clean:
        # Case-insensitive + trim: "Besca BSC-15" matches "besca bsc-15" or " Besca BSC-15 "
        machine_norm = machine_clean.lower()
        query = query.where(func.lower(func.trim(Roast.reference_machine)) == machine_norm)
    query = query.order_by(Roast.roasted_at.desc())
    result = await db.execute(query)
    roasts = result.scalars().all()
    # Fallback: if filter by machine returned nothing, return references without machine filter
    if not roasts and machine_clean:
        query_fb = select(Roast).where(Roast.is_reference == True)
        if resolved_coffee_id is not None:
            query_fb = query_fb.where(Roast.reference_for_coffee_id == resolved_coffee_id)
        elif resolved_blend_id is not None:
            query_fb = query_fb.where(Roast.reference_for_blend_id == resolved_blend_id)
        query_fb = query_fb.order_by(Roast.roasted_at.desc())
        result_fb = await db.execute(query_fb)
        roasts = result_fb.scalars().all()

    ref_items = []
    for r in roasts:
        resp = _roast_to_response(r).model_dump(mode="json")
        enriched = await _enrich_roast_from_profile(r, db)
        if enriched:
            resp.update(enriched)
        ref_items.append(resp)

    return {
        "data": {
            "items": ref_items,
            "total": len(roasts),
        }
    }


@router.post("")
@router.post("/aroast")
async def create_or_update_roast(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """
    Create or update a roast (Artisan Plus protocol).
    
    Features:
    - Accepts gzip compressed body (Content-Encoding: gzip)
    - Idempotency-Key header for retry protection
    - Suppressed field restoration (0, "", [] defaults)
    - 409 Conflict on modified_at conflict
    - Stores telemetry in JSONB
    """
    endpoint = "/api/v1/aroast"
    
    # 1. Check idempotency cache
    if idempotency_key:
        cached_response = await _get_idempotency_cached(db, idempotency_key, endpoint)
        if cached_response:
            logger.info(f"Returning cached response for idempotency key: {idempotency_key[:8]}...")
            return _artisan_response(cached_response)
    
    # 2. Parse request body (with gzip support)
    raw = await request.body()
    if not raw:
        raise HTTPException(400, detail="JSON body required")
    
    encoding = (request.headers.get("content-encoding") or "").strip().lower()
    if encoding == "gzip" or (len(raw) >= 2 and raw[0] == 0x1F and raw[1] == 0x8B):
        try:
            raw = gzip.decompress(raw)
        except OSError:
            raise HTTPException(400, detail="Invalid gzip body")
    
    try:
        body = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(400, detail="JSON body required")
    
    if body is None or not isinstance(body, dict):
        raise HTTPException(400, detail="JSON object expected")
    
    logger.info(f"Artisan roast payload: {json.dumps(body, default=str)[:500]}")
    
    # 2.5. Раскладываем telemetry на top-level (для suppression и раздельных колонок)
    if "telemetry" in body and isinstance(body.get("telemetry"), dict):
        t = body.pop("telemetry")
        for f in TELEMETRY_FIELDS:
            body[f] = t.get(f) if (f in t and t.get(f) is not None) else body.get(f, [])
    
    # 3. Extract and validate roast_id
    roast_id_raw = body.get("roast_id") or body.get("id")
    if not roast_id_raw:
        raise HTTPException(400, detail="roast_id or id required")
    
    try:
        roast_uuid = _parse_roast_id(str(roast_id_raw))
    except (ValueError, TypeError):
        raise HTTPException(400, detail="Invalid roast_id UUID")
    
    # 4. Restore suppressed fields
    body = _restore_suppressed_fields(body)
    
    # 5. Check for existing roast
    existing_result = await db.execute(
        select(Roast).where(Roast.id == roast_uuid, Roast.user_id == current_user.id)
    )
    existing_roast = existing_result.scalar_one_or_none()
    
    # 6. Check modified_at conflict
    if existing_roast and body.get("modified_at"):
        client_modified = _parse_artisan_date(body["modified_at"])
        server_modified = existing_roast.modified_at or existing_roast.updated_at
        
        if server_modified and client_modified < server_modified:
            conflict_response = {
                "success": False,
                "error": "Conflict: server has newer version",
                "server_modified_at": server_modified.isoformat(),
                "client_modified_at": client_modified.isoformat(),
            }
            return JSONResponse(status_code=409, content=conflict_response)
    
    # 7. Handle partial update (roast_id present, no date, roast exists)
    if "roast_id" in body and ("date" not in body or not body.get("date")):
        if not existing_roast:
            # Roast doesn't exist - try to get date from any field Artisan might send
            date_raw = (
                body.get("date")
                or body.get("roasted_at")
                or body.get("roastdate")
                or body.get("modified_at")
            )
            if date_raw:
                try:
                    if isinstance(date_raw, str):
                        body["date"] = date_raw
                    elif isinstance(date_raw, (int, float)):
                        # Unix timestamp (seconds or ms)
                        ts = float(date_raw)
                        if ts > 1e12:
                            ts = ts / 1000.0
                        body["date"] = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                except Exception:
                    pass
            # Last resort: create with current time so roast is not lost
            if not body.get("date") and body.get("amount") is not None and body.get("roast_id"):
                body["date"] = datetime.now(timezone.utc).isoformat()
                logger.info("create_or_update_roast: no date in payload, using now for roast_id=%s", body.get("roast_id"))

            if not body.get("date"):
                raise HTTPException(404, detail="Roast not found for update. Include 'date' or 'roasted_at' to create new roast.")
        else:
            # Roast exists - perform partial update
            if body.get("end_weight") is not None:
                existing_roast.roasted_weight_kg = Decimal(str(body["end_weight"]))
            if body.get("notes") is not None:
                existing_roast.notes = str(body["notes"])[:2000] if body["notes"] else None
            if body.get("label") is not None:
                existing_roast.label = str(body["label"])[:255] if body["label"] else ""
            if body.get("whole_color") is not None:
                existing_roast.whole_color = int(body["whole_color"])
            if body.get("ground_color") is not None:
                existing_roast.ground_color = int(body["ground_color"])
            if body.get("cupping_score") is not None:
                existing_roast.cupping_score = int(body["cupping_score"])
            
            # Extract reference_profile_id from template field (Artisan sends template with 'id' field containing UUID)
            template_data = body.get("template")
            if template_data is not None:
                if isinstance(template_data, dict):
                    template_id = template_data.get("id")
                    if template_id:
                        try:
                            template_uuid = _parse_roast_id(template_id)
                            # Verify that this UUID exists and is a reference profile
                            ref_result = await db.execute(
                                select(Roast).where(Roast.id == template_uuid, Roast.is_reference == True)
                            )
                            ref_roast = ref_result.scalar_one_or_none()
                            if ref_roast:
                                existing_roast.reference_profile_id = template_uuid
                            else:
                                # If template_id doesn't exist or is not a reference, clear reference_profile_id
                                existing_roast.reference_profile_id = None
                        except (ValueError, TypeError):
                            # Invalid UUID format, clear reference_profile_id
                            existing_roast.reference_profile_id = None
                else:
                    # template is None or empty dict, clear reference_profile_id
                    existing_roast.reference_profile_id = None
            
            # Update modified_at
            existing_roast.modified_at = datetime.now(timezone.utc)
            
            await db.commit()
            await db.refresh(existing_roast)
            
            response_data = {
                "data": _roast_to_response(existing_roast).model_dump(mode="json"),
                "result": _roast_to_artisan_result(existing_roast),
            }
            
            if idempotency_key:
                await _save_idempotency_cache(db, idempotency_key, endpoint, response_data)
                await db.commit()
            
            return _artisan_response(response_data)
    
    # 8. Full create (requires date)
    if "date" not in body or not body.get("date"):
        raise HTTPException(400, detail="'date' field required for new roast")
    
    # 9. Idempotency: if roast already exists, return it
    if existing_roast:
        response_data = {
            "data": _roast_to_response(existing_roast).model_dump(mode="json"),
            "result": _roast_to_artisan_result(existing_roast),
        }
        if idempotency_key:
            await _save_idempotency_cache(db, idempotency_key, endpoint, response_data)
            await db.commit()
        return _artisan_response(response_data)
    
    # 10. Resolve HR IDs to internal UUIDs
    coffee_id_val = None
    blend_id_val = None
    
    coffee_hr_id = body.get("coffee")
    blend_raw = body.get("blend")
    
    # Artisan sends "blend" as blend_spec dict {label, ingredients}, NOT as blend HR_ID/UUID
    blend_spec_val = None
    if isinstance(blend_raw, dict) and ("label" in blend_raw or "ingredients" in blend_raw):
        blend_spec_val = blend_raw
        blend_hr_id = None  # No blend_id when we have inline blend_spec
    else:
        blend_hr_id = blend_raw if isinstance(blend_raw, str) else None
    
    if coffee_hr_id:
        cr = await db.execute(select(Coffee).where(Coffee.hr_id == coffee_hr_id))
        coffee = cr.scalar_one_or_none()
        if coffee:
            coffee_id_val = coffee.id
        else:
            # Auto-create coffee placeholder if not exists
            logger.info(f"Coffee with hr_id '{coffee_hr_id}' not found, creating placeholder")
            coffee = Coffee(
                hr_id=coffee_hr_id,
                label=body.get("bean", coffee_hr_id),
                origin=body.get("origin", "Unknown"),
                stock_weight_kg=Decimal("1000"),
            )
            db.add(coffee)
            await db.flush()
            coffee_id_val = coffee.id
    
    # Only look up Blend by UUID when blend is a string (legacy/other clients)
    if blend_hr_id and isinstance(blend_hr_id, str):
        try:
            blend_uuid = UUID(blend_hr_id)
            br = await db.execute(
                select(Blend).where(Blend.id == blend_uuid, Blend.user_id == current_user.id)
            )
            blend = br.scalar_one_or_none()
            if blend:
                blend_id_val = blend.id
        except (ValueError, TypeError):
            pass  # Not a valid UUID, skip blend lookup
    
    # 11. Extract telemetry into separate columns (from telemetry object or top-level fields)
    telemetry_cols = _extract_telemetry_columns(body)
    
    # 12. Prepare roast data
    roasted_at = _parse_artisan_date(body.get("date"))
    modified_at = _parse_artisan_date(body.get("modified_at")) if body.get("modified_at") else datetime.now(timezone.utc)
    
    # 13. Stock deduction (if coffee_id or blend_id)
    deducted_components: list[dict] = []
    amount = float(body.get("amount", 0))
    
    if coffee_id_val and amount > 0:
        result = await db.execute(
            select(Coffee).where(Coffee.id == coffee_id_val).with_for_update()
        )
        coffee = result.scalar_one_or_none()
        if coffee:
            if coffee.stock_weight_kg >= Decimal(str(amount)):
                coffee.stock_weight_kg -= Decimal(str(amount))
                deducted_components = [{"coffee_id": str(coffee.id), "deducted_weight_kg": amount}]
            else:
                logger.warning(f"Insufficient stock for coffee {coffee_hr_id}: {coffee.stock_weight_kg} < {amount}")
    
    elif blend_spec_val and amount > 0:
        # Deduct from blend_spec ingredients (Artisan format: {ingredients: [{coffee: hr_id, ratio: 0.5}, ...]})
        ingredients = blend_spec_val.get("ingredients") or []
        for ing in ingredients:
            coffee_hrid = ing.get("coffee")
            ratio = float(ing.get("ratio", 0))
            if not coffee_hrid or ratio <= 0:
                continue
            cr = await db.execute(select(Coffee).where(Coffee.hr_id == coffee_hrid).with_for_update())
            comp_coffee = cr.scalar_one_or_none()
            if comp_coffee:
                deduct_weight = Decimal(str(amount)) * Decimal(str(ratio))
                if comp_coffee.stock_weight_kg >= deduct_weight:
                    comp_coffee.stock_weight_kg -= deduct_weight
                    deducted_components.append({
                        "coffee_id": str(comp_coffee.id),
                        "deducted_weight_kg": round(float(deduct_weight), 3),
                    })
                else:
                    logger.warning(f"Insufficient stock for blend component {coffee_hrid}: {comp_coffee.stock_weight_kg} < {deduct_weight}")
    
    elif blend_id_val and amount > 0:
        result = await db.execute(
            select(Blend).where(Blend.id == blend_id_val, Blend.user_id == current_user.id)
        )
        blend = result.scalar_one_or_none()
        if blend:
            for component in blend.recipe:
                raw_coffee_id = component.get("coffee_id")
                percentage = component.get("percentage")
                if raw_coffee_id is None or percentage is None:
                    continue
                cid = raw_coffee_id if isinstance(raw_coffee_id, UUID) else UUID(str(raw_coffee_id))
                deduct_weight = Decimal(str(amount)) * Decimal(str(percentage)) / Decimal("100")
                
                comp_result = await db.execute(
                    select(Coffee).where(Coffee.id == cid).with_for_update()
                )
                comp_coffee = comp_result.scalar_one_or_none()
                if comp_coffee and comp_coffee.stock_weight_kg >= deduct_weight:
                    comp_coffee.stock_weight_kg -= deduct_weight
                    deducted_components.append({
                        "coffee_id": str(cid),
                        "deducted_weight_kg": round(float(deduct_weight), 3),
                    })
    
    # 14. Create Roast record
    roast = Roast(
        id=roast_uuid,
        user_id=current_user.id,
        
        # Foreign keys
        coffee_id=coffee_id_val,
        blend_id=blend_id_val,
        batch_id=UUID(body["batch_id"]) if body.get("batch_id") else None,
        schedule_id=_parse_schedule_id(body),
        
        # Batch identification
        batch_number=int(body.get("batch_number", 0)),
        label=str(body.get("label", ""))[:255],
        
        # Timestamps
        roasted_at=roasted_at,
        GMT_offset=int(body.get("GMT_offset", 0)),
        modified_at=modified_at,
        
        # Weights
        green_weight_kg=Decimal(str(amount)),
        roasted_weight_kg=Decimal(str(body.get("end_weight", 0))) if body.get("end_weight") else None,
        weight_loss=float(body["weight_loss"]) if body.get("weight_loss") else None,
        defects_weight=float(body.get("defects_weight", 0)),
        
        # HR IDs
        coffee_hr_id=coffee_hr_id,
        blend_hr_id=blend_hr_id,
        location_hr_id=body.get("location"),
        blend_spec=blend_spec_val or (body.get("blend_spec") if isinstance(body.get("blend_spec"), dict) else None),
        
        # Roaster info
        machine=body.get("machine"),
        operator=body.get("operator"),
        email=body.get("email"),
        
        # Roast events - temperatures
        charge_temp=float(body["charge_temp"]) if body.get("charge_temp") else None,
        TP_temp=float(body["TP_temp"]) if body.get("TP_temp") else None,
        DRY_temp=float(body["DRY_temp"]) if body.get("DRY_temp") else None,
        FCs_temp=float(body["FCs_temp"]) if body.get("FCs_temp") else None,
        FCe_temp=float(body["FCe_temp"]) if body.get("FCe_temp") else None,
        SCs_temp=float(body["SCs_temp"]) if body.get("SCs_temp") else None,
        SCe_temp=float(body["SCe_temp"]) if body.get("SCe_temp") else None,
        drop_temp=float(body["drop_temp"]) if body.get("drop_temp") else None,
        
        # Roast events - times
        TP_time=int(body["TP_time"]) if body.get("TP_time") else None,
        DRY_time=int(body["DRY_time"]) if body.get("DRY_time") else None,
        FCs_time=int(body["FCs_time"]) if body.get("FCs_time") else None,
        FCe_time=int(body["FCe_time"]) if body.get("FCe_time") else None,
        SCs_time=int(body["SCs_time"]) if body.get("SCs_time") else None,
        SCe_time=int(body["SCe_time"]) if body.get("SCe_time") else None,
        drop_time=int(body["drop_time"]) if body.get("drop_time") else None,
        
        # Phases
        DEV_time=int(body["DEV_time"]) if body.get("DEV_time") else None,
        DEV_ratio=float(body["DEV_ratio"]) if body.get("DEV_ratio") else None,
        
        # Quality metrics
        whole_color=int(body.get("whole_color", 0)),
        ground_color=int(body.get("ground_color", 0)),
        cupping_score=int(body.get("cupping_score", 0)),
        
        # Temperature mode
        mode=str(body.get("mode", "C"))[:1],
        temp_unit=str(body.get("temp_unit", "C"))[:1],
        
        # Telemetry (раздельные JSONB поля)
        timex=telemetry_cols.get("timex", []),
        temp1=telemetry_cols.get("temp1", []),
        temp2=telemetry_cols.get("temp2", []),
        extra_temp1=telemetry_cols.get("extra_temp1", []),
        extra_temp2=telemetry_cols.get("extra_temp2", []),
        air=telemetry_cols.get("air", []),
        drum=telemetry_cols.get("drum", []),
        gas=telemetry_cols.get("gas", []),
        fan=telemetry_cols.get("fan", []),
        heater=telemetry_cols.get("heater", []),
        timeindex=telemetry_cols.get("timeindex") or None,  # Event indices [CHARGE, DRY, FCs, FCe, SCs, SCe, DROP, COOL]
        
        # Other
        title=body.get("title"),
        notes=body.get("notes"),
        deducted_components=deducted_components if deducted_components else None,
    )
    
    # Extract reference_profile_id from template field (Artisan sends template with 'id' field containing UUID)
    template_data = body.get("template")
    if template_data and isinstance(template_data, dict):
        template_id = template_data.get("id")
        if template_id:
            try:
                # Try to parse as UUID (could be string UUID or hex)
                template_uuid = _parse_roast_id(template_id)
                # Verify that this UUID exists and is a reference profile
                ref_result = await db.execute(
                    select(Roast).where(Roast.id == template_uuid, Roast.is_reference == True)
                )
                ref_roast = ref_result.scalar_one_or_none()
                if ref_roast:
                    roast.reference_profile_id = template_uuid
            except (ValueError, TypeError):
                # Invalid UUID format, skip
                pass
    
    db.add(roast)
    
    # 15. Handle schedule completion
    if roast.schedule_id:
        schedule_result = await db.execute(
            select(Schedule).where(Schedule.id == roast.schedule_id).with_for_update()
        )
        if schedule := schedule_result.scalar_one_or_none():
            if schedule.status == "pending":
                schedule.status = "completed"
                schedule.completed_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(roast)
    
    # 15.5. Check counter tasks if machine is specified
    machine_id = None
    if roast.machine:
        # Try to find UserMachine by name
        machine_query = select(UserMachine).where(
            and_(
                UserMachine.name == roast.machine,
                UserMachine.user_id == current_user.id
            )
        )
        machine_result = await db.execute(machine_query)
        machine = machine_result.scalar_one_or_none()
        if machine:
            machine_id = machine.id
    
    # Check counter tasks (async, non-blocking)
    if machine_id or True:  # Check all counter tasks (including those without machine filter)
        try:
            await check_counter_tasks(db, roast.id, machine_id)
        except Exception as e:
            logger.error(f"Error checking counter tasks: {e}", exc_info=True)
    
    response_data = {
        "data": _roast_to_response(roast).model_dump(mode="json"),
        "result": _roast_to_artisan_result(roast),
    }
    
    # 16. Cache response for idempotency
    if idempotency_key:
        await _save_idempotency_cache(db, idempotency_key, endpoint, response_data)
        await db.commit()
    
    logger.info(f"Created roast {roast_uuid} for user {current_user.id}")
    return _artisan_response(response_data, status_code=201)


@router.get("/{roast_id}", response_model=dict)
async def get_roast(
    roast_id: str,
    modified_at: Optional[int] = Query(None, description="Client's modified_at (ms); server returns 204 if no newer"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a single roast by ID.
    
    Artisan-compatible: roast_id as UUID or 32 hex;
    Returns 204 if client has newer version (modified_at check).
    """
    try:
        roast_uuid = _parse_roast_id(roast_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    
    # NOTE: No user_id filter - all users can see all roasts
    result = await db.execute(
        select(Roast).where(Roast.id == roast_uuid)
    )
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    
    # Check if client has newer version
    if modified_at is not None:
        server_ts = roast.modified_at or roast.updated_at or roast.roasted_at
        server_ms = int(server_ts.timestamp() * 1000) if server_ts else 0
        if server_ms <= modified_at:
            return Response(status_code=204)
    
    resp_data = _roast_to_response(roast).model_dump(mode="json")
    enriched = await _enrich_roast_from_profile(roast, db)
    if enriched:
        resp_data.update(enriched)
    try:
        goals_check = await check_roast_against_goals(roast, db)
        if goals_check:
            resp_data["goals_status"] = goals_check["status"]
            resp_data["goals_check"] = goals_check
    except Exception as e:
        logger.warning(f"Error checking goals for roast {roast.id}: {e}")
    res = {
        "data": resp_data,
        "result": _roast_to_artisan_result(roast),
    }
    return _artisan_response(res)


@router.patch("/{roast_id}", response_model=dict)
async def patch_roast(
    roast_id: str,
    body: RoastUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_can_edit),
):
    """
    Partial update of a roast (e.g. for Quality Control: notes, cupping_score, label).
    """
    try:
        roast_uuid = _parse_roast_id(roast_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    result = await db.execute(select(Roast).where(Roast.id == roast_uuid))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    payload = body.model_dump(exclude_unset=True)
    if not payload:
        return {"data": _roast_to_response(roast).model_dump(mode="json")}
    if "roasted_at" in payload:
        roast.roasted_at = payload["roasted_at"]
    if "green_weight_kg" in payload:
        roast.green_weight_kg = Decimal(str(payload["green_weight_kg"]))
    if "roasted_weight_kg" in payload:
        roast.roasted_weight_kg = Decimal(str(payload["roasted_weight_kg"])) if payload["roasted_weight_kg"] is not None else None
    if "title" in payload:
        roast.title = (str(payload["title"])[:255] if payload["title"] else None)
    if "roast_level" in payload:
        roast.roast_level = (str(payload["roast_level"])[:50] if payload["roast_level"] else None)
    if "notes" in payload:
        roast.notes = (str(payload["notes"])[:2000] if payload["notes"] else None)
    if "batch_number" in payload:
        roast.batch_number = int(payload["batch_number"])
    if "label" in payload:
        roast.label = (str(payload["label"])[:255] if payload["label"] else "") or roast.label
    if "machine" in payload:
        roast.machine = (str(payload["machine"])[:100] if payload["machine"] else None)
    if "operator" in payload:
        roast.operator = (str(payload["operator"])[:100] if payload["operator"] else None)
    if "email" in payload:
        roast.email = (str(payload["email"])[:255] if payload["email"] else None)
    if "whole_color" in payload:
        roast.whole_color = int(payload["whole_color"])
    if "ground_color" in payload:
        roast.ground_color = int(payload["ground_color"])
    if "cupping_score" in payload:
        roast.cupping_score = int(payload["cupping_score"])
    if "cupping_date" in payload:
        roast.cupping_date = payload["cupping_date"]  # date or None
    if "cupping_verdict" in payload:
        v = payload["cupping_verdict"]
        roast.cupping_verdict = (str(v)[:20] if v else None)
    if "espresso_date" in payload:
        roast.espresso_date = payload["espresso_date"]
    if "espresso_verdict" in payload:
        v = payload["espresso_verdict"]
        roast.espresso_verdict = (str(v)[:20] if v else None)
    if "espresso_notes" in payload:
        roast.espresso_notes = (str(payload["espresso_notes"])[:2000] if payload["espresso_notes"] else None)
    if "reference_beans_notes" in payload:
        roast.reference_beans_notes = (str(payload["reference_beans_notes"]) if payload["reference_beans_notes"] else None)
    if "in_quality_control" in payload:
        roast.in_quality_control = bool(payload["in_quality_control"])
    roast.modified_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(roast)
    resp_data = _roast_to_response(roast).model_dump(mode="json")
    return {"data": resp_data}


@router.delete("/{roast_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_roast(
    roast_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
):
    """
    Delete a roast and restore stock weight.
    
    Stock is restored from roast.deducted_components.
    """
    try:
        roast_uuid = _parse_roast_id(roast_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    
    # NOTE: No user_id filter - all users can delete any roast
    result = await db.execute(
        select(Roast).where(Roast.id == roast_uuid)
    )
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    
    # Restore stock from deducted_components
    if roast.deducted_components:
        for component in roast.deducted_components:
            coffee_id = component.get("coffee_id")
            deducted_weight = Decimal(str(component.get("deducted_weight_kg", 0)))
            if not coffee_id:
                continue
            comp_result = await db.execute(
                select(Coffee).where(Coffee.id == UUID(str(coffee_id))).with_for_update()
            )
            coffee = comp_result.scalar_one_or_none()
            if coffee:
                coffee.stock_weight_kg += deducted_weight
    
    # Restore batch weight
    if roast.batch_id:
        batch_result = await db.execute(
            select(Batch).where(Batch.id == roast.batch_id).with_for_update()
        )
        if batch := batch_result.scalar_one_or_none():
            batch.current_weight_kg += Decimal(str(roast.green_weight_kg))
            if roast.roasted_weight_kg is not None:
                new_roasted = batch.roasted_total_weight_kg - Decimal(str(roast.roasted_weight_kg))
                # Avoid negative due to check constraint (legacy/inconsistent data)
                batch.roasted_total_weight_kg = max(Decimal("0"), new_roasted)
            if batch.status == "depleted" and batch.current_weight_kg > 0:
                batch.status = "active"
    
    await db.delete(roast)
    await db.commit()
    logger.info(f"Deleted roast {roast_uuid}")


@router.post("/{roast_id}/reference", response_model=dict)
async def create_reference(
    roast_id: str,
    body: CreateReferenceBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
):
    """Mark a roast as reference (эталон): set reference_name, coffee or blend, machine."""
    try:
        roast_uuid = _parse_roast_id(roast_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    if (body.reference_for_coffee_id is None) == (body.reference_for_blend_id is None):
        raise HTTPException(
            status_code=400,
            detail="Set exactly one of reference_for_coffee_id or reference_for_blend_id",
        )
    result = await db.execute(select(Roast).where(Roast.id == roast_uuid))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    roast.is_reference = True
    roast.reference_name = body.reference_name
    roast.reference_for_coffee_id = body.reference_for_coffee_id
    roast.reference_for_blend_id = body.reference_for_blend_id
    roast.reference_machine = body.reference_machine
    await db.commit()
    await db.refresh(roast)
    return {"data": _roast_to_response(roast).model_dump(mode="json")}


@router.post("/{roast_id}/reference/replace", status_code=status.HTTP_200_OK)
async def replace_reference(
    roast_id: str,
    body: ReplaceReferenceBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
):
    """Replace an existing reference with this roast: unmark the old, mark this one."""
    try:
        roast_uuid = _parse_roast_id(roast_id)
        replace_uuid = body.replace_reference_roast_id
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    result = await db.execute(select(Roast).where(Roast.id == replace_uuid))
    old_ref = result.scalar_one_or_none()
    if not old_ref or not old_ref.is_reference:
        raise HTTPException(status_code=404, detail="Reference roast not found or not a reference")
    result = await db.execute(select(Roast).where(Roast.id == roast_uuid))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    # Copy binding from old reference
    roast.reference_for_coffee_id = old_ref.reference_for_coffee_id
    roast.reference_for_blend_id = old_ref.reference_for_blend_id
    roast.reference_machine = old_ref.reference_machine
    roast.reference_name = body.reference_name or old_ref.reference_name or (roast.title or roast.label or "Reference")
    roast.is_reference = True
    # Unmark old reference
    old_ref.is_reference = False
    old_ref.reference_name = None
    old_ref.reference_for_coffee_id = None
    old_ref.reference_for_blend_id = None
    old_ref.reference_machine = None
    await db.commit()
    await db.refresh(roast)
    return {"data": _roast_to_response(roast).model_dump(mode="json")}


@router.delete("/{roast_id}/reference", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reference(
    roast_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
):
    """Remove reference flag from a roast."""
    try:
        roast_uuid = _parse_roast_id(roast_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    result = await db.execute(select(Roast).where(Roast.id == roast_uuid))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    if not roast.is_reference:
        raise HTTPException(status_code=400, detail="Roast is not a reference")
    roast.is_reference = False
    roast.reference_name = None
    roast.reference_for_coffee_id = None
    roast.reference_for_blend_id = None
    roast.reference_machine = None
    await db.commit()


@router.post("/{roast_id}/upload-profile", response_model=dict)
async def upload_profile(
    roast_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
):
    """Upload .alog profile file for a roast. Saves to disk and DB (roast_profiles)."""
    try:
        roast_uuid = _parse_roast_id(roast_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    
    result = await db.execute(select(Roast).where(Roast.id == roast_uuid))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    
    content = await file.read()
    profile_path = save_alog_file_from_bytes(roast_uuid, content)
    roast.alog_file_path = profile_path
    # Upsert blob in roast_profiles for serving via temp file
    rp_result = await db.execute(select(RoastProfile).where(RoastProfile.roast_id == roast_uuid))
    rp = rp_result.scalar_one_or_none()
    if rp:
        rp.data = content
    else:
        db.add(RoastProfile(roast_id=roast_uuid, data=content))

    # Backfill roast from parsed profile (operator, DEV_time, DEV_ratio, weight_loss)
    try:
        fd, temp_path = tempfile.mkstemp(suffix=".alog", prefix="roast_")
        try:
            os.write(fd, content)
        finally:
            try:
                os.close(fd)
            except OSError:
                pass
        try:
            profile_data = read_and_parse_alog(Path(temp_path))
            profile_data = compute_computed_from_timeindex(profile_data)
            # Backfill label from title if not set
            if (roast.label is None or roast.label == "") and profile_data.get("title"):
                roast.label = str(profile_data["title"]).strip()[:255] or None
            if roast.operator is None and profile_data.get("operator"):
                roast.operator = str(profile_data["operator"]).strip() or None
            computed = profile_data.get("computed") or {}
            if roast.DEV_time is None:
                fin = computed.get("finishphasetime")
                if fin is not None:
                    roast.DEV_time = int(fin) if isinstance(fin, (int, float)) else None
            if roast.DEV_ratio is None:
                tot = computed.get("totaltime") or computed.get("DROP_time")
                fin = computed.get("finishphasetime")
                if tot and float(tot) > 0 and fin is not None:
                    roast.DEV_ratio = round((float(fin) / float(tot)) * 100, 1)
            if roast.weight_loss is None:
                wl = computed.get("weight_loss")
                if wl is not None:
                    vl = float(wl)
                    # Artisan stores weight_loss as decimal (0..1) or percentage (>1)
                    pct = vl * 100.0 if vl <= 1 else vl
                    # Sanity: coffee weight loss is typically 10-25%, never > 50%
                    if 0 < pct < 50:
                        roast.weight_loss = pct
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
    except (json.JSONDecodeError, ValueError, zipfile.BadZipFile):
        pass

    await db.commit()
    return {"data": {"alog_file_path": profile_path}}


@router.get("/{roast_id}/profile")
async def download_profile(
    roast_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download .alog profile file for a roast. Serves from DB via temp file, then deletes temp."""
    try:
        roast_uuid = _parse_roast_id(roast_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    
    result = await db.execute(select(Roast).where(Roast.id == roast_uuid))
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    # Prefer blob from DB: write temp file, serve, delete after send
    rp_result = await db.execute(select(RoastProfile).where(RoastProfile.roast_id == roast_uuid))
    rp = rp_result.scalar_one_or_none()
    if rp and rp.data:
        fd, temp_path = tempfile.mkstemp(suffix=".alog", prefix="roast_")
        try:
            os.write(fd, rp.data)
            os.close(fd)
            background_tasks.add_task(os.unlink, temp_path)
            return FileResponse(
                temp_path,
                media_type="application/octet-stream",
                filename=f"{roast_uuid}.alog",
            )
        except Exception:
            try:
                os.close(fd)
            except OSError:
                pass
            try:
                os.unlink(temp_path)
            except OSError:
                pass
            raise
    if not roast.alog_file_path:
        raise HTTPException(status_code=404, detail="Profile file not found")
    file_path = f"/app{roast.alog_file_path}"
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=f"{roast_uuid}.alog",
    )


@router.get("/{roast_id}/profile/data", response_model=dict)
async def get_profile_data(
    roast_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return parsed .alog profile data (JSON) for chart and summary.
    
    If roast has telemetry in DB, returns that.
    Otherwise falls back to parsing .alog file.
    """
    try:
        roast_uuid = _parse_roast_id(roast_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid roast_id format")
    
    # NOTE: No user_id filter - all users can view profile data
    result = await db.execute(
        select(Roast).where(Roast.id == roast_uuid)
    )
    roast = result.scalar_one_or_none()
    if not roast:
        raise HTTPException(status_code=404, detail="Roast not found")
    
    # PRIORITY 0: Blob in DB (roast_profiles) — write temp file, parse, delete temp
    rp_result = await db.execute(select(RoastProfile).where(RoastProfile.roast_id == roast_uuid))
    rp = rp_result.scalar_one_or_none()
    if rp and rp.data:
        fd, temp_path = tempfile.mkstemp(suffix=".alog", prefix="roast_")
        try:
            os.write(fd, rp.data)
        finally:
            try:
                os.close(fd)
            except OSError:
                pass
        try:
            data = read_and_parse_alog(Path(temp_path))
            data = compute_computed_from_timeindex(data)
            # Add beans from reference_beans_notes if available (overrides .alog beans for reference profiles)
            if roast.is_reference and roast.reference_beans_notes:
                data["beans"] = roast.reference_beans_notes
            return ensure_artisan_background_profile(data)
        except (json.JSONDecodeError, ValueError, zipfile.BadZipFile) as e:
            logger.warning(f"Failed to parse .alog blob for roast {roast_uuid}: {e}")
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
    
    # PRIORITY 1: Try to read from .alog file on disk (has complete data: timeindex, computed, telemetry)
    alog_path = await get_alog_file(roast_uuid)
    if alog_path and alog_path.exists():
        try:
            data = read_and_parse_alog(alog_path)
            # Fill or supplement 'computed' from timeindex + timex/temp1/temp2
            # NOTE: In Artisan .alog format: temp1 = ET, temp2 = BT
            data = compute_computed_from_timeindex(data)
            # Add beans from reference_beans_notes if available (overrides .alog beans for reference profiles)
            if roast.is_reference and roast.reference_beans_notes:
                data["beans"] = roast.reference_beans_notes
            return ensure_artisan_background_profile(data)
        except (json.JSONDecodeError, ValueError, zipfile.BadZipFile) as e:
            # If .alog file is corrupted, fall through to DB telemetry
            logger.warning(f"Failed to parse .alog file for roast {roast_uuid}: {e}")
    
    # PRIORITY 2: If telemetry is stored in DB (раздельные поля), use it and compute from curve
    # NOTE: In Artisan .alog format: temp1 = ET, temp2 = BT
    if roast.timex or roast.temp1 or roast.temp2:
        timex = roast.timex or []
        temp1 = roast.temp1 or []
        temp2 = roast.temp2 or []
        timeindex_arr = roast.timeindex or []
        
        # If we have timeindex, use it to compute events precisely (like from .alog file)
        if timeindex_arr and len(timeindex_arr) >= 7:
            profile_data = {
                "timex": timex,
                "temp1": temp1,
                "temp2": temp2,
                "timeindex": timeindex_arr,
            }
            profile_data = compute_computed_from_timeindex(profile_data)
            computed = profile_data.get("computed", {})
        else:
            # Fallback: compute from arrays (only CHARGE, DROP, TP can be determined)
            computed = compute_computed_from_telemetry_arrays(timex, temp1, temp2)
        
        # Supplement with DB column values if available
        from_roast = {
            "CHARGE_BT": float(roast.charge_temp) if roast.charge_temp is not None else None,
            "TP_time": roast.TP_time,
            "TP_BT": float(roast.TP_temp) if roast.TP_temp is not None else None,
            "DRY_time": roast.DRY_time,
            "DRY_BT": float(roast.DRY_temp) if roast.DRY_temp is not None else None,
            "FCs_time": roast.FCs_time,
            "FCs_BT": float(roast.FCs_temp) if roast.FCs_temp is not None else None,
            "FCe_time": roast.FCe_time,
            "FCe_BT": float(roast.FCe_temp) if roast.FCe_temp is not None else None,
            "DROP_time": roast.drop_time,
            "DROP_BT": float(roast.drop_temp) if roast.drop_temp is not None else None,
            "totaltime": roast.drop_time,
            "dryphasetime": None,  # from phases below
            "midphasetime": None,
            "finishphasetime": roast.DEV_time,
        }
        if roast.DRY_time is not None and roast.FCs_time is not None:
            from_roast["dryphasetime"] = roast.DRY_time
            from_roast["midphasetime"] = roast.FCs_time - roast.DRY_time
        if roast.drop_time is not None and roast.FCs_time is not None:
            from_roast["finishphasetime"] = roast.drop_time - roast.FCs_time
        
        # Fill in missing computed values from DB columns
        for k, v in from_roast.items():
            if v is not None and k not in computed:
                computed[k] = v
        
        out = {
            "title": roast.label or roast.title,
            "timex": timex,
            "temp1": temp1,
            "temp2": temp2,
            "timeindex": timeindex_arr,
            "extra_temp1": roast.extra_temp1 or [],
            "extra_temp2": roast.extra_temp2 or [],
            "air": roast.air or [],
            "drum": roast.drum or [],
            "gas": roast.gas or [],
            "mode": roast.temp_unit or "C",
            "operator": roast.operator,
            "roastertype": roast.machine,
            "computed": computed,
        }
        # Add beans from reference_beans_notes if available
        if roast.is_reference and roast.reference_beans_notes:
            out["beans"] = roast.reference_beans_notes
        return ensure_artisan_background_profile(out)
    
    # PRIORITY 3: No telemetry, no .alog file - build minimal profile from roast record
    computed = {}
    if roast.charge_temp is not None:
        computed["CHARGE_BT"] = float(roast.charge_temp)
    if roast.TP_time is not None:
        computed["TP_time"] = roast.TP_time
    if roast.TP_temp is not None:
        computed["TP_BT"] = float(roast.TP_temp)
    if roast.DRY_time is not None:
        computed["DRY_time"] = roast.DRY_time
    if roast.DRY_temp is not None:
        computed["DRY_BT"] = float(roast.DRY_temp)
    if roast.FCs_time is not None:
        computed["FCs_time"] = roast.FCs_time
    if roast.FCs_temp is not None:
        computed["FCs_BT"] = float(roast.FCs_temp)
    if roast.FCe_time is not None:
        computed["FCe_time"] = roast.FCe_time
    if roast.FCe_temp is not None:
        computed["FCe_BT"] = float(roast.FCe_temp)
    if roast.drop_time is not None:
        computed["DROP_time"] = roast.drop_time
        computed["totaltime"] = roast.drop_time
    if roast.drop_temp is not None:
        computed["DROP_BT"] = float(roast.drop_temp)
    if roast.DRY_time is not None:
        computed["dryphasetime"] = roast.DRY_time
    if roast.DRY_time is not None and roast.FCs_time is not None:
        computed["midphasetime"] = roast.FCs_time - roast.DRY_time
    if roast.DEV_time is not None:
        computed["finishphasetime"] = roast.DEV_time
    elif roast.drop_time is not None and roast.FCs_time is not None:
        computed["finishphasetime"] = roast.drop_time - roast.FCs_time
    out = {
        "title": roast.label or roast.title,
        "mode": roast.temp_unit or "C",
        "operator": roast.operator,
        "roastertype": roast.machine,
        "timex": [],
        "temp1": [],
        "temp2": [],
        "computed": computed,
    }
    # Add beans from reference_beans_notes if available
    if roast.is_reference and roast.reference_beans_notes:
        out["beans"] = roast.reference_beans_notes
    return ensure_artisan_background_profile(out)


# Remaining goals endpoints (GET by ID, POST, PATCH, DELETE)
@router.get("/goals/{goal_id}", response_model=RoastGoalResponse)
async def get_goal_by_id(
    goal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific roast goal."""
    result = await db.execute(select(RoastGoal).where(RoastGoal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return goal


@router.post("/goals", status_code=status.HTTP_201_CREATED)
async def create_goal_endpoint(
    goal_data: RoastGoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
):
    """Create a new roast goal."""
    try:
        logger.info(f"Creating goal: {goal_data.name}, parameters: {len(goal_data.parameters)}")
        goal = RoastGoal(
            name=goal_data.name,
            goal_type=goal_data.goal_type,
            is_active=goal_data.is_active,
            failed_status=goal_data.failed_status,
            missing_value_status=goal_data.missing_value_status,
            parameters={
                param_name: {"enabled": param_config.enabled, "tolerance": param_config.tolerance}
                for param_name, param_config in goal_data.parameters.items()
            },
        )
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        logger.info(f"Goal created successfully: {goal.id}")
        # Return as dict for consistency
        return {
            "id": str(goal.id),
            "name": goal.name,
            "goal_type": goal.goal_type,
            "is_active": goal.is_active,
            "failed_status": goal.failed_status,
            "missing_value_status": goal.missing_value_status,
            "parameters": goal.parameters or {},
            "created_at": goal.created_at.isoformat() if goal.created_at else None,
            "updated_at": goal.updated_at.isoformat() if goal.updated_at else None,
        }
    except Exception as e:
        logger.error(f"Error creating goal: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/goals/{goal_id}", response_model=RoastGoalResponse)
async def update_goal_endpoint(
    goal_id: UUID,
    goal_data: RoastGoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
):
    """Update a roast goal."""
    result = await db.execute(select(RoastGoal).where(RoastGoal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    
    update_data = goal_data.model_dump(exclude_unset=True)
    if "parameters" in update_data and update_data["parameters"]:
        # Convert Pydantic models to dicts if needed
        if isinstance(update_data["parameters"], dict):
            new_params = {}
            for param_name, param_config in update_data["parameters"].items():
                if isinstance(param_config, dict):
                    # Already a dict (from JSONB)
                    new_params[param_name] = param_config
                else:
                    # Pydantic model
                    new_params[param_name] = {"enabled": param_config.enabled, "tolerance": param_config.tolerance}
            update_data["parameters"] = new_params
    
    for key, value in update_data.items():
        setattr(goal, key, value)
    
    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal_endpoint(
    goal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roasts_mutate),
):
    """Delete a roast goal."""
    result = await db.execute(select(RoastGoal).where(RoastGoal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    
    await db.delete(goal)
    await db.commit()
    return None
