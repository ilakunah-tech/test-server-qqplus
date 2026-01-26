from fastapi import APIRouter
from app.api.v1.endpoints import auth, inventory, roasts, schedule, health

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(roasts.router, prefix="/roasts", tags=["roasts"])
api_router.include_router(schedule.router, prefix="/schedule", tags=["schedule"])
api_router.include_router(health.router, tags=["health"])
