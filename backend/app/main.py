import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.logging import setup_logging
from app.core.errors import AppError, app_error_handler
from app.api.v1.router import api_v1_router
from app.api.v1.health import router as health_router
from app import __version__

logger = setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    settings = get_settings()
    logger.info(f"Starting Nepal Flight Tracker API v{__version__} [{settings.ENVIRONMENT}]")
    logger.info(f"Allowed CORS origins: {settings.ALLOWED_ORIGINS}")
    logger.info(f"Default Nepal bounding box: {settings.NEPAL_BBOX.model_dump()}")
    yield
    logger.info("Shutting down Nepal Flight Tracker API")

def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()
    
    app = FastAPI(
        title="Nepal Flight Tracker API",
        description="A specialized, provider-independent aviation API for tracking and enriching flights in Nepal.",
        version=__version__,
        lifespan=lifespan
    )
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Exception Handlers
    app.add_exception_handler(AppError, app_error_handler)
    
    # Routers
    # Direct /health for container/load-balancer liveness checks
    app.include_router(health_router)
    # Versioned API routes under /api/v1
    app.include_router(api_v1_router, prefix="/api/v1")
    
    return app

app = create_app()

if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development")
    )
