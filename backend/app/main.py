from fastapi import FastAPI, WebSocket, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.config import settings
from app.api.v1.router import api_router
from app.ws.notifications import websocket_endpoint
from app.services.task_scheduler import start_scheduler, stop_scheduler
import os
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Artisan+ Local Server",
    description="Local server for Artisan desktop synchronization",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Static files for uploads
uploads_dir = "/app/uploads"
if os.path.exists(uploads_dir):
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Include routers
app.include_router(api_router, prefix="/api/v1")
# Alias for Artisan desktop compatibility (uses /apiv1 without slash)
app.include_router(api_router, prefix="/apiv1")

# WebSocket
app.websocket("/ws/notifications")(websocket_endpoint)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log validation errors for debugging."""
    logger.error(f"Validation error on {request.method} {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )


@app.on_event("startup")
async def startup_event():
    """Start background services on application startup"""
    start_scheduler()
    logger.info("Application started")


@app.on_event("shutdown")
async def shutdown_event():
    """Stop background services on application shutdown"""
    stop_scheduler()
    logger.info("Application shutdown")


@app.get("/")
async def root():
    return {"message": "Artisan+ Local Server API", "docs": "/docs"}
