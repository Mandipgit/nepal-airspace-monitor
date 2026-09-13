"""
OpenSky Network Flight Data Provider
Implements BaseFlightProvider to fetch, authenticate, and normalize live OpenSky states.
"""

import logging
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
import httpx

from backend.app.config import get_settings
from backend.app.core.errors import ProviderError, RateLimitError
from backend.app.models.flight import (
    NormalizedFlight,
    FlightIdentification,
    FlightPosition
)
from backend.app.services.providers.base import BaseFlightProvider

logger = logging.getLogger(__name__)

# Known Airline Code Mappings (ICAO prefix -> (ICAO, Name))
AIRLINE_REGISTRY: Dict[str, Tuple[str, str]] = {
    # Nepalese Carriers
    "BHA": ("BHA", "Buddha Air"),
    "SHA": ("SHA", "Shree Airlines"),
    "RNA": ("RNA", "Nepal Airlines"),
    "NYT": ("NYT", "Yeti Airlines"),
    "TRA": ("TRA", "Tara Air"),
    "SMT": ("SMT", "Summit Air"),
    "HRA": ("Himalaya Airlines", "Himalaya Airlines"),
    "GBL": ("GBL", "Guna Airlines"),
    # Frequent International & Regional Carriers Operating in Nepal Airspace
    "BBC": ("BBC", "Biman Bangladesh Airlines"),
    "AIC": ("AIC", "Air India"),
    "IGO": ("IGO", "IndiGo"),
    "AXB": ("AXB", "Air India Express"),
    "SEJ": ("SEJ", "SpiceJet"),
    "VTI": ("VTI", "Vistara"),
    "QTR": ("QTR", "Qatar Airways"),
    "UAE": ("UAE", "Emirates"),
    "FDB": ("FDB", "flydubai"),
    "OMA": ("OMA", "Oman Air"),
    "CSN": ("CSN", "China Southern Airlines"),
    "CCA": ("CCA", "Air China"),
    "CXA": ("CXA", "XiamenAir"),
    "SLK": ("SLK", "SilkAir"),
    "SIA": ("SIA", "Singapore Airlines"),
    "THA": ("THA", "Thai Airways"),
    "MSR": ("MSR", "EgyptAir"),
    "DHK": ("DHK", "DHL Air"),
}

class OpenSkyProvider(BaseFlightProvider):
    """OpenSky Network REST API adapter."""
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self.settings = get_settings()
        self._client = client
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0

    @property
    def name(self) -> str:
        return "opensky"

    async def _get_auth_token(self, http_client: httpx.AsyncClient) -> Optional[str]:
        """Fetch OAuth2 Bearer token if client credentials are configured."""
        if not self.settings.OPENSKY_CLIENT_ID or not self.settings.OPENSKY_CLIENT_SECRET:
            return None
            
        now = time.monotonic()
        if self._token and now < self._token_expires_at:
            return self._token
            
        token_url = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
        try:
            resp = await http_client.post(
                token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.settings.OPENSKY_CLIENT_ID,
                    "client_secret": self.settings.OPENSKY_CLIENT_SECRET,
                },
                timeout=10.0
            )
            if resp.status_code == 200:
                payload = resp.json()
                self._token = payload.get("access_token")
                expires_in = payload.get("expires_in", 1800)
                self._token_expires_at = now + max(10, expires_in - 30)
                logger.info("Successfully refreshed OpenSky OAuth2 token.")
                return self._token
            else:
                logger.warning(f"OpenSky token exchange failed (status {resp.status_code}): {resp.text}")
                return None
        except Exception as e:
            logger.warning(f"Failed to obtain OpenSky OAuth2 token: {e}")
            return None

    def _normalize_state_vector(self, state: list) -> Optional[NormalizedFlight]:
        """
        Convert a raw 18-element OpenSky state vector array into a NormalizedFlight model.
        Returns None if vector lacks valid ICAO24 or coordinates.
        """
        if not state or len(state) < 17:
            return None
            
        icao24 = (state[0] or "").lower().strip()
        if not icao24:
            return None
            
        raw_callsign = state[1]
        callsign = raw_callsign.strip().upper() if raw_callsign else None
        origin_country = state[2]
        time_pos = state[3]
        last_contact_ts = state[4]
        lon = state[5]
        lat = state[6]
        baro_alt = state[7]
        on_ground = bool(state[8])
        velocity = state[9]
        heading = state[10]
        vert_rate = state[11]
        geo_alt = state[13] if len(state) > 13 else None
        squawk = state[14] if len(state) > 14 else None
        
        # Position timestamp
        pos_dt = datetime.fromtimestamp(time_pos, timezone.utc) if time_pos else None
        contact_dt = datetime.fromtimestamp(last_contact_ts, timezone.utc) if last_contact_ts else None
        
        # Freshness
        freshness_sec = None
        if contact_dt:
            freshness_sec = max(0.0, (datetime.now(timezone.utc) - contact_dt).total_seconds())

        # Check Nepalese ICAO block (Empirically discovered: 70a8..)
        is_nepal_reg = icao24.startswith("70a8")
        if is_nepal_reg and not origin_country:
            origin_country = "Nepal"
            
        # Resolve airline from callsign prefix
        operator_icao = None
        operator_name = None
        if callsign:
            # Check 3-letter prefix
            prefix = callsign[:3]
            if prefix in AIRLINE_REGISTRY:
                operator_icao, operator_name = AIRLINE_REGISTRY[prefix]

        position = FlightPosition(
            latitude=lat,
            longitude=lon,
            altitude_baro_m=baro_alt,
            altitude_geo_m=geo_alt,
            groundspeed_mps=velocity,
            heading_deg=heading,
            vertical_rate_mps=vert_rate,
            on_ground=on_ground,
            timestamp=pos_dt
        )
        
        identification = FlightIdentification(
            icao24=icao24,
            callsign=callsign,
            operator_icao=operator_icao,
            operator_name=operator_name,
            origin_country=origin_country,
            is_nepal_registered=is_nepal_reg,
            squawk=squawk
        )
        
        return NormalizedFlight(
            id=f"opensky_{icao24}",
            provider="opensky",
            identification=identification,
            position=position,
            route=None,  # Route is not provided in OpenSky live states
            last_contact=contact_dt,
            data_freshness_seconds=freshness_sec
        )

    async def get_live_flights(
        self,
        lamin: float,
        lomin: float,
        lamax: float,
        lomax: float
    ) -> List[NormalizedFlight]:
        """Fetch live states from OpenSky REST API and convert to normalized flights."""
        url = f"{self.settings.OPENSKY_BASE_URL}/states/all"
        params = {
            "lamin": lamin,
            "lomin": lomin,
            "lamax": lamax,
            "lomax": lomax
        }
        headers = {
            "User-Agent": "NepalFlightTracker/1.0"
        }
        
        close_client_at_end = False
        client = self._client
        if client is None:
            client = httpx.AsyncClient(timeout=12.0)
            close_client_at_end = True

        try:
            # Check for OAuth2 token if configured
            token = await self._get_auth_token(client)
            if token:
                headers["Authorization"] = f"Bearer {token}"

            start_time = time.time()
            response = await client.get(url, params=params, headers=headers)
            elapsed_ms = (time.time() - start_time) * 1000
            
            # Rate limit inspection
            remaining_quota = response.headers.get("X-Rate-Limit-Remaining")
            if remaining_quota:
                logger.debug(f"OpenSky quota remaining: {remaining_quota}")

            if response.status_code == 429:
                retry_after = response.headers.get("X-Rate-Limit-Retry-After-Seconds")
                retry_int = int(retry_after) if retry_after and retry_after.isdigit() else 60
                logger.warning(f"OpenSky rate limit hit. Retry after {retry_int}s.")
                raise RateLimitError("opensky", retry_after=retry_int)
                
            if response.status_code != 200:
                logger.error(f"OpenSky request failed with status {response.status_code}: {response.text}")
                raise ProviderError(
                    "opensky",
                    message=f"HTTP {response.status_code}: {response.text}",
                    status_code=response.status_code
                )
                
            data = response.json()
            raw_states = data.get("states") or []
            
            normalized_flights: List[NormalizedFlight] = []
            for state in raw_states:
                flight = self._normalize_state_vector(state)
                if flight:
                    normalized_flights.append(flight)
                    
            logger.info(
                f"OpenSky query successful: returned {len(normalized_flights)} aircraft "
                f"in {elapsed_ms:.1f}ms (remaining quota: {remaining_quota or 'N/A'})"
            )
            return normalized_flights

        except httpx.TimeoutException as e:
            logger.error(f"OpenSky request timed out: {e}")
            raise ProviderError("opensky", message="External API connection timed out", status_code=504)
        except httpx.RequestError as e:
            logger.error(f"OpenSky network connection failed: {e}")
            raise ProviderError("opensky", message=f"Network transport error: {str(e)}", status_code=502)
        finally:
            if close_client_at_end:
                await client.aclose()
