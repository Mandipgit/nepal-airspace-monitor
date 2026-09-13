"""
Aviation Reference Data Repository
Queries airports, runways, aircraft specifications, and airlines from Supabase PostgreSQL.
"""

import logging
from typing import Optional, List, Dict, Any
from app.services.supabase.client import get_supabase_client
from app.schemas.airport import (
    AirportSummarySchema,
    AirportDetailSchema,
    AirportListResponse,
    RunwaySchema
)
from app.schemas.aircraft import (
    AircraftSpecificationSchema,
    AircraftSpecificationListResponse
)

logger = logging.getLogger(__name__)

class AviationRepository:
    """Repository handling database lookups for airports, runways, and aircraft."""

    def __init__(self):
        self._airport_cache: Dict[str, AirportDetailSchema] = {}
        self._aircraft_cache: Dict[str, AircraftSpecificationSchema] = {}

    def _get_client(self):
        return get_supabase_client()

    async def get_airports(
        self,
        country: Optional[str] = None,
        query: Optional[str] = None,
        scheduled_only: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> AirportListResponse:
        """Query airports with optional filtering by country, search string, or scheduled service."""
        client = self._get_client()
        builder = client.table("airports").select(
            "ident, type, name, latitude_deg, longitude_deg, elevation_ft, continent, iso_country, iso_region, municipality, scheduled_service, gps_code, iata_code, local_code",
            count="exact"
        )

        if country:
            builder = builder.eq("iso_country", country.upper())
        if scheduled_only:
            builder = builder.eq("scheduled_service", True)
        if query:
            # Match ident, name, or iata_code
            q = f"%{query.strip()}%"
            builder = builder.or_(f"ident.ilike.{q},name.ilike.{q},iata_code.ilike.{q},municipality.ilike.{q}")

        builder = builder.order("scheduled_service", desc=True).order("name").range(offset, offset + limit - 1)
        res = builder.execute()

        airports = [AirportSummarySchema(**item) for item in res.data]
        total = res.count if res.count is not None else len(airports)
        return AirportListResponse(total=total, airports=airports)

    async def get_nepal_airports(self) -> AirportListResponse:
        """Retrieve all airports and heliports within Nepal."""
        return await self.get_airports(country="NP", limit=100)

    async def get_airport_by_ident(self, ident: str) -> Optional[AirportDetailSchema]:
        """Fetch detailed airport record including all physical runways."""
        target_ident = ident.upper().strip()

        # Check in-memory detail cache first
        if target_ident in self._airport_cache:
            return self._airport_cache[target_ident]

        client = self._get_client()
        
        # 1. Fetch airport
        apt_res = client.table("airports").select("*").eq("ident", target_ident).limit(1).execute()
        if not apt_res.data:
            return None

        apt_data = apt_res.data[0]

        # 2. Fetch associated runways
        runways_res = client.table("runways").select("*").eq("airport_ident", target_ident).order("length_ft", desc=True).execute()
        runways = [RunwaySchema(**r) for r in runways_res.data]

        detail = AirportDetailSchema(**apt_data, runways=runways)
        self._airport_cache[target_ident] = detail
        return detail

    async def get_aircraft_spec(self, identifier: str) -> Optional[AircraftSpecificationSchema]:
        """Fetch specifications by aircraft model name or ICAO type code."""
        key = identifier.upper().strip()
        if key in self._aircraft_cache:
            return self._aircraft_cache[key]

        client = self._get_client()

        # Try exact model match or exact icao_type match
        res = client.table("aircraft_specifications").select("*").or_(f"model.ilike.%{key}%,icao_type.eq.{key}").limit(1).execute()
        if not res.data:
            return None

        spec = AircraftSpecificationSchema(**res.data[0])
        self._aircraft_cache[key] = spec
        return spec

    async def search_aircraft_specs(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> AircraftSpecificationListResponse:
        """Search aircraft specifications by query string or category."""
        client = self._get_client()
        builder = client.table("aircraft_specifications").select("*", count="exact")

        if category:
            builder = builder.eq("category", category.lower().strip())
        if query:
            q = f"%{query.strip()}%"
            builder = builder.or_(f"model.ilike.{q},icao_type.ilike.{q},engine_type.ilike.{q}")

        builder = builder.order("model").range(offset, offset + limit - 1)
        res = builder.execute()

        specs = [AircraftSpecificationSchema(**item) for item in res.data]
        total = res.count if res.count is not None else len(specs)
        return AircraftSpecificationListResponse(total=total, specifications=specs)

aviation_repo = AviationRepository()
