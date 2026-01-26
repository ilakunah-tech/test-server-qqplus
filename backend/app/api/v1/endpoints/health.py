from fastapi import APIRouter
from datetime import datetime
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    db_status = "disconnected"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception:
        pass
    
    return {
        "data": {
            "status": "ok",
            "version": "1.0.0",
            "database": db_status,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    }
