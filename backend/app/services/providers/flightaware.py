"""
FlightAware AeroAPI Provider
Implements BaseFlightProvider to fetch, authenticate, and normalize live flights from FlightAware AeroAPI v4.
"""

import logging
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
import httpx

from app.config import get_settings
from app.core.errors import ProviderError, RateLimitError
from app.models.flight import (
    NormalizedFlight,
    FlightIdentification,
    FlightPosition,
    FlightRoute
)
from app.services.providers.base import BaseFlightProvider
from app.services.providers.opensky import AIRLINE_REGISTRY

logger = logging.getLogger(__name__)

class FlightAwareProvider(BaseFlightProvider):
    """FlightAware AeroAPI live flight telemetry provider."""

    def __init__(self):
        self.settings = get_settings()
        self._rate_limit_remaining: Optional[int] = None
        self._monthly_quota_exceeded: bool = False
        self._quota_error_message: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def name(self) -> str:
        return "flightaware"

    @property
    def last_rate_limit_remaining(self) -> Optional[int]:
        return self._rate_limit_remaining

    @property
    def is_monthly_quota_exceeded(self) -> bool:
        return self._monthly_quota_exceeded

    @property
    def quota_error_message(self) -> Optional[str]:
        return self._quota_error_message

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(6.0, connect=3.0),
                headers={
                    "x-apikey": self.settings.FLIGHTAWARE_API_KEY,
                    "Accept": "application/json",
                    "User-Agent": "AeroTrace-Nepal/1.0"
                }
            )
        return self._client

    def _normalize_flight_item(self, f: Dict[str, Any]) -> Optional[NormalizedFlight]:
        """Convert a single FlightAware AeroAPI flight dictionary into NormalizedFlight."""
        if not f:
            return None

        ident = (f.get("ident") or "").strip().upper()
        fa_flight_id = f.get("fa_flight_id") or ""
        if not ident and not fa_flight_id:
            return None

        registration = f.get("registration")
        aircraft_type = f.get("aircraft_type")
        operator_code = f.get("operator") or (ident[:3] if len(ident) >= 3 and ident[:3].isalpha() else None)
        flight_number = str(f.get("flight_number") or "") if f.get("flight_number") else None

        # Operator name resolution
        operator_name = None
        if operator_code and operator_code in AIRLINE_REGISTRY:
            _, operator_name = AIRLINE_REGISTRY[operator_code]

        # Route extraction
        orig = f.get("origin") or {}
        dest = f.get("destination") or {}
        route = None
        if orig or dest:
            route = FlightRoute(
                origin_icao=orig.get("code_icao") or orig.get("code"),
                origin_iata=orig.get("code_iata"),
                origin_name=orig.get("name") or orig.get("city"),
                origin_latitude=orig.get("latitude"),
                origin_longitude=orig.get("longitude"),
                destination_icao=dest.get("code_icao") or dest.get("code"),
                destination_iata=dest.get("code_iata"),
                destination_name=dest.get("name") or dest.get("city"),
                destination_latitude=dest.get("latitude"),
                destination_longitude=dest.get("longitude"),
            )

        # Position extraction (last_position)
        last_pos = f.get("last_position") or {}
        lat = last_pos.get("latitude")
        lon = last_pos.get("longitude")
        alt_ft = last_pos.get("altitude")
        alt_m = round(alt_ft * 0.3048, 1) if alt_ft is not None else None
        spd_kts = last_pos.get("groundspeed")
        spd_mps = round(spd_kts * 0.514444, 2) if spd_kts is not None else None
        heading = last_pos.get("heading")
        pos_ts_str = last_pos.get("timestamp")

        pos_dt = None
        if pos_ts_str:
            try:
                pos_dt = datetime.fromisoformat(pos_ts_str.replace("Z", "+00:00"))
            except Exception:
                pos_dt = datetime.now(timezone.utc)
        else:
            pos_dt = datetime.now(timezone.utc)

        # If flight has no active coordinates, use origin or destination as reference point if available
        if lat is None or lon is None:
            if orig.get("latitude") and orig.get("longitude"):
                lat, lon = orig.get("latitude"), orig.get("longitude")
            elif dest.get("latitude") and dest.get("longitude"):
                lat, lon = dest.get("latitude"), dest.get("longitude")
            else:
                return None

        # Nepal registration check
        nepal_hex_prefixes = ("70a8", "70a9", "70aa", "70ab", "70ac", "70ad", "70ae", "70af")
        nepal_operators = {"BHA", "NYT", "SHA", "RNA", "TRA", "SMT", "HRA", "HIM", "GBL"}
        is_nepal_reg = bool(
            (registration and registration.upper().startswith("9N")) or
            (operator_code in nepal_operators) or
            (ident.startswith("9N") or ident.startswith("9-N"))
        )

        # Create ICAO24 surrogate if not present
        icao24 = (f.get("hex") or f.get("icao24") or f"fa_{ident.lower()}").lower()

        position = FlightPosition(
            latitude=lat,
            longitude=lon,
            altitude_baro_m=alt_m,
            altitude_geo_m=alt_m,
            groundspeed_mps=spd_mps,
            heading_deg=heading,
            vertical_rate_mps=None,
            on_ground=bool(alt_ft is not None and alt_ft < 100),
            timestamp=pos_dt
        )

        identification = FlightIdentification(
            icao24=icao24,
            callsign=ident,
            flight_number=flight_number,
            registration=registration,
            aircraft_type_icao=aircraft_type,
            operator_icao=operator_code,
            operator_name=operator_name,
            origin_country="Nepal" if is_nepal_reg else None,
            is_nepal_registered=is_nepal_reg,
            position_source="FlightAware AeroAPI"
        )

        return NormalizedFlight(
            id=f"flightaware_{ident}_{fa_flight_id or icao24}",
            provider="flightaware",
            identification=identification,
            position=position,
            route=route,
            last_contact=pos_dt,
            data_freshness_seconds=0.0
        )

    async def get_live_flights(
        self,
        lamin: float,
        lomin: float,
        lamax: float,
        lomax: float
    ) -> List[NormalizedFlight]:
        """Fetch live flights within bounds using FlightAware AeroAPI v4."""
        if not self.settings.FLIGHTAWARE_API_KEY:
            logger.warning("FlightAware API Key is not configured.")
            return []

        if self._monthly_quota_exceeded:
            logger.warning("FlightAware monthly quota is exhausted; skipping external request.")
            raise RateLimitError("flightaware", details={"quota_exceeded": True, "message": self._quota_error_message})

        client = await self._get_client()
        base_url = self.settings.FLIGHTAWARE_BASE_URL.rstrip("/")
        normalized_flights: List[NormalizedFlight] = []
        seen_keys = set()

        # Strategy 1: Flight search with geographical bounding box query
        search_query = f'-latlong "{lamin:.2f} {lomin:.2f} {lamax:.2f} {lomax:.2f}"'
        try:
            resp = await client.get(
                f"{base_url}/flights/search",
                params={"query": search_query, "max_pages": 1}
            )
            if resp.headers.get("x-ratelimit-remaining"):
                try:
                    self._rate_limit_remaining = int(resp.headers["x-ratelimit-remaining"])
                except ValueError:
                    pass

            if resp.status_code == 200:
                data = resp.json()
                raw_flights = data.get("flights", [])
                for item in raw_flights:
                    flt = self._normalize_flight_item(item)
                    if flt and flt.id not in seen_keys:
                        seen_keys.add(flt.id)
                        normalized_flights.append(flt)
                if normalized_flights:
                    logger.info(f"FlightAware AeroAPI search returned {len(normalized_flights)} live flights in bounds.")
                    return normalized_flights
            elif resp.status_code in (402, 429) or (resp.status_code == 403 and any(k in resp.text.lower() for k in ("quota", "limit", "credit", "exceeded"))):
                self._monthly_quota_exceeded = True
                self._quota_error_message = (
                    "FlightAware AeroAPI monthly usage quota has been exhausted. "
                    "Live radar has automatically switched back to OpenSky Network."
                )
                logger.warning(f"FlightAware monthly quota exceeded (HTTP {resp.status_code}): {resp.text[:160]}")
                raise RateLimitError("flightaware", details={"quota_exceeded": True, "message": self._quota_error_message})
            else:
                logger.warning(f"FlightAware /flights/search returned HTTP {resp.status_code}: {resp.text[:160]}")
        except RateLimitError:
            raise
        except Exception as e:
            logger.warning(f"FlightAware /flights/search query failed: {e}")

        # Strategy 2: Airport Hub Query (Kathmandu VNKT & Pokhara VNPK) as high-value fallback
        airports_to_check = ["VNKT", "VNPK"]
        for apt in airports_to_check:
            try:
                resp = await client.get(
                    f"{base_url}/airports/{apt}/flights",
                    params={"max_pages": 1}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # Collect arrivals, departures, enroute
                    groups = ["departures", "arrivals", "enroute", "scheduled_departures"]
                    for g in groups:
                        for item in data.get(g, []):
                            flt = self._normalize_flight_item(item)
                            if flt and flt.id not in seen_keys:
                                seen_keys.add(flt.id)
                                normalized_flights.append(flt)
                elif resp.status_code in (402, 429) or (resp.status_code == 403 and any(k in resp.text.lower() for k in ("quota", "limit", "credit", "exceeded"))):
                    self._monthly_quota_exceeded = True
                    self._quota_error_message = (
                        "FlightAware AeroAPI monthly usage quota has been exhausted. "
                        "Live radar has automatically switched back to OpenSky Network."
                    )
                    logger.warning(f"FlightAware airport monthly quota exceeded (HTTP {resp.status_code}): {resp.text[:160]}")
                    raise RateLimitError("flightaware", details={"quota_exceeded": True, "message": self._quota_error_message})
            except RateLimitError:
                raise
            except Exception as e:
                logger.warning(f"FlightAware /airports/{apt}/flights query failed: {e}")

        logger.info(f"FlightAware AeroAPI gathered {len(normalized_flights)} total flights.")
        return normalized_flights
