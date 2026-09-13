"""
Flight Service Orchestrator
Coordinates live providers and in-memory TTL caching to provide stable, normalized flight data.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List

from backend.app.config import get_settings
from backend.app.core.cache import flight_cache
from backend.app.models.flight import (
    NormalizedFlight,
    FlightCollectionResponse
)
from backend.app.services.providers.base import BaseFlightProvider
from backend.app.services.providers.opensky import OpenSkyProvider

logger = logging.getLogger(__name__)

class FlightService:
    """Service layer orchestrating live flight data retrieval, caching, and filtering."""

    def __init__(self, provider: Optional[BaseFlightProvider] = None):
        self.settings = get_settings()
        self.provider = provider or OpenSkyProvider()

    async def get_live_flights(
        self,
        lamin: Optional[float] = None,
        lomin: Optional[float] = None,
        lamax: Optional[float] = None,
        lomax: Optional[float] = None,
        nepal_only: bool = False,
        force_refresh: bool = False
    ) -> FlightCollectionResponse:
        """
        Retrieve live flights within bounds, using server-side TTL caching.
        
        Args:
            lamin, lomin, lamax, lomax: Optional coordinates overriding default Nepal bbox.
            nepal_only: If True, filter only aircraft with Nepalese ICAO24 allocation (70a8..).
            force_refresh: If True, bypass cache and fetch directly from provider.
        """
        # Resolve bounding box coordinates
        b_lamin = lamin if lamin is not None else self.settings.NEPAL_BBOX.lamin
        b_lomin = lomin if lomin is not None else self.settings.NEPAL_BBOX.lomin
        b_lamax = lamax if lamax is not None else self.settings.NEPAL_BBOX.lamax
        b_lomax = lomax if lomax is not None else self.settings.NEPAL_BBOX.lomax

        cache_key = f"live_flights_{b_lamin}_{b_lomin}_{b_lamax}_{b_lomax}"

        # Check in-memory TTL cache first
        if not force_refresh:
            cached_result = await flight_cache.get(cache_key)
            if cached_result is not None:
                cached_flights, age_seconds = cached_result
                flights_to_return = cached_flights
                if nepal_only:
                    flights_to_return = [f for f in cached_flights if f.identification.is_nepal_registered]

                logger.debug(f"Cache hit for key {cache_key} (age: {age_seconds:.1f}s)")
                return FlightCollectionResponse(
                    total=len(flights_to_return),
                    timestamp=datetime.now(timezone.utc),
                    cached=True,
                    cache_age_seconds=round(age_seconds, 1),
                    flights=flights_to_return
                )

        # Cache miss or forced refresh: query external provider
        logger.info(f"Cache miss for {cache_key}. Fetching live flights from provider '{self.provider.name}'...")
        flights = await self.provider.get_live_flights(
            lamin=b_lamin,
            lomin=b_lomin,
            lamax=b_lamax,
            lomax=b_lomax
        )

        # Update cache with full bounding box results
        ttl = float(self.settings.OPENSKY_CACHE_TTL_SECONDS)
        await flight_cache.set(cache_key, flights, ttl_seconds=ttl)

        # Apply filtering if requested
        flights_to_return = flights
        if nepal_only:
            flights_to_return = [f for f in flights if f.identification.is_nepal_registered]

        return FlightCollectionResponse(
            total=len(flights_to_return),
            timestamp=datetime.now(timezone.utc),
            cached=False,
            cache_age_seconds=0.0,
            flights=flights_to_return
        )

    async def get_flight_by_id(self, icao24: str) -> Optional[NormalizedFlight]:
        """Look up a specific flight by 24-bit ICAO address in the current airspace cache."""
        target_icao = icao24.lower().strip()
        live_res = await self.get_live_flights()
        for flight in live_res.flights:
            if flight.identification.icao24 == target_icao:
                return flight
        return None

# Global service singleton
flight_service = FlightService()
