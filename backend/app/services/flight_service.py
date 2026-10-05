"""
Flight Service Orchestrator
Coordinates live providers and in-memory TTL caching to provide stable, normalized flight data.
"""

import time
import math
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Tuple


from app.config import get_settings
from app.core.cache import flight_cache
from app.models.flight import (
    NormalizedFlight,
    FlightCollectionResponse,
    TrajectoryPoint,
    FlightTrajectoryResponse
)
from app.services.providers.base import BaseFlightProvider
from app.services.providers.opensky import OpenSkyProvider
from app.services.enrichment import enrichment_service, get_airport_coords
from app.services.nepal_airspace import should_display_flight_in_nepal_context

logger = logging.getLogger(__name__)

class FlightService:
    """Service layer orchestrating live flight data retrieval, caching, and filtering."""

    def __init__(self, provider: Optional[BaseFlightProvider] = None):
        self.settings = get_settings()
        self.provider = provider or OpenSkyProvider()
        # Track persistence buffer: icao24 -> (NormalizedFlight, last_seen_monotonic)
        # Keeps aircraft alive for 75 seconds during mountain terrain shadow/fade, matching tar1090
        self._track_store: Dict[str, Tuple[NormalizedFlight, float]] = {}
        # Trajectory breadcrumb store: icao24 -> List[TrajectoryPoint]
        self._trajectory_store: Dict[str, List[TrajectoryPoint]] = {}
        self._trajectory_metadata: Dict[str, Optional[str]] = {}
        self._trajectory_last_seen: Dict[str, float] = {}
        self._track_lock = asyncio.Lock()
        self.track_retention_seconds: float = 75.0


    async def get_live_flights(
        self,
        lamin: Optional[float] = None,
        lomin: Optional[float] = None,
        lamax: Optional[float] = None,
        lomax: Optional[float] = None,
        nepal_only: bool = False,
        nepal_context_only: bool = True,
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

        # Check if requested bounds fit within or near the canonical regional radar envelope
        # Regional envelope covers 24.0°N to 32.5°N and 77.5°E to 90.5°E (Nepal FIR + arrival/departure corridors)
        is_sub_regional = (
            (lamin is None or lamin >= 23.5) and
            (lomin is None or lomin >= 77.0) and
            (lamax is None or lamax <= 33.0) and
            (lomax is None or lomax <= 91.5)
        )

        if is_sub_regional:
            cache_key = "live_flights_nepal_regional"
            query_lamin = min(reg_lamin, 24.20)
            query_lomin = min(reg_lomin, 78.00)
            query_lamax = max(reg_lamax, 32.20)
            query_lomax = max(reg_lomax, 90.00)
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
            raw_flights = await self.provider.get_live_flights(
                lamin=query_lamin,
                lomin=query_lomin,
                lamax=query_lamax,
                lomax=query_lomax
            )

            # Fast in-memory enrichment: nearest airport, Nepal fleet identity & specs, cached routes
            if enriched:
                for f in raw_flights:
                    nearest_apt, dist_km = enrichment_service._find_nearest_airport(
                        f.position.latitude,
                        f.position.longitude
                    )
                    f.nearest_airport = nearest_apt
                    f.nearest_airport_distance_km = dist_km

                    # Immediate Nepal fleet CAAN specification linkage
                    icao = (f.identification.icao24 or "").lower().strip()
                    if enrichment_service._is_nepal_candidate(f) and icao:
                        nepal_ac = await enrichment_service._resolve_nepal_aircraft(icao, f.identification.registration)
                        if nepal_ac:
                            enrichment_service._apply_nepal_aircraft_enrichment(f, nepal_ac)

                    # Attach already resolved / cached route
                    cs = (f.identification.callsign or "").strip().upper()
                    lookup_key = cs or icao
                    if lookup_key:
                        cached_route = enrichment_service._resolve_flight_route(f)
                        if cached_route:
                            f.route = cached_route

                # Trigger background task for external route APIs and ADS-B DB metadata lookups
                asyncio.create_task(self._enrich_and_update_cache(cache_key, list(raw_flights)))

            now_mono = time.monotonic()
            now_utc = datetime.now(timezone.utc)

            # Merge with track persistence store to prevent flicker during intermittent mountain coverage
            async with self._track_lock:
                for f in raw_flights:
                    icao = f.identification.icao24
                    # Preserve previously enriched attributes to avoid specification dropping on cache misses
                    if icao in self._track_store:
                        prev_flight, _ = self._track_store[icao]
                        if not f.aircraft_spec and prev_flight.aircraft_spec:
                            f.aircraft_spec = prev_flight.aircraft_spec
                        if not f.nepal_aircraft and prev_flight.nepal_aircraft:
                            f.nepal_aircraft = prev_flight.nepal_aircraft
                        if not f.route and prev_flight.route:
                            f.route = prev_flight.route
                        if not f.identification.aircraft_type_icao and prev_flight.identification.aircraft_type_icao:
                            f.identification.aircraft_type_icao = prev_flight.identification.aircraft_type_icao
                        if not f.identification.registration and prev_flight.identification.registration:
                            f.identification.registration = prev_flight.identification.registration
                        if not f.identification.operator_name and prev_flight.identification.operator_name:
                            f.identification.operator_name = prev_flight.identification.operator_name
                        if not f.identification.operator_icao and prev_flight.identification.operator_icao:
                            f.identification.operator_icao = prev_flight.identification.operator_icao

                    self._track_store[icao] = (f, now_mono)
                    self._trajectory_last_seen[icao] = now_mono
                    if f.identification.callsign:
                        self._trajectory_metadata[icao] = f.identification.callsign

                    # Accumulate spatial breadcrumb points
                    if f.position.latitude is not None and f.position.longitude is not None:
                        points = self._trajectory_store.setdefault(icao, [])
                        new_pt = TrajectoryPoint(
                            latitude=f.position.latitude,
                            longitude=f.position.longitude,
                            altitude_ft=f.position.altitude_baro_ft,
                            groundspeed_kts=f.position.groundspeed_kts,
                            heading_deg=f.position.heading_deg,
                            timestamp=f.position.timestamp or now_utc
                        )
                        if not points:
                            points.append(new_pt)
                        else:
                            last = points[-1]
                            # Only append when coordinates have moved or altitude changed
                            if abs(last.latitude - new_pt.latitude) > 0.0003 or abs(last.longitude - new_pt.longitude) > 0.0003:
                                points.append(new_pt)
                                if len(points) > 120:
                                    points.pop(0)

                pruned_store: Dict[str, Tuple[NormalizedFlight, float]] = {}
                persistent_flights: List[NormalizedFlight] = []
                for icao, (f, seen_mono) in self._track_store.items():
                    age_seconds = now_mono - seen_mono
                    if age_seconds <= self.track_retention_seconds:
                        # Recalculate freshness based on last contact
                        if f.last_contact:
                            f.data_freshness_seconds = max(0.0, (now_utc - f.last_contact).total_seconds())
                        pruned_store[icao] = (f, seen_mono)
                        persistent_flights.append(f)

                self._track_store = pruned_store
                flights = persistent_flights

                # Prune stale trajectories inactive for > 2 hours
                stale_cutoff = now_mono - 7200.0
                stale_icaos = [
                    ic for ic, seen in self._trajectory_last_seen.items()
                    if seen < stale_cutoff
                ]
                for ic in stale_icaos:
                    self._trajectory_store.pop(ic, None)
                    self._trajectory_metadata.pop(ic, None)
                    self._trajectory_last_seen.pop(ic, None)

            # Update cache with full persistent regional results
            ttl = float(self.settings.OPENSKY_CACHE_TTL_SECONDS)
            await flight_cache.set(cache_key, flights, ttl_seconds=ttl)


        # Apply in-memory spatial filtering if viewport bounds are specified
        filtered_flights = flights
        if lamin is not None and lomin is not None and lamax is not None and lomax is not None:
            pad = 0.08
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

        # Apply Nepal Airspace Context Filter:
        # Keep flights inbound to Nepal, outbound from Nepal, domestic, or physically within Nepal's border.
        # Exclude unrelated foreign flights outside Nepal's borders.
        if nepal_context_only:
            filtered_flights = [f for f in filtered_flights if should_display_flight_in_nepal_context(f)]

        return FlightCollectionResponse(
            total=len(filtered_flights),
            timestamp=datetime.now(timezone.utc),
            cached=is_cached,
            cache_age_seconds=round(cache_age, 1),
            rate_limit_remaining=self.provider.last_rate_limit_remaining,
            flights=filtered_flights
        )

    async def _enrich_and_update_cache(
        self,
        cache_key: str,
        flights_to_enrich: List[NormalizedFlight]
    ) -> None:
        """
        Asynchronously perform deep route and external ADS-B DB metadata lookups in the background,
        updating the in-memory track persistence store and flight cache as data becomes available.
        Ensures live flight positions are never delayed on initial map load.
        """
        try:
            enriched_flights = await enrichment_service.enrich_flight_collection(flights_to_enrich)
            async with self._track_lock:
                for f in enriched_flights:
                    icao = f.identification.icao24
                    if icao in self._track_store:
                        _, seen_mono = self._track_store[icao]
                        self._track_store[icao] = (f, seen_mono)
                persistent_flights = [f for f, _ in self._track_store.values()]
                ttl = float(self.settings.OPENSKY_CACHE_TTL_SECONDS)
                await flight_cache.set(cache_key, persistent_flights, ttl_seconds=ttl)
            logger.debug(f"Background enrichment completed for {len(enriched_flights)} flights.")
        except Exception as e:
            logger.debug(f"Background enrichment error: {e}")

    async def get_flight_by_id(self, icao24: str) -> Optional[NormalizedFlight]:
        """Look up a specific flight by 24-bit ICAO address in the current airspace cache."""
        target_icao = icao24.lower().strip()
        live_res = await self.get_live_flights(nepal_context_only=False)
        for flight in live_res.flights:
            if flight.identification.icao24 == target_icao:
                if not flight.route or not flight.aircraft_spec:
                    await enrichment_service.enrich_flight(flight)
                return flight
        return None

    async def get_flight_trajectory(self, icao24: str) -> Optional[FlightTrajectoryResponse]:
        """
        Retrieve historical spatial breadcrumbs and trajectory trail for an active flight.
        """
        target_icao = icao24.lower().strip()
        flight = await self.get_flight_by_id(target_icao)

        async with self._track_lock:
            stored_points = list(self._trajectory_store.get(target_icao, []))
            callsign = self._trajectory_metadata.get(target_icao)

        if not callsign and flight:
            callsign = flight.identification.callsign

        now_utc = datetime.now(timezone.utc)

        # If we have no points yet, synthesize current point if flight is available
        if not stored_points and flight and flight.position.latitude is not None and flight.position.longitude is not None:
            cur_pt = TrajectoryPoint(
                latitude=flight.position.latitude,
                longitude=flight.position.longitude,
                altitude_ft=flight.position.altitude_baro_ft,
                groundspeed_kts=flight.position.groundspeed_kts,
                heading_deg=flight.position.heading_deg,
                timestamp=flight.position.timestamp or now_utc
            )
            stored_points = [cur_pt]

        if not stored_points:
            return None

        orig_icao = flight.route.origin_icao if flight and flight.route else None
        orig_iata = flight.route.origin_iata if flight and flight.route else None
        orig_name = flight.route.origin_name if flight and flight.route else None
        orig_lat = flight.route.origin_latitude if flight and flight.route else None
        orig_lon = flight.route.origin_longitude if flight and flight.route else None

        if (orig_lat is None or orig_lon is None) and (orig_icao or orig_iata):
            coords = get_airport_coords(orig_icao or orig_iata)
            if coords:
                orig_lat, orig_lon = coords

        return FlightTrajectoryResponse(
            icao24=target_icao,
            callsign=callsign,
            total_points=len(stored_points),
            points=stored_points,
            origin_icao=orig_icao,
            origin_iata=orig_iata,
            origin_name=orig_name,
            origin_latitude=orig_lat,
            origin_longitude=orig_lon,
        )


# Global service singleton
flight_service = FlightService()

