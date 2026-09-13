"""
Flight Service Orchestrator
Coordinates live providers and in-memory TTL caching to provide stable, normalized flight data.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List

from app.config import get_settings
from app.core.cache import flight_cache
from app.models.flight import (
    NormalizedFlight,
    FlightCollectionResponse
)
from app.services.providers.base import BaseFlightProvider
from app.services.providers.opensky import OpenSkyProvider
from app.services.enrichment import enrichment_service

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
        source: Optional[str] = None,
        enriched: bool = True,
        force_refresh: bool = False
    ) -> FlightCollectionResponse:
        """
        Retrieve live flights within bounds, using server-side TTL caching.
        Maintains a canonical regional envelope to prevent OpenSky rate limiting
        on viewport pan/zoom, while slicing flights accurately in memory.
        
        Args:
            lamin, lomin, lamax, lomax: Optional coordinates overriding default Nepal bbox.
            nepal_only: If True, filter only aircraft with Nepalese ICAO24 allocation (70a8..).
            source: If provided, filter by surveillance technology (e.g. 'ADS-B', 'MLAT', 'UAT').
            enriched: If True, enrich flights with airport proximity and aircraft performance specs.
            force_refresh: If True, bypass cache and fetch directly from provider.
        """
        reg_lamin = self.settings.NEPAL_BBOX.lamin
        reg_lomin = self.settings.NEPAL_BBOX.lomin
        reg_lamax = self.settings.NEPAL_BBOX.lamax
        reg_lomax = self.settings.NEPAL_BBOX.lomax

        # Check if requested bounds fit within or near the canonical regional envelope
        is_sub_regional = (
            (lamin is None or lamin >= reg_lamin - 0.5) and
            (lomin is None or lomin >= reg_lomin - 0.5) and
            (lamax is None or lamax <= reg_lamax + 0.5) and
            (lomax is None or lomax <= reg_lomax + 0.5)
        )

        if is_sub_regional:
            cache_key = "live_flights_nepal_regional"
            query_lamin, query_lomin = reg_lamin, reg_lomin
            query_lamax, query_lomax = reg_lamax, reg_lomax
        else:
            b_lamin = lamin if lamin is not None else reg_lamin
            b_lomin = lomin if lomin is not None else reg_lomin
            b_lamax = lamax if lamax is not None else reg_lamax
            b_lomax = lomax if lomax is not None else reg_lomax
            cache_key = f"live_flights_{b_lamin:.2f}_{b_lomin:.2f}_{b_lamax:.2f}_{b_lomax:.2f}"
            query_lamin, query_lomin = b_lamin, b_lomin
            query_lamax, query_lomax = b_lamax, b_lomax

        flights: List[NormalizedFlight] = []
        is_cached = False
        cache_age = 0.0

        # Check in-memory TTL cache first
        if not force_refresh:
            cached_result = await flight_cache.get(cache_key)
            if cached_result is not None:
                flights, cache_age = cached_result
                is_cached = True
                logger.debug(f"Cache hit for key {cache_key} (age: {cache_age:.1f}s)")

        # Cache miss or forced refresh: query external provider
        if not is_cached:
            logger.info(f"Cache miss for {cache_key}. Fetching live flights from provider '{self.provider.name}'...")
            flights = await self.provider.get_live_flights(
                lamin=query_lamin,
                lomin=query_lomin,
                lamax=query_lamax,
                lomax=query_lomax
            )

            # Enrich flights if requested
            if enriched:
                flights = await enrichment_service.enrich_flight_collection(flights)

            # Update cache with full regional results
            ttl = float(self.settings.OPENSKY_CACHE_TTL_SECONDS)
            await flight_cache.set(cache_key, flights, ttl_seconds=ttl)

        # Apply in-memory spatial filtering if specific sub-bounds were requested
        filtered_flights = flights
        if lamin is not None and lomin is not None and lamax is not None and lomax is not None:
            # Add small padding buffer (0.15 deg ~ 16km) so edge aircraft remain visible during pan/zoom
            pad = 0.15
            filtered_flights = [
                f for f in filtered_flights
                if (
                    f.position.latitude is None or
                    f.position.longitude is None or
                    ((lamin - pad) <= f.position.latitude <= (lamax + pad) and
                     (lomin - pad) <= f.position.longitude <= (lomax + pad))
                )
            ]

        # Apply Nepalese registry filter if requested
        if nepal_only:
            filtered_flights = [f for f in filtered_flights if f.identification.is_nepal_registered]

        # Apply Surveillance Source filter if requested (ADS-B, MLAT, UAT, etc.)
        if source:
            src_norm = source.lower().strip()
            filtered_flights = [
                f for f in filtered_flights
                if f.identification.position_source and src_norm in f.identification.position_source.lower()
            ]

        return FlightCollectionResponse(
            total=len(filtered_flights),
            timestamp=datetime.now(timezone.utc),
            cached=is_cached,
            cache_age_seconds=round(cache_age, 1),
            flights=filtered_flights
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
