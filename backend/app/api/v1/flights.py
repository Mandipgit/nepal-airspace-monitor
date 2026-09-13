"""
Flight API Endpoints
Provides normalized live aircraft tracking data for the frontend.
"""

from typing import Optional
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Query, HTTPException, status

from app.models.flight import (
    FlightCollectionResponse,
    NormalizedFlight
)
from app.services.flight_service import flight_service
from app.core.cache import flight_cache
from app.core.errors import FlightNotFoundError

router = APIRouter(prefix="/flights", tags=["Flights"])

@router.get("/live", response_model=FlightCollectionResponse)
async def get_live_flights(
    lamin: Optional[float] = Query(None, description="Southern latitude bound override"),
    lomin: Optional[float] = Query(None, description="Western longitude bound override"),
    lamax: Optional[float] = Query(None, description="Northern latitude bound override"),
    lomax: Optional[float] = Query(None, description="Eastern longitude bound override"),
    nepal_only: bool = Query(False, description="Filter only Nepalese registered aircraft (70a8.. ICAO24 prefix)"),
    source: Optional[str] = Query(None, description="Filter by surveillance source (e.g. ADS-B, MLAT, UAT)"),
    enriched: bool = Query(True, description="Enrich with aircraft specs and nearest airport proximity"),
    force_refresh: bool = Query(False, description="Bypass server-side cache and query provider immediately")
):
    """
    Fetch active live flights within the Nepal bounding box.
    Cached on server for the configured TTL window (default 10s) to protect API limits.
    """
    return await flight_service.get_live_flights(
        lamin=lamin,
        lomin=lomin,
        lamax=lamax,
        lomax=lomax,
        nepal_only=nepal_only,
        source=source,
        enriched=enriched,
        force_refresh=force_refresh
    )

@router.get("/cache/stats")
async def get_cache_statistics():
    """Diagnostic endpoint returning server-side cache hit ratio and status."""
    return await flight_cache.get_stats()

@router.get("/{icao24}", response_model=NormalizedFlight)
async def get_flight_details(icao24: str):
    """
    Fetch telemetry details for a specific flight by 24-bit ICAO transponder address.
    """
    flight = await flight_service.get_flight_by_id(icao24)
    if not flight:
        raise FlightNotFoundError(identifier=icao24)
    return flight
