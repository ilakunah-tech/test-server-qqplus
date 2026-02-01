from fastapi import APIRouter
from app.api.v1.endpoints import auth, inventory, roasts, schedule, health, blends, notifications, machines
from app.api.v1.endpoints.roasts import create_or_update_roast, get_roast

api_router = APIRouter()

# Auth
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Machines (catalog + user's organization machines)
api_router.include_router(machines.router, prefix="/machines", tags=["machines"])

# Inventory
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])

# Roasts (web UI and Artisan)
api_router.include_router(roasts.router, prefix="/roasts", tags=["roasts"])

# Artisan desktop: POST/GET на /api/v1/aroast (без /roasts в пути)
# These are the primary endpoints for Artisan Plus protocol
api_router.add_api_route("/aroast", create_or_update_roast, methods=["POST"], tags=["roasts"])
api_router.add_api_route("/aroast/{roast_id}", get_roast, methods=["GET"], tags=["roasts"])

# Blends
api_router.include_router(blends.router, prefix="/blends", tags=["blends"])

# Schedule
api_router.include_router(schedule.router, prefix="/schedule", tags=["schedule"])

# Notifications (WebSocket)
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])

# Health check
api_router.include_router(health.router, tags=["health"])
