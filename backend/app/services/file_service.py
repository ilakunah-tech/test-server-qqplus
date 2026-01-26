import os
from pathlib import Path
from uuid import UUID
from fastapi import UploadFile
from app.core.logger import logger

UPLOAD_DIR = Path("/app/uploads/roasts")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def save_alog_file(roast_id: UUID, file: UploadFile) -> str:
    """Save .alog file for a roast and return the file path."""
    file_extension = Path(file.filename).suffix or ".alog"
    if file_extension != ".alog":
        file_extension = ".alog"
    
    file_path = UPLOAD_DIR / f"{roast_id}{file_extension}"
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    relative_path = f"/uploads/roasts/{roast_id}{file_extension}"
    logger.info("Saved profile file", roast_id=str(roast_id), path=str(file_path))
    return relative_path


async def get_alog_file(roast_id: UUID) -> Path | None:
    """Get .alog file path for a roast."""
    for ext in [".alog", ".ALOG"]:
        file_path = UPLOAD_DIR / f"{roast_id}{ext}"
        if file_path.exists():
            return file_path
    return None
