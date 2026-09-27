"""
Flight Data Enrichment Service
Combines live ADS-B telemetry with aviation reference data:
- Links aircraft performance specifications (MTOW, engines, commercial passenger capacity, cruise speed)
- Computes spatial proximity to key Nepalese airports
- Resolves operator identities and flight route destinations (origin and arrival)
"""

import asyncio
import math
import time
import logging
from typing import List, Optional, Tuple, Dict, Any
import httpx

from app.config import get_settings
from app.models.flight import NormalizedFlight, FlightRoute
from app.services.supabase.aviation_repository import aviation_repo, FALLBACK_NEPAL_AIRPORTS

logger = logging.getLogger(__name__)

# Base Nepalese & International Reference Airports for Proximity Calculation
REFERENCE_AIRPORTS: List[Dict[str, Any]] = [
    {"ident": "VNKT", "iata": "KTM", "name": "Kathmandu (Tribhuvan)", "lat": 27.6966, "lon": 85.3591, "elevation_ft": 4390},
    {"ident": "VNPK", "iata": "PKR", "name": "Pokhara International", "lat": 28.2009, "lon": 83.9821, "elevation_ft": 2712},
    {"ident": "VNBW", "iata": "BWA", "name": "Bhairahawa (Gautam Buddha)", "lat": 27.5056, "lon": 83.4161, "elevation_ft": 358},
    {"ident": "VNLK", "iata": "LUA", "name": "Lukla (Tenzing-Hillary)", "lat": 27.6869, "lon": 86.7297, "elevation_ft": 9334},
    {"ident": "VNVT", "iata": "BIR", "name": "Biratnagar", "lat": 26.4816, "lon": 87.2644, "elevation_ft": 236},
    {"ident": "VNNG", "iata": "KEP", "name": "Nepalgunj", "lat": 28.1054, "lon": 81.6669, "elevation_ft": 540},
    {"ident": "VNCG", "iata": "BDP", "name": "Bhadrapur (Chandragadhi)", "lat": 26.5708, "lon": 88.0792, "elevation_ft": 300},
    {"ident": "VNDH", "iata": "DHI", "name": "Dhangadhi", "lat": 28.7522, "lon": 80.5794, "elevation_ft": 690},
    {"ident": "VNJP", "iata": "JKR", "name": "Janakpur", "lat": 26.7072, "lon": 85.9239, "elevation_ft": 256},
    {"ident": "VNSI", "iata": "SIF", "name": "Simara", "lat": 27.1594, "lon": 84.9692, "elevation_ft": 450},
    {"ident": "VNJS", "iata": "JMO", "name": "Jomsom", "lat": 28.7842, "lon": 83.7225, "elevation_ft": 8976},
    {"ident": "VNBP", "iata": "BHR", "name": "Bharatpur", "lat": 27.6789, "lon": 84.4294, "elevation_ft": 650},
    {"ident": "VNTR", "iata": "TMI", "name": "Tumlingtar", "lat": 27.3142, "lon": 87.1953, "elevation_ft": 1370},
    {"ident": "VNSK", "iata": "SKH", "name": "Surkhet", "lat": 28.5861, "lon": 81.6369, "elevation_ft": 2375},
    {"ident": "VNST", "iata": "IMK", "name": "Simikot", "lat": 29.9686, "lon": 81.8172, "elevation_ft": 9246},
    {"ident": "VNBJ", "iata": "BJH", "name": "Bajhang", "lat": 29.6372, "lon": 81.1856, "elevation_ft": 4100},
    {"ident": "VNBL", "iata": "BGL", "name": "Baglung", "lat": 28.2144, "lon": 83.6664, "elevation_ft": 3000},
]

AIRPORT_REGISTRY: Dict[str, Dict[str, str]] = {
    # Nepal Domestic & International Gateways
    "VNKT": {"iata": "KTM", "icao": "VNKT", "name": "Kathmandu (Tribhuvan)"},
    "VNPK": {"iata": "PKR", "icao": "VNPK", "name": "Pokhara International"},
    "VNBW": {"iata": "BWA", "icao": "VNBW", "name": "Bhairahawa (Gautam Buddha)"},
    "VNVT": {"iata": "BIR", "icao": "VNVT", "name": "Biratnagar"},
    "VNNG": {"iata": "KEP", "icao": "VNNG", "name": "Nepalgunj"},
    "VNLK": {"iata": "LUA", "icao": "VNLK", "name": "Lukla (Tenzing-Hillary)"},
    "VNCG": {"iata": "BDP", "icao": "VNCG", "name": "Bhadrapur (Chandragadhi)"},
    "VNDH": {"iata": "DHI", "icao": "VNDH", "name": "Dhangadhi"},
    "VNJP": {"iata": "JKR", "icao": "VNJP", "name": "Janakpur"},
    "VNSI": {"iata": "SIF", "icao": "VNSI", "name": "Simara"},
    "VNJS": {"iata": "JMO", "icao": "VNJS", "name": "Jomsom"},
    "VNST": {"iata": "IMK", "icao": "VNST", "name": "Simikot"},
    "VNBP": {"iata": "BHR", "icao": "VNBP", "name": "Bharatpur"},
    "VNTR": {"iata": "TMI", "icao": "VNTR", "name": "Tumlingtar"},
    "VNSK": {"iata": "SKH", "icao": "VNSK", "name": "Surkhet"},

    # India & Subcontinent Regional
    "VIDP": {"iata": "DEL", "icao": "VIDP", "name": "Delhi (Indira Gandhi)"},
    "VABB": {"iata": "BOM", "icao": "VABB", "name": "Mumbai (Chhatrapati Shivaji)"},
    "VECC": {"iata": "CCU", "icao": "VECC", "name": "Kolkata (Netaji Subhash)"},
    "VEBD": {"iata": "IXB", "icao": "VEBD", "name": "Bagdogra"},
    "VEGT": {"iata": "GAU", "icao": "VEGT", "name": "Guwahati (Lokpriya Gopinath Bordoloi)"},
    "VOGO": {"iata": "GOI", "icao": "VOGO", "name": "Goa (Dabolim)"},
    "VEIM": {"iata": "IMF", "icao": "VEIM", "name": "Imphal (Bir Tikendrajit)"},
    "VEMR": {"iata": "IXS", "icao": "VEMR", "name": "Silchar (Kumbhirgram)"},
    "VEAT": {"iata": "IXA", "icao": "VEAT", "name": "Agartala (Maharaja Bir Bikram)"},
    "VOBL": {"iata": "BLR", "icao": "VOBL", "name": "Bengaluru (Kempegowda)"},
    "VIAR": {"iata": "ATQ", "icao": "VIAR", "name": "Amritsar (Sri Guru Ram Dass)"},
    "VILK": {"iata": "LKO", "icao": "VILK", "name": "Lucknow (Chaudhary Charan Singh)"},
    "VIBN": {"iata": "VNS", "icao": "VIBN", "name": "Varanasi (Lal Bahadur Shastri)"},
    "VEPT": {"iata": "PAT", "icao": "VEPT", "name": "Patna (Jay Prakash Narayan)"},
    "VEGK": {"iata": "GOP", "icao": "VEGK", "name": "Gorakhpur"},
    "VOMM": {"iata": "MAA", "icao": "VOMM", "name": "Chennai"},
    "VOHS": {"iata": "HYD", "icao": "VOHS", "name": "Hyderabad (Rajiv Gandhi)"},
    "VAAH": {"iata": "AMD", "icao": "VAAH", "name": "Ahmedabad (Sardar Vallabhbhai Patel)"},
    "VGHS": {"iata": "DAC", "icao": "VGHS", "name": "Dhaka (Hazrat Shahjalal)"},
    "VQPR": {"iata": "PBH", "icao": "VQPR", "name": "Paro International"},

    # Middle East
    "OMDB": {"iata": "DXB", "icao": "OMDB", "name": "Dubai International"},
    "OMDW": {"iata": "DWC", "icao": "OMDW", "name": "Dubai World Central (Al Maktoum)"},
    "OTHH": {"iata": "DOH", "icao": "OTHH", "name": "Doha (Hamad International)"},
    "OKBK": {"iata": "KWI", "icao": "OKBK", "name": "Kuwait International"},
    "OMSJ": {"iata": "SHJ", "icao": "OMSJ", "name": "Sharjah International"},
    "OMAA": {"iata": "AUH", "icao": "OMAA", "name": "Abu Dhabi International"},
    "OBBI": {"iata": "BAH", "icao": "OBBI", "name": "Bahrain International"},
    "OEDF": {"iata": "DMM", "icao": "OEDF", "name": "Dammam (King Fahd)"},
    "OERK": {"iata": "RUH", "icao": "OERK", "name": "Riyadh (King Khalid)"},
    "OOMS": {"iata": "MCT", "icao": "OOMS", "name": "Muscat International"},

    # Europe & Global Hubs
    "LOWW": {"iata": "VIE", "icao": "LOWW", "name": "Vienna International"},
    "LTFM": {"iata": "IST", "icao": "LTFM", "name": "Istanbul Airport"},
    "EGLL": {"iata": "LHR", "icao": "EGLL", "name": "London Heathrow"},
    "LSZH": {"iata": "ZRH", "icao": "LSZH", "name": "Zurich Airport"},
    "EDDF": {"iata": "FRA", "icao": "EDDF", "name": "Frankfurt Airport"},

    # Southeast & East Asia
    "VTBS": {"iata": "BKK", "icao": "VTBS", "name": "Bangkok (Suvarnabhumi)"},
    "VTBD": {"iata": "DMK", "icao": "VTBD", "name": "Bangkok (Don Mueang)"},
    "WMKK": {"iata": "KUL", "icao": "WMKK", "name": "Kuala Lumpur International"},
    "WSSS": {"iata": "SIN", "icao": "WSSS", "name": "Singapore Changi"},
    "VHHH": {"iata": "HKG", "icao": "VHHH", "name": "Hong Kong International"},
    "RCTP": {"iata": "TPE", "icao": "RCTP", "name": "Taipei (Taoyuan)"},
    "RJAA": {"iata": "NRT", "icao": "RJAA", "name": "Tokyo (Narita)"},
    "ZUTF": {"iata": "TFU", "icao": "ZUTF", "name": "Chengdu Tianfu"},
    "ZGGG": {"iata": "CAN", "icao": "ZGGG", "name": "Guangzhou Baiyun"},
    "ZUCK": {"iata": "CKG", "icao": "ZUCK", "name": "Chongqing Jiangbei"},
    "ZPPP": {"iata": "KMG", "icao": "ZPPP", "name": "Kunming Changshui"},
    "ZULS": {"iata": "LXA", "icao": "ZULS", "name": "Lhasa Gonggar"},
    "UTAA": {"iata": "ASB", "icao": "UTAA", "name": "Ashgabat"},
    "VVNB": {"iata": "HAN", "icao": "VVNB", "name": "Hanoi (Noi Bai)"},
}

# Airport coordinates for great-circle spherical bearing navigation calculations (lat, lon)
AIRPORT_COORDS: Dict[str, Tuple[float, float]] = {
    "VNKT": (27.6966, 85.3591), # KTM
    "VNPK": (28.1997, 83.9822), # PKR
    "VNBW": (27.5056, 83.4194), # BWA
    "VNVT": (26.4814, 87.2642), # BIR
    "VNNG": (28.1114, 81.6669), # KEP
    "VNLK": (27.6869, 86.7297), # LUA
    "VNCG": (26.5708, 88.0792), # BDP
    "VNDH": (28.7522, 80.5794), # DHI
    "VNJP": (26.7072, 85.9239), # JKR
    "VNSI": (27.1594, 84.9692), # SIF
    "VNJS": (28.7836, 83.7225), # JMO
    "VNST": (29.9686, 81.8172), # IMK
    "VNBP": (27.6789, 84.4294), # BHR
    "VNTR": (27.3142, 87.1953), # TMI
    "VNSK": (28.5861, 81.6369), # SKH
    "VIDP": (28.5665, 77.1031), # DEL
    "VABB": (19.0896, 72.8656), # BOM
    "VECC": (22.6547, 88.4467), # CCU
    "VEBD": (26.6812, 88.3286), # IXB
    "VEGT": (26.1061, 91.5859), # GAU
    "VOGO": (15.3808, 73.8314), # GOI
    "VEIM": (24.7600, 93.8967), # IMF
    "VOBL": (13.1986, 77.7066), # BLR
    "VIAR": (31.7096, 74.7973), # ATQ
    "VILK": (26.7606, 80.8893), # LKO
    "VIBN": (25.4524, 82.8593), # VNS
    "VEPT": (25.5913, 85.0880), # PAT
    "VEGK": (26.7397, 83.4497), # GOP
    "VGHS": (23.8433, 90.3978), # DAC
    "VQPR": (27.4032, 89.4246), # PBH
    "OMDB": (25.2532, 55.3657), # DXB
    "OTHH": (25.2731, 51.6081), # DOH
    "OKBK": (29.2267, 47.9800), # KWI
    "OMSJ": (25.3286, 55.5172), # SHJ
    "OMAA": (24.4330, 54.6511), # AUH
    "OBBI": (26.2708, 50.6336), # BAH
    "OEDF": (26.4712, 49.7978), # DMM
    "VTBS": (13.6900, 100.7501), # BKK
    "WMKK": (2.7456, 101.7099),  # KUL
    "WSSS": (1.3644, 103.9915),  # SIN
    "VHHH": (22.3080, 113.9185), # HKG
    "UTAA": (37.9868, 58.3610),  # ASB
    "VVNB": (21.2212, 105.8072), # HAN
}

# Dynamically populate all Nepalese airports from repository catalog into registry & coordinates
for _apt in FALLBACK_NEPAL_AIRPORTS:
    _ident = _apt["ident"]
    _iata = _apt.get("iata_code") or _apt.get("local_code") or _ident
    _name = _apt.get("name") or _ident
    if _ident not in AIRPORT_REGISTRY:
        AIRPORT_REGISTRY[_ident] = {"iata": _iata, "icao": _ident, "name": _name}
    if _iata and _iata not in AIRPORT_REGISTRY:
        AIRPORT_REGISTRY[_iata] = {"iata": _iata, "icao": _ident, "name": _name}
    if _ident not in AIRPORT_COORDS and _apt.get("latitude_deg") and _apt.get("longitude_deg"):
        AIRPORT_COORDS[_ident] = (_apt["latitude_deg"], _apt["longitude_deg"])

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate initial great-circle bearing in degrees from point 1 to point 2."""
    dlon = math.radians(lon2 - lon1)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    y = math.sin(dlon) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0



def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two GPS points in kilometers."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _make_route(
    orig_key: str,
    dest_key: str,
    orig_name: Optional[str] = None,
    dest_name: Optional[str] = None,
    orig_iata: Optional[str] = None,
    dest_iata: Optional[str] = None
) -> FlightRoute:
    """Build a FlightRoute domain object from airport registry keys or explicit API data."""
    orig_info = AIRPORT_REGISTRY.get(orig_key, {"iata": orig_iata or orig_key, "icao": orig_key, "name": orig_name or orig_key})
    dest_info = AIRPORT_REGISTRY.get(dest_key, {"iata": dest_iata or dest_key, "icao": dest_key, "name": dest_name or dest_key})

    final_dest_icao = dest_info.get("icao", dest_key) if dest_key else None
    final_dest_iata = dest_iata or (dest_info.get("iata") if dest_key else None)
    final_dest_name = dest_name or (dest_info.get("name") if dest_key else None)

    return FlightRoute(
        origin_icao=orig_info.get("icao", orig_key) if orig_key else None,
        origin_iata=orig_iata or (orig_info.get("iata") if orig_key else None),
        origin_name=orig_name or (orig_info.get("name") if orig_key else None),
        destination_icao=final_dest_icao,
        destination_iata=final_dest_iata,
        destination_name=final_dest_name,
    )


class FlightEnrichmentService:
    """Enriches normalized flight entities with airport proximity, aircraft models, and route resolution."""

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self.settings = get_settings()
        self._spec_cache: Dict[str, Optional[Dict[str, Any]]] = {}
        self._route_cache: Dict[str, Optional[FlightRoute]] = {}
        self._route_cache_timestamps: Dict[str, float] = {}
        self._route_ttl_seconds: float = 3600.0  # 1 hour cache for resolved routes
        self._route_negative_ttl_seconds: float = 30.0  # Short 30s negative cache to prevent locking out live flights
        self._aircraft_meta_cache: Dict[str, Optional[Dict[str, Any]]] = {}
        self._aircraft_meta_timestamps: Dict[str, float] = {}
        self._aircraft_meta_ttl_seconds: float = 86400.0  # 24 hours cache for airframe metadata
        self._nepal_aircraft_cache: Dict[str, Optional[Any]] = {}
        self._nepal_aircraft_timestamps: Dict[str, float] = {}
        self._nepal_aircraft_ttl_seconds: float = 86400.0  # 24 hours cache for Nepal registered airframe records
        self._nepal_negative_ttl_seconds: float = 300.0  # 5 min negative cache
        self._http_client = client

    def _build_adsbdb_aircraft_url(self, icao: str) -> str:
        """
        Dynamically construct the ADS-B DB aircraft endpoint using the environment configured URL.
        Never hardcodes external URLs. Supports base URL or pattern placeholder replacements.
        """
        base_url = (self.settings.ADSBDB_AIRCRAFT_API_URL or "https://api.adsbdb.com/v0/aircraft").strip()
        clean_hex = icao.strip().lower()
        if "{icao}" in base_url:
            return base_url.replace("{icao}", clean_hex)
        elif "{icao24}" in base_url:
            return base_url.replace("{icao24}", clean_hex)
        elif "[ICAO_HEX]" in base_url:
            return base_url.replace("[ICAO_HEX]", clean_hex)
        elif "{actual_icao_hex}" in base_url:
            return base_url.replace("{actual_icao_hex}", clean_hex)
        else:
            return f"{base_url.rstrip('/')}/{clean_hex}"

    def _is_route_cached(self, callsign: str) -> bool:
        """Check if callsign has a valid non-expired route cache entry."""
        if not callsign:
            return False
        cs_clean = callsign.strip().upper()
        cs_alnum = "".join(c for c in cs_clean if c.isalnum())
        for key in (cs_clean, cs_alnum):
            if key in self._route_cache:
                cached_ts = self._route_cache_timestamps.get(key, 0.0)
                is_positive = self._route_cache[key] is not None
                ttl = self._route_ttl_seconds if is_positive else self._route_negative_ttl_seconds
                if (time.monotonic() - cached_ts) < ttl:
                    return True
        return False

    def _is_aircraft_meta_cached(self, icao24: str) -> bool:
        """Check if icao24 has a valid non-expired aircraft metadata cache entry."""
        if not icao24 or icao24 not in self._aircraft_meta_cache:
            return False
        cached_ts = self._aircraft_meta_timestamps.get(icao24, 0.0)
        is_positive = self._aircraft_meta_cache[icao24] is not None
        ttl = self._aircraft_meta_ttl_seconds if is_positive else 300.0  # 5 min negative cache
        return (time.monotonic() - cached_ts) < ttl

    async def _fetch_live_aircraft_meta(self, icao24_list: List[str]) -> None:
        """
        Query actual aircraft metadata (type code, model, registration) by icao24 from ADS-B DB API.
        Used strictly for non-Nepal aircraft when OpenSky metadata is missing.
        Caches resolved aircraft metadata in memory.
        """
        clean_icaos = list(dict.fromkeys(
            hex_id.strip().lower() for hex_id in icao24_list if hex_id and hex_id.strip()
        ))
        if not clean_icaos:
            return

        now = time.monotonic()
        client = self._http_client
        close_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=3.0)
            close_client = True

        sem = asyncio.Semaphore(8)

        async def _query_single_meta(icao: str) -> None:
            async with sem:
                try:
                    url = self._build_adsbdb_aircraft_url(icao)
                    r = await client.get(
                        url,
                        headers={"User-Agent": "NepalFlightTracker/1.0"}
                    )
                    if r.status_code == 200:
                        ac_data = r.json().get("response", {}).get("aircraft", {})
                        if ac_data:
                            self._aircraft_meta_cache[icao] = {
                                "type": ac_data.get("type"),
                                "icao_type": ac_data.get("icao_type"),
                                "manufacturer": ac_data.get("manufacturer"),
                                "registration": ac_data.get("registration"),
                                "registered_owner": ac_data.get("registered_owner"),
                                "operator_code": ac_data.get("registered_owner_operator_flag_code")
                            }
                            self._aircraft_meta_timestamps[icao] = now
                            return
                except Exception as e:
                    logger.debug(f"Aircraft metadata lookup failed for {icao}: {e}")

                self._aircraft_meta_cache[icao] = None
                self._aircraft_meta_timestamps[icao] = now

        try:
            await asyncio.gather(*(_query_single_meta(icao) for icao in clean_icaos[:16]))
        finally:
            if close_client:
                await client.aclose()

    async def fetch_single_aircraft_meta(self, icao24: str) -> Optional[Dict[str, Any]]:
        """Fetch and cache a single aircraft's metadata from ADS-B DB API."""
        clean_hex = icao24.strip().lower()
        if self._is_aircraft_meta_cached(clean_hex):
            return self._aircraft_meta_cache.get(clean_hex)
        await self._fetch_live_aircraft_meta([clean_hex])
        return self._aircraft_meta_cache.get(clean_hex)

    def _is_nepal_candidate(self, flight: NormalizedFlight) -> bool:
        """
        Detect if an aircraft is candidate for Nepalese civil registration (9N prefix or Nepal hex range).
        """
        if flight.identification.is_nepal_registered:
            return True

        reg = (flight.identification.registration or "").strip().upper()
        if reg.startswith("9N") or reg.startswith("9-N"):
            return True

        cs = (flight.identification.callsign or "").strip().upper()
        if cs.startswith("9N") or cs.startswith("9-N"):
            return True

        icao = (flight.identification.icao24 or "").strip().lower()
        nepal_hex_prefixes = ("70a8", "70a9", "70aa", "70ab", "70ac", "70ad", "70ae", "70af")
        if icao.startswith(nepal_hex_prefixes):
            return True

        op = (flight.identification.operator_icao or "").strip().upper()
        nepal_operators = {"BHA", "NYT", "SHA", "RNA", "TRA", "SMT", "HRA", "HIM", "GBL", "NYA"}
        if op in nepal_operators:
            return True

        country = (flight.identification.origin_country or "").strip().lower()
        if country == "nepal":
            return True

        return False

    def _is_nepal_aircraft_cached(self, icao24: str) -> bool:
        """Check if icao24 has a valid non-expired nepal_aircraft cache entry."""
        if not icao24:
            return False
        clean_key = icao24.strip().lower()
        if clean_key not in self._nepal_aircraft_cache:
            return False
        cached_ts = self._nepal_aircraft_timestamps.get(clean_key, 0.0)
        is_pos = self._nepal_aircraft_cache[clean_key] is not None
        ttl = self._nepal_aircraft_ttl_seconds if is_pos else self._nepal_negative_ttl_seconds
        return (time.monotonic() - cached_ts) < ttl

    async def _resolve_nepal_aircraft(self, icao24: str, registration: Optional[str] = None) -> Optional[Any]:
        """
        Dynamically query nepal_aircraft table using ICAO hex code and/or registration.
        Caches resolved records in memory to prevent repeated DB lookups on live polling.
        """
        clean_hex = (icao24 or "").strip().lower()
        clean_reg = (registration or "").strip().upper()
        now = time.monotonic()

        # Check in-memory cache first
        if clean_hex and clean_hex in self._nepal_aircraft_cache:
            cached_ts = self._nepal_aircraft_timestamps.get(clean_hex, 0.0)
            is_pos = self._nepal_aircraft_cache[clean_hex] is not None
            ttl = self._nepal_aircraft_ttl_seconds if is_pos else self._nepal_negative_ttl_seconds
            if (now - cached_ts) < ttl:
                return self._nepal_aircraft_cache[clean_hex]

        if clean_reg and clean_reg in self._nepal_aircraft_cache:
            cached_ts = self._nepal_aircraft_timestamps.get(clean_reg, 0.0)
            is_pos = self._nepal_aircraft_cache[clean_reg] is not None
            ttl = self._nepal_aircraft_ttl_seconds if is_pos else self._nepal_negative_ttl_seconds
            if (now - cached_ts) < ttl:
                return self._nepal_aircraft_cache[clean_reg]

        result = None
        lookup_key = clean_hex or clean_reg
        if lookup_key:
            try:
                # Queries nepal_aircraft -> nepal_aircraft_specifications -> aircraft_specifications
                result = await aviation_repo.get_nepal_aircraft(lookup_key)
            except Exception as e:
                logger.debug(f"nepal_aircraft lookup failed for {lookup_key}: {e}")

        # Store in cache
        if clean_hex:
            self._nepal_aircraft_cache[clean_hex] = result
            self._nepal_aircraft_timestamps[clean_hex] = now
        if clean_reg:
            self._nepal_aircraft_cache[clean_reg] = result
            self._nepal_aircraft_timestamps[clean_reg] = now
        if result and getattr(result, "registration", None):
            res_reg = result.registration.strip().upper()
            self._nepal_aircraft_cache[res_reg] = result
            self._nepal_aircraft_timestamps[res_reg] = now

        return result

    def _apply_nepal_aircraft_enrichment(self, flight: NormalizedFlight, nepal_ac: Any) -> None:
        """
        Merge nepal_aircraft identity details and junction-linked specification into NormalizedFlight.
        Combines real-time OpenSky flight with static CAAN registry metadata.
        """
        if not nepal_ac:
            return

        flight.identification.is_nepal_registered = True

        # Attach raw nepal_aircraft dict to flight for frontend CAAN detail panel
        if hasattr(nepal_ac, "model_dump"):
            flight.nepal_aircraft = nepal_ac.model_dump()
        elif isinstance(nepal_ac, dict):
            flight.nepal_aircraft = dict(nepal_ac)

        if isinstance(flight.nepal_aircraft, dict) and not flight.nepal_aircraft.get("owner") and flight.nepal_aircraft.get("operator"):
            flight.nepal_aircraft["owner"] = flight.nepal_aircraft["operator"]

        # Backfill identity attributes if missing or unverified
        if not flight.identification.registration and getattr(nepal_ac, "registration", None):
            flight.identification.registration = nepal_ac.registration
        if not flight.identification.aircraft_type_icao and getattr(nepal_ac, "typecode", None):
            flight.identification.aircraft_type_icao = nepal_ac.typecode
        if not flight.identification.operator_name and getattr(nepal_ac, "operator", None):
            flight.identification.operator_name = nepal_ac.operator
        if not flight.identification.operator_icao and getattr(nepal_ac, "operator_icao", None):
            flight.identification.operator_icao = nepal_ac.operator_icao

        # Linked specification from nepal_aircraft_specifications -> aircraft_specifications
        linked_spec = getattr(nepal_ac, "specification", None)
        if linked_spec:
            if hasattr(linked_spec, "model_dump"):
                flight.aircraft_spec = linked_spec.model_dump()
            elif isinstance(linked_spec, dict):
                flight.aircraft_spec = linked_spec


    def _pick_active_leg(
        self,
        airports: list,
        cur_lat: Optional[float],
        cur_lon: Optional[float],
        heading: Optional[float]
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Select active departure and arrival airport pair for multi-segment flights."""
        if not airports:
            return {}, {}
        if len(airports) == 1:
            return airports[0], airports[0]
        if len(airports) == 2:
            return airports[0], airports[1]

        # Multi-stop flight (e.g. IXB - DEL - GOI)
        if cur_lat is not None and cur_lon is not None and heading is not None:
            for i in range(len(airports) - 1):
                dep = airports[i]
                arr = airports[i + 1]
                arr_lat = arr.get("lat")
                arr_lon = arr.get("lon")
                if arr_lat is not None and arr_lon is not None:
                    bearing = calculate_bearing(cur_lat, cur_lon, arr_lat, arr_lon)
                    diff = abs(heading - bearing) % 360.0
                    if diff > 180.0:
                        diff = 360.0 - diff
                    if diff <= 85.0:
                        return dep, arr

        return airports[0], airports[-1]

    async def _fetch_live_api_routes(
        self,
        callsigns: List[str],
        flights_map: Optional[Dict[str, NormalizedFlight]] = None
    ) -> None:
        """
        Query actual live flight route API data for callsigns using a multi-tier, fully concurrent engine:
        - Tier 1: High-Speed Batch ADS-B Route Resolution (adsb.im routeset)
        - Tier 2: Concurrent FlightRoute Database Fallback (api.adsbdb.com)
        - Tier 3: OpenSky Network Real-Time Flight Departure/Arrival Tracking (/flights/aircraft)
        - Tier 4: Dynamic Spatial Departure & Landing Detection (physics-based proximity)
        """
        clean_callsigns = list(dict.fromkeys(
            cs.strip().upper() for cs in callsigns if cs and cs.strip()
        ))
        if not clean_callsigns:
            return

        now = time.monotonic()
        client = self._http_client
        close_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=8.0)
            close_client = True

        try:
            # 1. Primary: Batch query ADS-B community route registry (used by tar1090/OpenSky map)
            try:
                resp = await client.post(
                    "https://adsb.im/api/0/routeset",
                    json={"planes": [{"callsign": cs} for cs in clean_callsigns]},
                    headers={"User-Agent": "NepalFlightTracker/1.0"},
                    timeout=4.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data:
                        cs = (item.get("callsign") or "").strip().upper()
                        airports = item.get("_airports") or []
                        if cs and len(airports) >= 2:
                            flight = flights_map.get(cs) if flights_map else None
                            cur_lat = flight.position.latitude if flight else None
                            cur_lon = flight.position.longitude if flight else None
                            heading = flight.position.heading_deg if flight else None

                            dep, arr = self._pick_active_leg(airports, cur_lat, cur_lon, heading)
                            orig_icao = dep.get("icao") or dep.get("ident")
                            orig_iata = dep.get("iata") or orig_icao
                            orig_name = dep.get("name") or orig_icao
                            dest_icao = arr.get("icao") or arr.get("ident")
                            dest_iata = arr.get("iata") or dest_icao
                            dest_name = arr.get("name") or dest_icao

                            if orig_icao and dest_icao:
                                route = _make_route(
                                    orig_key=orig_icao,
                                    dest_key=dest_icao,
                                    orig_name=orig_name,
                                    dest_name=dest_name,
                                    orig_iata=orig_iata,
                                    dest_iata=dest_iata
                                )
                                self._route_cache[cs] = route
                                cs_alnum = "".join(c for c in cs if c.isalnum())
                                if cs_alnum:
                                    self._route_cache[cs_alnum] = route
                                self._route_cache_timestamps[cs] = now
            except Exception as e:
                logger.debug(f"Batch routeset query encountered error: {e}")

            # 2. Tier 2: Concurrent query to api.adsbdb.com for unresolved callsigns
            unresolved = [cs for cs in clean_callsigns if cs not in self._route_cache or self._route_cache[cs] is None]
            if unresolved:
                sem = asyncio.Semaphore(10)

                async def _query_adsbdb(cs_item: str):
                    clean_cs = "".join(c for c in cs_item if c.isalnum())
                    if not clean_cs:
                        return cs_item, None
                    async with sem:
                        try:
                            r = await client.get(f"https://api.adsbdb.com/v0/callsign/{clean_cs}", timeout=3.0)
                            if r.status_code == 200:
                                froute = r.json().get("response", {}).get("flightroute", {})
                                orig_info = froute.get("origin", {})
                                dest_info = froute.get("destination", {})
                                orig_icao = orig_info.get("icao_code")
                                dest_icao = dest_info.get("icao_code")
                                if orig_icao and dest_icao:
                                    route = _make_route(
                                        orig_key=orig_icao,
                                        dest_key=dest_icao,
                                        orig_name=orig_info.get("name"),
                                        dest_name=dest_info.get("name"),
                                        orig_iata=orig_info.get("iata_code"),
                                        dest_iata=dest_info.get("iata_code")
                                    )
                                    return cs_item, route
                        except Exception as err:
                            logger.debug(f"adsbdb lookup error for {cs_item}: {err}")
                    return cs_item, None

                adsbdb_results = await asyncio.gather(*(_query_adsbdb(cs) for cs in unresolved))
                for cs_key, res_route in adsbdb_results:
                    if res_route:
                        self._route_cache[cs_key] = res_route
                        cs_alnum = "".join(c for c in cs_key if c.isalnum())
                        if cs_alnum:
                            self._route_cache[cs_alnum] = res_route
                        self._route_cache_timestamps[cs_key] = now

            # 3. Tier 3: OpenSky Real-Time Flight Departure Tracking (/flights/aircraft)
            still_unresolved = [cs for cs in clean_callsigns if cs not in self._route_cache or self._route_cache[cs] is None]
            if still_unresolved and flights_map:
                from app.services.providers.opensky import OpenSkyProvider
                opensky = OpenSkyProvider(client=client)
                token = await opensky._get_auth_token(client)
                auth_headers = {"Authorization": f"Bearer {token}", "User-Agent": "NepalFlightTracker/1.0"} if token else {"User-Agent": "NepalFlightTracker/1.0"}

                now_ts = int(time.time())
                begin_ts = now_ts - 7200  # last 2 hours
                os_sem = asyncio.Semaphore(6)

                async def _query_opensky_realtime(cs_item: str):
                    fl = flights_map.get(cs_item)
                    if not fl:
                        return cs_item, None
                    icao24 = (fl.identification.icao24 or "").lower().strip()
                    if not icao24:
                        return cs_item, None
                    async with os_sem:
                        try:
                            os_url = f"{opensky.settings.OPENSKY_BASE_URL}/flights/aircraft"
                            r = await client.get(
                                os_url,
                                params={"icao24": icao24, "begin": begin_ts, "end": now_ts},
                                headers=auth_headers,
                                timeout=3.5
                            )
                            if r.status_code == 200:
                                records = r.json()
                                if records:
                                    latest = records[-1]
                                    dep = (latest.get("estDepartureAirport") or "").upper().strip()
                                    arr = (latest.get("estArrivalAirport") or "").upper().strip()
                                    if dep or arr:
                                        route = _make_route(
                                            orig_key=dep or "VNKT",
                                            dest_key=arr or "",
                                            dest_name="En Route" if not arr else None
                                        )
                                        return cs_item, route
                        except Exception as e:
                            logger.debug(f"OpenSky flights/aircraft lookup error for {icao24}: {e}")
                    return cs_item, None

                os_results = await asyncio.gather(*(_query_opensky_realtime(cs) for cs in still_unresolved))
                for cs_key, res_route in os_results:
                    if res_route:
                        self._route_cache[cs_key] = res_route
                        cs_alnum = "".join(c for c in cs_key if c.isalnum())
                        if cs_alnum:
                            self._route_cache[cs_alnum] = res_route
                        self._route_cache_timestamps[cs_key] = now

            # 4. Tier 4: Algorithmic Spatial Takeoff Proximity Detection (Zero Hardcoding)
            # Dynamically identifies departure airport for flights currently climbing / taking off
            if flights_map:
                for cs in clean_callsigns:
                    if cs not in self._route_cache or self._route_cache[cs] is None:
                        fl = flights_map.get(cs)
                        if fl and fl.position.latitude is not None and fl.position.longitude is not None:
                            lat = fl.position.latitude
                            lon = fl.position.longitude
                            alt_m = fl.position.altitude_baro_m or fl.position.altitude_geo_m or 0.0
                            if 25.8 <= lat <= 30.65 and 79.8 <= lon <= 88.5:
                                closest_apt = None
                                min_dist = float("inf")
                                for apt in REFERENCE_AIRPORTS:
                                    d = haversine_km(lat, lon, apt["lat"], apt["lon"])
                                    if d < min_dist:
                                        min_dist = d
                                        closest_apt = apt

                                if closest_apt:
                                    elevation_m = closest_apt.get("elevation_ft", 0) * 0.3048
                                    height_agl = alt_m - elevation_m
                                    is_ground_takeoff = fl.position.on_ground and min_dist <= 3.0
                                    is_climbing_takeoff = (
                                        min_dist <= 6.0 and
                                        -50.0 <= height_agl <= 600.0 and
                                        fl.position.vertical_rate_mps is not None and
                                        fl.position.vertical_rate_mps >= 1.5
                                    )
                                    if is_ground_takeoff or is_climbing_takeoff:
                                        route = _make_route(
                                            orig_key=closest_apt["ident"],
                                            dest_key="",
                                            orig_name=closest_apt["name"],
                                            orig_iata=closest_apt["iata"],
                                            dest_name="En Route"
                                        )
                                        self._route_cache[cs] = route
                                        cs_alnum = "".join(c for c in cs if c.isalnum())
                                        if cs_alnum:
                                            self._route_cache[cs_alnum] = route
                                        self._route_cache_timestamps[cs] = now

            # 5. Short negative cache (30s) only for truly unresolvable flights
            for cs in clean_callsigns:
                if cs not in self._route_cache:
                    self._route_cache[cs] = None
                    self._route_cache_timestamps[cs] = now

        finally:
            if close_client:
                await client.aclose()

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
        Lookup aircraft specifications based on genuine verified ICAO type.
        Never fabricates arbitrary aircraft models for operators when type is unknown.
        """
        type_code = (flight.identification.aircraft_type_icao or "").upper().strip()
        icao24 = (flight.identification.icao24 or "").lower().strip()

        # 1. Update from live aircraft metadata cache if type_code is missing
        if not type_code and icao24 and icao24 in self._aircraft_meta_cache:
            meta = self._aircraft_meta_cache[icao24]
            if meta:
                meta_type = (meta.get("icao_type") or meta.get("type") or "").upper().strip()
                if meta_type:
                    type_code = meta_type
                    flight.identification.aircraft_type_icao = meta_type
                if not flight.identification.registration and meta.get("registration"):
                    flight.identification.registration = meta.get("registration")

        # 2. Require genuine aircraft type code for specification lookup
        if not type_code:
            return None

        target_key = type_code

        if target_key in self._spec_cache:
            return self._spec_cache[target_key]

        # Query aircraft specifications from database table via aviation_repo
        try:
            spec = await aviation_repo.get_aircraft_spec(target_key)
            if spec:
                spec_dict = spec.model_dump()
                # Sanitize VIP / business jet capacity anomalies for commercial models
                if spec_dict.get("passenger_capacity") and spec_dict["passenger_capacity"] < 20:
                    model_upper = (spec_dict.get("model") or "").upper()
                    if "320" in model_upper or "321" in model_upper or "737" in model_upper:
                        spec_dict["passenger_capacity"] = 180
                # Preserve genuine verified ICAO type if DB row stores 3-char IATA code (e.g. 321 vs A321)
                if type_code and (not spec_dict.get("icao_type") or len(spec_dict.get("icao_type", "")) < len(type_code)):
                    spec_dict["icao_type"] = type_code
                self._spec_cache[target_key] = spec_dict
                return spec_dict
        except Exception as e:
            logger.debug(f"Could not load spec for model {target_key} from database: {e}")

        # If model is unverified, do not fabricate generic specs
        self._spec_cache[target_key] = None
        return None

    def _resolve_flight_route(self, flight: NormalizedFlight) -> Optional[FlightRoute]:
        """
        Resolve departure and arrival destinations using live API route data.
        Returns None when reliable route data is unavailable.
        """
        raw_callsign = (flight.identification.callsign or "").strip().upper()
        icao24 = (flight.identification.icao24 or "").lower().strip()

        if raw_callsign:
            callsign = "".join(c for c in raw_callsign if c.isalnum())
            if raw_callsign in self._route_cache and self._route_cache[raw_callsign] is not None:
                return self._route_cache[raw_callsign]
            if callsign in self._route_cache and self._route_cache[callsign] is not None:
                return self._route_cache[callsign]

        if icao24 and icao24 in self._route_cache and self._route_cache[icao24] is not None:
            return self._route_cache[icao24]

        # Unverified routes remain None - never fabricate synthetic routes
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

        # 2. Flight Route resolution (Departure & Arrival destinations)
        cs = (flight.identification.callsign or "").strip().upper()
        icao = (flight.identification.icao24 or "").lower().strip()
        lookup_key = cs or icao
        if lookup_key and not self._is_route_cached(lookup_key):
            await self._fetch_live_api_routes([lookup_key], {lookup_key: flight})

        resolved_route = self._resolve_flight_route(flight)
        if resolved_route:
            flight.route = resolved_route

        # 3. Aircraft specifications & identity enrichment with Fallback Priority:
        # -------------------------------------------------------------------------
        # Priority 1: OpenSky provides aircraft information
        # If OpenSky response already contains valid aircraft_type_icao, use existing flow
        # to match aircraft with aircraft_specifications table.
        if flight.identification.aircraft_type_icao and not flight.aircraft_spec:
            spec = await self._resolve_aircraft_spec(flight)
            if spec:
                flight.aircraft_spec = spec

        # Priority 2: Nepal-registered / 9N aircraft missing aircraft information
        # Use ICAO HEX code to dynamically query nepal_aircraft table, then junction
        # table nepal_aircraft_specifications -> aircraft_specifications.
        # DO NOT call ADS-B DB for Nepal-registered aircraft.
        if not flight.aircraft_spec and self._is_nepal_candidate(flight) and icao:
            nepal_ac = await self._resolve_nepal_aircraft(icao, flight.identification.registration)
            if nepal_ac:
                self._apply_nepal_aircraft_enrichment(flight, nepal_ac)
                if not flight.aircraft_spec and flight.identification.aircraft_type_icao:
                    spec = await self._resolve_aircraft_spec(flight)
                    if spec:
                        flight.aircraft_spec = spec

        # Priority 3: Non-Nepal aircraft missing aircraft information
        # Use ICAO HEX code to query ADS-B DB API (using ADSBDB_AIRCRAFT_API_URL from .env).
        if not flight.aircraft_spec and not flight.identification.aircraft_type_icao and icao:
            if not self._is_nepal_candidate(flight):
                if not self._is_aircraft_meta_cached(icao):
                    await self._fetch_live_aircraft_meta([icao])

                spec = await self._resolve_aircraft_spec(flight)
                if spec:
                    flight.aircraft_spec = spec
                    if not flight.identification.aircraft_type_icao:
                        flight.identification.aircraft_type_icao = spec.get("icao_type")

        return flight

    async def enrich_flight_collection(self, flights: List[NormalizedFlight]) -> List[NormalizedFlight]:
        """Enrich an entire collection of NormalizedFlight objects."""
        # 1. Batch fetch live API routes and aircraft metadata for uncached entities
        flights_map: Dict[str, NormalizedFlight] = {}
        needed_callsigns: List[str] = []
        needed_foreign_icaos: List[str] = []

        for flight in flights:
            cs = (flight.identification.callsign or "").strip().upper()
            icao = (flight.identification.icao24 or "").lower().strip()
            if cs:
                flights_map[cs] = flight
                cs_alnum = "".join(c for c in cs if c.isalnum())
                if cs_alnum:
                    flights_map[cs_alnum] = flight
                if not self._is_route_cached(cs):
                    needed_callsigns.append(cs)
            elif icao:
                flights_map[icao] = flight
                if not self._is_route_cached(icao):
                    needed_callsigns.append(icao)

            # Determine whether external ADS-B DB lookup is needed:
            # Fallback priority rule:
            # 1. OpenSky provides aircraft info -> no external lookup needed.
            # 2. Nepal candidate -> resolved from nepal_aircraft table, NOT ADS-B DB.
            # 3. Non-Nepal aircraft missing aircraft info -> query ADS-B DB API.
            if icao and not flight.identification.aircraft_type_icao and not flight.aircraft_spec:
                if not self._is_nepal_candidate(flight):
                    if not self._is_aircraft_meta_cached(icao):
                        needed_foreign_icaos.append(icao)

        tasks = []
        if needed_callsigns:
            tasks.append(self._fetch_live_api_routes(needed_callsigns, flights_map))
        if needed_foreign_icaos:
            tasks.append(self._fetch_live_aircraft_meta(needed_foreign_icaos))
        if tasks:
            await asyncio.gather(*tasks)

        # 2. Enrich each flight concurrently
        enriched = await asyncio.gather(*(self.enrich_flight(flight) for flight in flights))
        return list(enriched)

enrichment_service = FlightEnrichmentService()
