from fastapi import WebSocket, WebSocketDisconnect, Depends
from typing import Set
from app.core.security import decode_access_token
from app.core.logger import logger
import json
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("WebSocket connected", total_connections=len(self.active_connections))
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info("WebSocket disconnected", total_connections=len(self.active_connections))
    
    async def send_notification(self, event_type: str, payload: dict):
        message = {
            "type": "notification",
            "event_type": event_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error("Failed to send notification", error=str(e))
                disconnected.add(connection)
        
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()


async def get_token_from_query(websocket: WebSocket) -> str | None:
    query_params = dict(websocket.query_params)
    return query_params.get("token")


async def verify_websocket_token(token: str) -> bool:
    payload = decode_access_token(token)
    return payload is not None


async def websocket_endpoint(websocket: WebSocket):
    token = await get_token_from_query(websocket)
    if not token or not await verify_websocket_token(token):
        await websocket.close(code=1008, reason="Unauthorized")
        return
    
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            # Echo back for ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
