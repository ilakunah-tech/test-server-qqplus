from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.api.v1.router import api_router
from app.ws.notifications import websocket_endpoint
import os

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
)

# Static files for uploads
uploads_dir = "/app/uploads"
if os.path.exists(uploads_dir):
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Include routers
app.include_router(api_router, prefix="/apiv1")

# WebSocket
app.websocket("/ws/notifications")(websocket_endpoint)


@app.get("/")
async def root():
    return {"message": "Artisan+ Local Server API", "docs": "/docs"}
