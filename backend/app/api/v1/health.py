from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from app.config import get_settings
from app import __version__
from app.services.supabase.client import check_supabase_connection

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

@router.get("/health/db")
async def get_database_health():
    """Probe Supabase PostgreSQL database connection, latency, and status."""
    return await check_supabase_connection()
