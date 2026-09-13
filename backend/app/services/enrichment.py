"""
Flight Data Enrichment Service
Combines live ADS-B telemetry with Supabase aviation reference data:
- Links aircraft performance specifications (MTOW, engines, passenger capacity, cruise speed)
- Computes spatial proximity to key Nepalese airports
- Resolves operator identities
"""

import math
import logging
from typing import List, Optional, Tuple, Dict, Any

from app.models.flight import NormalizedFlight
from app.services.supabase.aviation_repository import aviation_repo

logger = logging.getLogger(__name__)

# Key Nepalese Airports for Fast Proximity Calculation (lat, lon, IATA, Name)
REFERENCE_AIRPORTS = [
    {"ident": "VNKT", "iata": "KTM", "name": "Kathmandu (Tribhuvan)", "lat": 27.6966, "lon": 85.3591},
    {"ident": "VNPK", "iata": "PKR", "name": "Pokhara International", "lat": 28.2009, "lon": 83.9821},
    {"ident": "VNBW", "iata": "BWA", "name": "Bhairahawa (Gautam Buddha)", "lat": 27.5056, "lon": 83.4161},
    {"ident": "VNLK", "iata": "LUA", "name": "Lukla (Tenzing-Hillary)", "lat": 27.6869, "lon": 86.7297},
    {"ident": "VNVT", "iata": "BIR", "name": "Biratnagar", "lat": 26.4816, "lon": 87.2644},
    {"ident": "VNNG", "iata": "KEP", "name": "Nepalgunj", "lat": 28.1054, "lon": 81.6669},
    {"ident": "VNBJ", "iata": "BJH", "name": "Bajhang", "lat": 29.6372, "lon": 81.1856},
    {"ident": "VNBL", "iata": "BGL", "name": "Baglung", "lat": 28.2144, "lon": 83.6664},
    {"ident": "VNJS", "iata": "JMO", "name": "Jomsom", "lat": 28.7842, "lon": 83.7225},
]

# Airline primary fleet mappings based on official airline fleets in Nepal
AIRLINE_FLEET_MAP: Dict[str, str] = {
    "BHA": "ATR72-500Basic",                     # Buddha Air exclusively operates ATR 72/42 fleet
    "NYT": "ATR72-500Basic",                     # Yeti Airlines operates ATR 72-500 fleet
    "SHA": "BombardierCRJ700",                   # Shree Airlines operates Bombardier CRJ / Dash 8
    "RNA": "AirbusCorporateJetliner320neo",       # Nepal Airlines A320 international fleet
    "HRA": "AirbusCorporateJetliner320neo",       # Himalaya Airlines A320 fleet
    "TRA": "HALDornier228-201",                  # Tara Air STOL fleet
    "SMT": "HALDornier228-201",                  # Summit Air STOL fleet
    "IGO": "AirbusCorporateJetliner320neo",       # IndiGo A320/A321 fleet
    "AIC": "AirbusCorporateJetliner320neo",       # Air India A320 fleet
    "AXB": "Boeing737-800BusinessJet",           # Air India Express B737-800 fleet
    "SEJ": "Boeing737-800BusinessJet",           # SpiceJet B737 fleet
}

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two GPS points in kilometers."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c

class FlightEnrichmentService:
    """Enriches normalized flight entities with airport proximity and aircraft performance models."""

    def __init__(self):
        self._spec_cache: Dict[str, Optional[Dict[str, Any]]] = {}

    def _find_nearest_airport(self, lat: Optional[float], lon: Optional[float]) -> Tuple[Optional[str], Optional[float]]:
        """Find the closest Nepalese reference airport and distance."""
        if lat is None or lon is None:
            return None, None

        closest_apt = None
        closest_dist = float("inf")
        for apt in REFERENCE_AIRPORTS:
            d = haversine_km(lat, lon, apt["lat"], apt["lon"])
            if d < closest_dist:
                closest_dist = d
                closest_apt = apt

        if closest_apt and closest_dist < 300.0:  # Within 300km corridor
            name_str = f"{closest_apt['ident']} / {closest_apt['iata']} - {closest_apt['name']}"
            return name_str, round(closest_dist, 1)

        return None, None

    async def _resolve_aircraft_spec(self, flight: NormalizedFlight) -> Optional[Dict[str, Any]]:
        """
        Lookup aircraft specifications based on operator fleet or aircraft type.
        Uses in-memory cache to prevent repeated database lookups.
        """
        operator_icao = flight.identification.operator_icao
        if not operator_icao or operator_icao not in AIRLINE_FLEET_MAP:
            return None

        target_model = AIRLINE_FLEET_MAP[operator_icao]
        if target_model in self._spec_cache:
            return self._spec_cache[target_model]

        try:
            spec = await aviation_repo.get_aircraft_spec(target_model)
            if spec:
                spec_dict = spec.model_dump()
                self._spec_cache[target_model] = spec_dict
                return spec_dict
        except Exception as e:
            logger.debug(f"Could not load spec for model {target_model}: {e}")

        self._spec_cache[target_model] = None
        return None

    async def enrich_flight(self, flight: NormalizedFlight) -> NormalizedFlight:
        """Enrich a single NormalizedFlight domain object."""
        # 1. Airport proximity
        nearest_apt, dist_km = self._find_nearest_airport(
            flight.position.latitude,
            flight.position.longitude
        )
        flight.nearest_airport = nearest_apt
        flight.nearest_airport_distance_km = dist_km

        # 2. Aircraft specifications
        spec = await self._resolve_aircraft_spec(flight)
        if spec:
            flight.aircraft_spec = spec
            # Update identification type if resolved
            if not flight.identification.aircraft_type_icao:
                flight.identification.aircraft_type_icao = spec.get("icao_type")

        return flight

    async def enrich_flight_collection(self, flights: List[NormalizedFlight]) -> List[NormalizedFlight]:
        """Enrich an entire collection of NormalizedFlight objects."""
        enriched = []
        for flight in flights:
            enriched.append(await self.enrich_flight(flight))
        return enriched

enrichment_service = FlightEnrichmentService()
