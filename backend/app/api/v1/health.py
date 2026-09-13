"""
Health check endpoint
Provides system liveness and basic environment metadata.
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from backend.app.config import get_settings
from backend.app import __version__

router = APIRouter(tags=["System"])

class HealthResponse(BaseModel):
    status: str
    environment: str
    version: str
    timestamp: str

@router.get("/health", response_model=HealthResponse)
async def get_health():
    """Liveness probe returning application health and runtime environment."""
    settings = get_settings()
    return HealthResponse(
        status="healthy",
        environment=settings.ENVIRONMENT,
        version=__version__,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
