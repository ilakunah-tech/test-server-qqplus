from fastapi import WebSocket, WebSocketDisconnect
from typing import Set, Dict, Optional
from uuid import UUID
from app.core.security import decode_access_token
from app.core.logger import logger
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        self._connections: Dict[WebSocket, str] = {}  # ws -> user_id

    @property
    def active_connections(self) -> Set[WebSocket]:
        return set(self._connections.keys())

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self._connections[websocket] = user_id
        logger.info("WebSocket connected", user_id=user_id, total=len(self._connections))

    def disconnect(self, websocket: WebSocket):
        self._connections.pop(websocket, None)
        logger.info("WebSocket disconnected", total=len(self._connections))

    async def send_notification(self, event_type: str, payload: dict, target_user_id: Optional[str] = None):
        """Send notification. If target_user_id is set, only to that user's connections (e.g. production_task)."""
        message = {
            "type": "notification",
            "event_type": event_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        disconnected = []
        for connection, conn_user_id in list(self._connections.items()):
            if target_user_id and conn_user_id != target_user_id:
                continue
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error("Failed to send notification", error=str(e))
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()


async def get_token_from_query(websocket: WebSocket) -> Optional[str]:
    query_params = dict(websocket.query_params)
    return query_params.get("token")


async def get_user_id_from_token(token: str) -> Optional[str]:
    payload = decode_access_token(token)
    return payload.get("sub") if payload else None


async def websocket_endpoint(websocket: WebSocket):
    token = await get_token_from_query(websocket)
    user_id = await get_user_id_from_token(token) if token else None
    if not token or not user_id:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            # Echo back for ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
