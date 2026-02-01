from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("", response_model=dict)
async def list_notifications(
    current_user: User = Depends(get_current_user),
):
    """Artisan-compatible: return notifications list (empty for local server)."""
    return {"success": True, "result": []}


@router.put("/seen/{hr_id}", response_model=dict)
@router.post("/seen/{hr_id}", response_model=dict)
async def mark_notification_seen(
    hr_id: str,
    current_user: User = Depends(get_current_user),
):
    """Artisan-compatible: mark notification as seen (no-op for local server)."""
    return {"success": True}
