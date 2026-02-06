"""Service for checking roasts against goals."""
import logging
from typing import Dict, Optional, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.roast import Roast
from app.models.roast_goal import RoastGoal
from app.models.roast_profile import RoastProfile
from app.services.file_service import read_and_parse_alog, get_alog_file
from pathlib import Path

logger = logging.getLogger(__name__)


def check_parameter(
    reference_value: Optional[float],
    actual_value: Optional[float],
    tolerance: float,
) -> Dict[str, Any]:
    """
    Check if actual value is within tolerance of reference value.

    - actual or reference None → yellow (missing data).
    - In range [ref - tolerance/2, ref + tolerance/2] → green.
    - Outside range → red (then goal.failed_status can downgrade to yellow if "warning").

    Args:
        reference_value: Target value from reference profile
        actual_value: Actual value from roast
        tolerance: Tolerance (will be divided by 2: ±tolerance/2). If 0, only exact match passes.
    """
    if actual_value is None:
        return {"status": "yellow", "message": "Значение отсутствует в обжарке"}

    if reference_value is None:
        return {"status": "yellow", "message": "Значение отсутствует в референсе"}

    half_tolerance = tolerance / 2.0
    if half_tolerance <= 0:
        half_tolerance = 1e-6
    min_value = reference_value - half_tolerance
    max_value = reference_value + half_tolerance

    if min_value <= actual_value <= max_value:
        return {
            "status": "green",
            "message": f"В рамках ({min_value:.1f} - {max_value:.1f})",
            "reference": reference_value,
            "actual": actual_value,
            "range": [min_value, max_value],
        }
    else:
        return {
            "status": "red",
            "message": f"Вне рамок ({min_value:.1f} - {max_value:.1f})",
            "reference": reference_value,
            "actual": actual_value,
            "range": [min_value, max_value],
        }


async def get_reference_profile(
    background_uuid: UUID,
    db: AsyncSession,
) -> Optional[Dict[str, Any]]:
    """
    Get reference profile by UUID.
    
    First tries to get from roast_profiles blob, then from disk.
    """
    # Find reference roast
    result = await db.execute(
        select(Roast).where(
            Roast.id == background_uuid,
            Roast.is_reference == True
        )
    )
    reference_roast = result.scalar_one_or_none()
    
    if not reference_roast:
        logger.warning(f"Reference roast not found: {background_uuid}")
        return None
    
    # Try to get profile from roast_profiles blob
    rp_result = await db.execute(
        select(RoastProfile).where(RoastProfile.roast_id == background_uuid)
    )
    rp = rp_result.scalar_one_or_none()
    
    if rp and rp.data:
        import tempfile
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.alog', delete=False) as tmp:
            tmp.write(rp.data)
            tmp_path = Path(tmp.name)
        try:
            profile_data = read_and_parse_alog(tmp_path)
            tmp_path.unlink()
            return profile_data
        except Exception as e:
            logger.error(f"Error parsing profile from blob: {e}")
            tmp_path.unlink()
    
    # Fallback to disk
    if reference_roast.alog_file_path:
        file_path = Path(reference_roast.alog_file_path.lstrip('/'))
        if file_path.exists():
            try:
                return read_and_parse_alog(file_path)
            except Exception as e:
                logger.error(f"Error reading profile from disk: {e}")
    
    # Fallback: use roast data from DB
    return {
        "charge_temp": reference_roast.charge_temp,
        "drop_temp": reference_roast.drop_temp,
        "TP_temp": reference_roast.TP_temp,
        "DRY_temp": reference_roast.DRY_temp,
        "FCs_temp": reference_roast.FCs_temp,
        "drop_time": reference_roast.drop_time,
        "DEV_time": reference_roast.DEV_time,
        "DEV_ratio": reference_roast.DEV_ratio,
        "DRY_time": reference_roast.DRY_time,
        "green_weight_kg": float(reference_roast.green_weight_kg) if reference_roast.green_weight_kg else None,
        "roasted_weight_kg": float(reference_roast.roasted_weight_kg) if reference_roast.roasted_weight_kg else None,
        "weight_loss": reference_roast.weight_loss,
        "whole_color": reference_roast.whole_color if reference_roast.whole_color > 0 else None,
        "ground_color": reference_roast.ground_color if reference_roast.ground_color > 0 else None,
    }


async def check_roast_against_goals(
    roast: Roast,
    db: AsyncSession,
) -> Optional[Dict[str, Any]]:
    """
    Check a roast against all active goals.
    
    Returns:
        Dict with 'status' ('green' | 'yellow' | 'red') and 'goals' (list of goal check results)
    """
    # Get active goals
    result = await db.execute(
        select(RoastGoal).where(RoastGoal.is_active == True)
    )
    goals = result.scalars().all()
    
    if not goals:
        # Если нет активных целей, не проверяем - возвращаем None (статус не будет установлен)
        return None
    
    # Get background UUID from roast profile
    background_uuid = None
    
    # Try to get from .alog file
    if roast.alog_file_path:
        file_path = Path(roast.alog_file_path.lstrip('/'))
        if file_path.exists():
            try:
                profile_data = read_and_parse_alog(file_path)
                background_uuid_str = profile_data.get("backgroundUUID")
                if background_uuid_str:
                    try:
                        background_uuid = UUID(background_uuid_str)
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid backgroundUUID: {background_uuid_str}")
            except Exception as e:
                logger.error(f"Error reading roast profile: {e}")
    
    # Fallback: try from roast_profiles blob
    if not background_uuid:
        rp_result = await db.execute(
            select(RoastProfile).where(RoastProfile.roast_id == roast.id)
        )
        rp = rp_result.scalar_one_or_none()
        if rp and rp.data:
            import tempfile
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.alog', delete=False) as tmp:
                tmp.write(rp.data)
                tmp_path = Path(tmp.name)
            try:
                profile_data = read_and_parse_alog(tmp_path)
                background_uuid_str = profile_data.get("backgroundUUID")
                if background_uuid_str:
                    try:
                        background_uuid = UUID(background_uuid_str)
                    except (ValueError, TypeError):
                        pass
            except Exception as e:
                logger.error(f"Error parsing profile from blob: {e}")
            finally:
                tmp_path.unlink()
    
    if not background_uuid:
        return {
            "status": "yellow",
            "goals": [],
            "message": "Не найден референсный профиль (backgroundUUID отсутствует)",
        }
    
    # Get reference profile
    reference_profile = await get_reference_profile(background_uuid, db)
    if not reference_profile:
        return {
            "status": "yellow",
            "goals": [],
            "message": "Референсный профиль не найден",
        }
    
    # Extract reference values (prefer computed, fallback to direct fields)
    computed = reference_profile.get("computed", {})
    ref_values = {
        "charge_temp": computed.get("CHARGE_BT") or reference_profile.get("charge_temp"),
        "drop_temp": computed.get("DROP_BT") or reference_profile.get("drop_temp"),
        "TP_temp": computed.get("TP_BT") or reference_profile.get("TP_temp"),
        "DRY_temp": computed.get("DRY_BT") or reference_profile.get("DRY_temp"),
        "FCs_temp": computed.get("FCs_BT") or reference_profile.get("FCs_temp"),
        "total_time": computed.get("totaltime") or reference_profile.get("drop_time"),
        "FCs_time": computed.get("FCs_time") or reference_profile.get("FCs_time"),
        "DEV_time": computed.get("finishphasetime") or reference_profile.get("DEV_time"),
        "DEV_ratio": reference_profile.get("DEV_ratio"),
        "DRY_time": computed.get("DRY_time") or reference_profile.get("DRY_time"),
        "green_weight_kg": reference_profile.get("green_weight_kg"),
        "roasted_weight_kg": reference_profile.get("roasted_weight_kg"),
        "weight_loss": reference_profile.get("weight_loss"),
        "whole_color": reference_profile.get("whole_color"),
        "ground_color": reference_profile.get("ground_color"),
    }
    
    # Extract actual values from roast
    actual_values = {
        "charge_temp": roast.charge_temp,
        "drop_temp": roast.drop_temp,
        "TP_temp": roast.TP_temp,
        "DRY_temp": roast.DRY_temp,
        "FCs_temp": roast.FCs_temp,
        "total_time": roast.drop_time,
        "FCs_time": roast.FCs_time,
        "DEV_time": roast.DEV_time,
        "DEV_ratio": roast.DEV_ratio,
        "DRY_time": roast.DRY_time,
        "green_weight_kg": float(roast.green_weight_kg) if roast.green_weight_kg else None,
        "roasted_weight_kg": float(roast.roasted_weight_kg) if roast.roasted_weight_kg else None,
        "weight_loss": roast.weight_loss,
        "whole_color": roast.whole_color if roast.whole_color > 0 else None,
        "ground_color": roast.ground_color if roast.ground_color > 0 else None,
    }
    
    # Check against each goal
    overall_status = "green"
    goal_results = []
    
    for goal in goals:
        goal_params = goal.parameters or {}
        goal_status = "green"
        checked_params = {}
        
        for param_name, param_config in goal_params.items():
            if not param_config.get("enabled", False):
                continue
            
            tolerance = param_config.get("tolerance", 0)
            ref_value = ref_values.get(param_name)
            actual_value = actual_values.get(param_name)
            
            result = check_parameter(ref_value, actual_value, tolerance)
            checked_params[param_name] = result
            
            # Update goal status with respect to failed_status and missing_value_status
            if result["status"] == "red":
                if goal.failed_status == "warning":
                    goal_status = "yellow" if goal_status != "red" else goal_status
                else:
                    goal_status = "red"
            elif result["status"] == "yellow" and goal_status != "red":
                if goal.missing_value_status == "failed":
                    goal_status = "red"
                else:
                    goal_status = "yellow"
        
        if not checked_params:
            continue
        goal_results.append({
            "goal_id": str(goal.id),
            "goal_name": goal.name,
            "status": goal_status,
            "parameters": checked_params,
        })
        if goal_status == "red":
            overall_status = "red"
        elif goal_status == "yellow" and overall_status == "green":
            overall_status = "yellow"

    if not goal_results:
        return None
    return {
        "status": overall_status,
        "goals": goal_results,
        "reference_roast_id": str(background_uuid),
    }
