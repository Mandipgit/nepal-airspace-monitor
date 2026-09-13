"""
Application Configuration Settings
Loads configuration from environment variables and .env file.
"""

import os
from functools import lru_cache
from typing import List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

# Load .env if python-dotenv is installed
try:
    # pyrefly: ignore [missing-import]
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class BoundingBoxConfig(BaseModel):
    lamin: float = Field(default=25.80, description="Southern latitude bound (Nepal FIR corridor)")
    lomin: float = Field(default=79.80, description="Western longitude bound")
    lamax: float = Field(default=30.65, description="Northern latitude bound")
    lomax: float = Field(default=88.50, description="Eastern longitude bound")

class Settings(BaseModel):
    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if origin.strip()
    ]
    
    # OpenSky Network
    OPENSKY_USERNAME: str = os.getenv("OPENSKY_USERNAME", "")
    OPENSKY_PASSWORD: str = os.getenv("OPENSKY_PASSWORD", "")
    OPENSKY_CLIENT_ID: str = os.getenv("OPENSKY_CLIENT_ID", "")
    OPENSKY_CLIENT_SECRET: str = os.getenv("OPENSKY_CLIENT_SECRET", "")
    OPENSKY_BASE_URL: str = os.getenv("OPENSKY_BASE_URL", "https://opensky-network.org/api")
    OPENSKY_CACHE_TTL_SECONDS: int = int(os.getenv("OPENSKY_CACHE_TTL_SECONDS", "10"))
    
    # FlightAware AeroAPI (Reserved for Phase 9)
    FLIGHTAWARE_API_KEY: str = os.getenv("FLIGHTAWARE_API_KEY", "")
    
    # Supabase (PostgreSQL) Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").rstrip("/")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")

    def get_canonical_supabase_url(self) -> str:
        """Return base Supabase project URL without trailing /rest/v1."""
        url = self.SUPABASE_URL.rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[:-8].rstrip("/")
        return url
    
    # Nepal Airspace Bounding Box Defaults (Full Regional Corridor)
    NEPAL_BBOX: BoundingBoxConfig = BoundingBoxConfig(
        lamin=float(os.getenv("NEPAL_BOUNDING_BOX_LAMIN", "25.00")),
        lomin=float(os.getenv("NEPAL_BOUNDING_BOX_LOMIN", "79.00")),
        lamax=float(os.getenv("NEPAL_BOUNDING_BOX_LAMAX", "31.50")),
        lomax=float(os.getenv("NEPAL_BOUNDING_BOX_LOMAX", "89.50"))
    )

@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
