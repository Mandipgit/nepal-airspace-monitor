"""
Flight Data Enrichment Service
Combines live ADS-B telemetry with aviation reference data:
- Links aircraft performance specifications (MTOW, engines, commercial passenger capacity, cruise speed)
- Computes spatial proximity to key Nepalese airports
- Resolves operator identities and flight route destinations (origin and arrival)
"""

import math
import logging
from typing import List, Optional, Tuple, Dict, Any

from app.models.flight import NormalizedFlight, FlightRoute
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

AIRPORT_REGISTRY: Dict[str, Dict[str, str]] = {
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
    "VIDP": {"iata": "DEL", "icao": "VIDP", "name": "Delhi (Indira Gandhi)"},
    "VABB": {"iata": "BOM", "icao": "VABB", "name": "Mumbai (Chhatrapati Shivaji)"},
    "VECC": {"iata": "CCU", "icao": "VECC", "name": "Kolkata (Netaji Subhash)"},
    "VGHS": {"iata": "DAC", "icao": "VGHS", "name": "Dhaka (Hazrat Shahjalal)"},
    "VQPR": {"iata": "PBH", "icao": "VQPR", "name": "Paro International"},
    "OMDB": {"iata": "DXB", "icao": "OMDB", "name": "Dubai International"},
    "OTHH": {"iata": "DOH", "icao": "OTHH", "name": "Doha (Hamad International)"},
    "VTBS": {"iata": "BKK", "icao": "VTBS", "name": "Bangkok (Suvarnabhumi)"},
    "WMKK": {"iata": "KUL", "icao": "WMKK", "name": "Kuala Lumpur International"},
    "WSSS": {"iata": "SIN", "icao": "WSSS", "name": "Singapore Changi"},
    "OKBK": {"iata": "KWI", "icao": "OKBK", "name": "Kuwait International"},
    "OMSJ": {"iata": "SHJ", "icao": "OMSJ", "name": "Sharjah International"},
    "OBBI": {"iata": "BAH", "icao": "OBBI", "name": "Bahrain International"},
    "OEDF": {"iata": "DMM", "icao": "OEDF", "name": "Dammam (King Fahd)"},
    "RJAA": {"iata": "NRT", "icao": "RJAA", "name": "Tokyo (Narita)"},
    "ZUTF": {"iata": "TFU", "icao": "ZUTF", "name": "Chengdu Tianfu"},
    "ZGGG": {"iata": "CAN", "icao": "ZGGG", "name": "Guangzhou Baiyun"},
}

# Airline primary fleet mappings based on real commercial airline fleets in Nepal
AIRLINE_FLEET_MAP: Dict[str, str] = {
    "BHA": "AT72",                               # Buddha Air exclusively operates ATR 72/42 fleet
    "NYT": "AT72",                               # Yeti Airlines operates ATR 72-500 fleet
    "SHA": "DH8D",                               # Shree Airlines operates Bombardier Dash 8 Q400 / CRJ
    "RNA": "A20N",                               # Nepal Airlines A320-200neo international fleet
    "HRA": "A20N",                               # Himalaya Airlines A320 fleet
    "TRA": "DHC6",                               # Tara Air STOL DHC-6 Twin Otter fleet
    "SMT": "L410",                               # Summit Air Let L-410 Turbolet STOL fleet
    "IGO": "A20N",                               # IndiGo A320neo fleet
    "AIC": "A20N",                               # Air India A320neo fleet
    "AXB": "B738",                               # Air India Express B737-800 fleet
    "SEJ": "B738",                               # SpiceJet B737-800 fleet
    "QTR": "A333",                               # Qatar Airways widebody fleet
    "FDB": "B38M",                               # flydubai B737 MAX fleet
    "SIA": "B38M",                               # Singapore Airlines B737 MAX fleet
    "MAS": "B738",                               # Malaysia Airlines B737-800 fleet
    "MXD": "B38M",                               # Batik Air Malaysia B737 MAX fleet
    "JZR": "A20N",                               # Jazeera Airways A320neo fleet
    "ABY": "A320",                               # Air Arabia A320 fleet
}

# Standard Commercial Aircraft Specifications Catalog
STANDARD_AIRCRAFT_SPECS: Dict[str, Dict[str, Any]] = {
    # Turboprops & STOL Utility
    "AT72": {
        "model": "ATR 72-500",
        "icao_type": "AT72",
        "category": "regional",
        "engine_type": "turboprop",
        "engine_model": "PW127F/M",
        "number_of_engines": 2,
        "passenger_capacity": 72,
        "mtow_kg": 22800,
        "cruise_speed_kts": 276,
        "nominal_range_nm": 825,
    },
    "AT45": {
        "model": "ATR 42-500",
        "icao_type": "AT45",
        "category": "regional",
        "engine_type": "turboprop",
        "engine_model": "PW127E",
        "number_of_engines": 2,
        "passenger_capacity": 48,
        "mtow_kg": 18600,
        "cruise_speed_kts": 285,
        "nominal_range_nm": 715,
    },
    "DH8D": {
        "model": "De Havilland Dash 8 Q400",
        "icao_type": "DH8D",
        "category": "regional",
        "engine_type": "turboprop",
        "engine_model": "PW150A",
        "number_of_engines": 2,
        "passenger_capacity": 78,
        "mtow_kg": 29257,
        "cruise_speed_kts": 360,
        "nominal_range_nm": 1100,
    },
    "CRJ2": {
        "model": "Bombardier CRJ-200",
        "icao_type": "CRJ2",
        "category": "regional",
        "engine_type": "turbofan",
        "engine_model": "GE CF34-3B1",
        "number_of_engines": 2,
        "passenger_capacity": 50,
        "mtow_kg": 24040,
        "cruise_speed_kts": 425,
        "nominal_range_nm": 1700,
    },
    "CRJ7": {
        "model": "Bombardier CRJ-700",
        "icao_type": "CRJ7",
        "category": "regional",
        "engine_type": "turbofan",
        "engine_model": "GE CF34-8C5",
        "number_of_engines": 2,
        "passenger_capacity": 70,
        "mtow_kg": 34019,
        "cruise_speed_kts": 447,
        "nominal_range_nm": 1378,
    },
    "DHC6": {
        "model": "DHC-6 Twin Otter 300/400",
        "icao_type": "DHC6",
        "category": "turboprop",
        "engine_type": "turboprop",
        "engine_model": "PT6A-34",
        "number_of_engines": 2,
        "passenger_capacity": 19,
        "mtow_kg": 5670,
        "cruise_speed_kts": 150,
        "nominal_range_nm": 775,
    },
    "D228": {
        "model": "Dornier 228-200",
        "icao_type": "D228",
        "category": "turboprop",
        "engine_type": "turboprop",
        "engine_model": "TPE331-5",
        "number_of_engines": 2,
        "passenger_capacity": 19,
        "mtow_kg": 6400,
        "cruise_speed_kts": 190,
        "nominal_range_nm": 1000,
    },
    "L410": {
        "model": "Let L-410 Turbolet",
        "icao_type": "L410",
        "category": "turboprop",
        "engine_type": "turboprop",
        "engine_model": "GE H80-200",
        "number_of_engines": 2,
        "passenger_capacity": 19,
        "mtow_kg": 6600,
        "cruise_speed_kts": 180,
        "nominal_range_nm": 800,
    },
    "AS50": {
        "model": "Airbus Helicopters H125 / AS350",
        "icao_type": "AS50",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Arriel 2D",
        "number_of_engines": 1,
        "passenger_capacity": 5,
        "mtow_kg": 2250,
        "cruise_speed_kts": 137,
        "nominal_range_nm": 340,
    },
    "B407": {
        "model": "Bell 407",
        "icao_type": "B407",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Rolls-Royce 250-C47B",
        "number_of_engines": 1,
        "passenger_capacity": 6,
        "mtow_kg": 2381,
        "cruise_speed_kts": 133,
        "nominal_range_nm": 324,
    },
    # Commercial Narrowbody Airliners
    "A20N": {
        "model": "Airbus A320-200neo",
        "icao_type": "A20N",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM LEAP-1A / PW1100G",
        "number_of_engines": 2,
        "passenger_capacity": 180,
        "mtow_kg": 79000,
        "cruise_speed_kts": 450,
        "nominal_range_nm": 3500,
    },
    "A320": {
        "model": "Airbus A320-200",
        "icao_type": "A320",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM56-5B4 / V2527",
        "number_of_engines": 2,
        "passenger_capacity": 180,
        "mtow_kg": 77000,
        "cruise_speed_kts": 447,
        "nominal_range_nm": 3300,
    },
    "A21N": {
        "model": "Airbus A321-200neo",
        "icao_type": "A21N",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM LEAP-1A",
        "number_of_engines": 2,
        "passenger_capacity": 220,
        "mtow_kg": 97000,
        "cruise_speed_kts": 454,
        "nominal_range_nm": 4000,
    },
    "A321": {
        "model": "Airbus A321-200",
        "icao_type": "A321",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM56-5B3",
        "number_of_engines": 2,
        "passenger_capacity": 220,
        "mtow_kg": 93500,
        "cruise_speed_kts": 450,
        "nominal_range_nm": 3200,
    },
    "A319": {
        "model": "Airbus A319-100",
        "icao_type": "A319",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM56-5B6",
        "number_of_engines": 2,
        "passenger_capacity": 144,
        "mtow_kg": 75500,
        "cruise_speed_kts": 447,
        "nominal_range_nm": 3750,
    },
    "B738": {
        "model": "Boeing 737-800",
        "icao_type": "B738",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM56-7B",
        "number_of_engines": 2,
        "passenger_capacity": 186,
        "mtow_kg": 79010,
        "cruise_speed_kts": 453,
        "nominal_range_nm": 2935,
    },
    "B38M": {
        "model": "Boeing 737 MAX 8",
        "icao_type": "B38M",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM LEAP-1B",
        "number_of_engines": 2,
        "passenger_capacity": 189,
        "mtow_kg": 82190,
        "cruise_speed_kts": 453,
        "nominal_range_nm": 3550,
    },
    "B737": {
        "model": "Boeing 737-700",
        "icao_type": "B737",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM56-7B",
        "number_of_engines": 2,
        "passenger_capacity": 149,
        "mtow_kg": 70080,
        "cruise_speed_kts": 450,
        "nominal_range_nm": 3010,
    },
    # Commercial Widebody Airliners
    "A332": {
        "model": "Airbus A330-200",
        "icao_type": "A332",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "RR Trent 700 / CF6",
        "number_of_engines": 2,
        "passenger_capacity": 274,
        "mtow_kg": 242000,
        "cruise_speed_kts": 470,
        "nominal_range_nm": 7250,
    },
    "A333": {
        "model": "Airbus A330-300",
        "icao_type": "A333",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "RR Trent 700",
        "number_of_engines": 2,
        "passenger_capacity": 305,
        "mtow_kg": 242000,
        "cruise_speed_kts": 470,
        "nominal_range_nm": 6350,
    },
    "B77W": {
        "model": "Boeing 777-300ER",
        "icao_type": "B77W",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "GE90-115B",
        "number_of_engines": 2,
        "passenger_capacity": 396,
        "mtow_kg": 351534,
        "cruise_speed_kts": 482,
        "nominal_range_nm": 7370,
    },
    "B772": {
        "model": "Boeing 777-200ER",
        "icao_type": "B772",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "GE90-90B / Trent 800",
        "number_of_engines": 2,
        "passenger_capacity": 314,
        "mtow_kg": 297550,
        "cruise_speed_kts": 482,
        "nominal_range_nm": 7065,
    },
    "B788": {
        "model": "Boeing 787-8 Dreamliner",
        "icao_type": "B788",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "GEnx-1B / Trent 1000",
        "number_of_engines": 2,
        "passenger_capacity": 248,
        "mtow_kg": 227930,
        "cruise_speed_kts": 488,
        "nominal_range_nm": 7355,
    },
    "B789": {
        "model": "Boeing 787-9 Dreamliner",
        "icao_type": "B789",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "GEnx-1B / Trent 1000",
        "number_of_engines": 2,
        "passenger_capacity": 296,
        "mtow_kg": 254000,
        "cruise_speed_kts": 488,
        "nominal_range_nm": 7635,
    },
}

# Backwards compatibility aliases for tests and database models
STANDARD_AIRCRAFT_SPECS["ATR72-500Basic"] = STANDARD_AIRCRAFT_SPECS["AT72"]
STANDARD_AIRCRAFT_SPECS["AirbusCorporateJetliner320neo"] = STANDARD_AIRCRAFT_SPECS["A20N"]
STANDARD_AIRCRAFT_SPECS["BombardierCRJ700"] = STANDARD_AIRCRAFT_SPECS["CRJ7"]
STANDARD_AIRCRAFT_SPECS["HALDornier228-201"] = STANDARD_AIRCRAFT_SPECS["D228"]
STANDARD_AIRCRAFT_SPECS["Boeing737-800BusinessJet"] = STANDARD_AIRCRAFT_SPECS["B738"]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two GPS points in kilometers."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _make_route(orig_key: str, dest_key: str) -> FlightRoute:
    """Build a FlightRoute domain object from airport registry keys."""
    orig = AIRPORT_REGISTRY.get(orig_key, {"iata": orig_key, "icao": orig_key, "name": orig_key})
    dest = AIRPORT_REGISTRY.get(dest_key, {"iata": dest_key, "icao": dest_key, "name": dest_key})
    return FlightRoute(
        origin_icao=orig["icao"],
        origin_iata=orig["iata"],
        origin_name=orig["name"],
        destination_icao=dest["icao"],
        destination_iata=dest["iata"],
        destination_name=dest["name"],
    )


class FlightEnrichmentService:
    """Enriches normalized flight entities with airport proximity, aircraft models, and route resolution."""

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
        Lookup aircraft specifications based on operator fleet, ICAO type, or standard catalog.
        Guarantees realistic commercial passenger capacity (not business jet / VIP seats).
        """
        operator_icao = flight.identification.operator_icao
        type_code = (flight.identification.aircraft_type_icao or "").upper().strip()

        # If neither operator nor aircraft type is identified, do not fabricate specs
        if not operator_icao and not type_code:
            return None

        # Resolve target key from airline fleet or type code
        target_key = None
        if operator_icao and operator_icao in AIRLINE_FLEET_MAP:
            target_key = AIRLINE_FLEET_MAP[operator_icao]
        elif type_code:
            target_key = type_code

        if not target_key:
            return None

        if target_key in self._spec_cache:
            return self._spec_cache[target_key]

        # 1. Check in-memory standard catalog first for commercial integrity
        if target_key in STANDARD_AIRCRAFT_SPECS:
            spec_dict = dict(STANDARD_AIRCRAFT_SPECS[target_key])
            self._spec_cache[target_key] = spec_dict
            return spec_dict

        # 2. Try Supabase aviation repository lookup
        try:
            spec = await aviation_repo.get_aircraft_spec(target_key)
            if spec:
                spec_dict = spec.model_dump()
                # Sanitize VIP / business jet capacity anomalies for commercial models
                if spec_dict.get("passenger_capacity") and spec_dict["passenger_capacity"] < 20:
                    model_upper = (spec_dict.get("model") or "").upper()
                    if "320" in model_upper or "321" in model_upper or "737" in model_upper:
                        spec_dict["passenger_capacity"] = 180
                self._spec_cache[target_key] = spec_dict
                return spec_dict
        except Exception as e:
            logger.debug(f"Could not load spec for model {target_key} from database: {e}")

        # 3. Fallback to standard narrowbody default if commercial airliner category
        if flight.identification.category == 3 or (flight.identification.category_name and "large" in flight.identification.category_name.lower()):
            default_spec = dict(STANDARD_AIRCRAFT_SPECS["A20N"])
            self._spec_cache[target_key] = default_spec
            return default_spec

        self._spec_cache[target_key] = None
        return None

    def _resolve_flight_route(self, flight: NormalizedFlight) -> Optional[FlightRoute]:
        """
        Dynamically resolve departure and arrival destinations from radiotelephony callsign,
        airline operational route networks, heading, and geographic coordinates.
        """
        callsign = (flight.identification.callsign or "").strip().upper()
        if not callsign:
            return None

        lat = flight.position.latitude
        lon = flight.position.longitude
        heading = flight.position.heading_deg or 0.0

        # 1. Buddha Air (BHA) Routes
        if callsign.startswith("BHA"):
            # Check route number digits
            digits = "".join(c for c in callsign if c.isdigit())
            dest_code = "VNPK" # Default KTM - PKR
            if digits.startswith("2"):
                dest_code = "VNBW" # Bhairahawa
            elif digits.startswith("3"):
                dest_code = "VNVT" # Biratnagar
            elif digits.startswith("4"):
                dest_code = "VNNG" # Nepalgunj
            elif digits.startswith("5"):
                dest_code = "VNCG" # Bhadrapur
            elif digits.startswith("6"):
                dest_code = "VNJP" # Janakpur
            elif digits.startswith("7"):
                dest_code = "VNDH" # Dhangadhi
            elif digits.startswith("8"):
                dest_code = "VNSI" # Simara
            elif digits.startswith("9"):
                return _make_route("VNKT", "VNKT") # Everest Scenic Flight

            # Determine direction: heading towards KTM (approx 60-150 deg when west of KTM)
            if lon and lon < 85.0 and (60 <= heading <= 150):
                return _make_route(dest_code, "VNKT")
            else:
                return _make_route("VNKT", dest_code)

        # 2. Yeti Airlines (NYT) Routes
        if callsign.startswith("NYT"):
            digits = "".join(c for c in callsign if c.isdigit())
            dest_code = "VNPK"
            if digits.startswith("8"):
                dest_code = "VNBW"
            elif digits.startswith("7"):
                dest_code = "VNVT"
            elif digits.startswith("3"):
                dest_code = "VNNG"
            elif digits.startswith("1"):
                return _make_route("VNKT", "VNKT")

            if lon and lon < 85.0 and (60 <= heading <= 150):
                return _make_route(dest_code, "VNKT")
            else:
                return _make_route("VNKT", dest_code)

        # 3. Shree Airlines (SHA) Routes
        if callsign.startswith("SHA"):
            digits = "".join(c for c in callsign if c.isdigit())
            dest_code = "VNPK"
            if digits.startswith("2"):
                dest_code = "VNBW"
            elif digits.startswith("7"):
                dest_code = "VNVT"
            elif digits.startswith("8"):
                dest_code = "VNDH"
            elif digits.startswith("1"):
                dest_code = "VNNG"

            if lon and lon < 85.0 and (60 <= heading <= 150):
                return _make_route(dest_code, "VNKT")
            else:
                return _make_route("VNKT", dest_code)

        # 4. Tara Air (TRA) & Summit Air (SMT) Mountain Routes
        if callsign.startswith("TRA") or callsign.startswith("SMT"):
            digits = "".join(c for c in callsign if c.isdigit())
            if digits.startswith("2"):
                return _make_route("VNPK", "VNJS") # Pokhara - Jomsom
            elif digits.startswith("3"):
                return _make_route("VNNG", "VNST") # Nepalgunj - Simikot
            else:
                return _make_route("VNKT", "VNLK") # Kathmandu - Lukla

        # 5. Nepal Airlines (RNA)
        if callsign.startswith("RNA"):
            digits = "".join(c for c in callsign if c.isdigit())
            if digits.startswith("20"):
                intl_port = "VIDP" # Delhi
            elif digits.startswith("40"):
                intl_port = "VTBS" # Bangkok
            elif digits.startswith("41"):
                intl_port = "WMKK" # Kuala Lumpur
            elif digits.startswith("23") or digits.startswith("24"):
                intl_port = "OMDB" # Dubai
            elif digits.startswith("70"):
                intl_port = "RJAA" # Tokyo Narita
            else:
                intl_port = "VIDP"

            # Inbound to Kathmandu vs Outbound
            if lon and lon < 85.0 and (45 <= heading <= 140):
                return _make_route(intl_port, "VNKT")
            else:
                return _make_route("VNKT", intl_port)

        # 6. Himalaya Airlines (HRA)
        if callsign.startswith("HRA"):
            digits = "".join(c for c in callsign if c.isdigit())
            if digits.startswith("36"):
                intl_port = "OEDF" # Dammam
            elif digits.startswith("38"):
                intl_port = "OMDB" # Dubai
            elif digits.startswith("39"):
                intl_port = "OKBK" # Kuwait
            else:
                intl_port = "OTHH" # Doha

            if lon and lon < 85.0 and (45 <= heading <= 140):
                return _make_route(intl_port, "VNKT")
            else:
                return _make_route("VNKT", intl_port)

        # 7. IndiGo (IGO) & Air India (AIC)
        if callsign.startswith("IGO") or callsign.startswith("AIC"):
            digits = "".join(c for c in callsign if c.isdigit())
            indian_port = "VABB" if digits.startswith("4") else "VIDP" # Mumbai or Delhi
            if lon and (45 <= heading <= 140):
                return _make_route(indian_port, "VNKT")
            else:
                return _make_route("VNKT", indian_port)

        # 8. Gulf Carriers
        if callsign.startswith("QTR"):
            return _make_route("OTHH", "VNKT") if (45 <= heading <= 140) else _make_route("VNKT", "OTHH")
        if callsign.startswith("FDB"):
            return _make_route("OMDB", "VNKT") if (45 <= heading <= 140) else _make_route("VNKT", "OMDB")
        if callsign.startswith("ABY") or callsign.startswith("BPA"):
            return _make_route("OMSJ", "VNKT") if (45 <= heading <= 140) else _make_route("VNKT", "OMSJ")
        if callsign.startswith("JZR"):
            return _make_route("OKBK", "VNKT") if (45 <= heading <= 140) else _make_route("VNKT", "OKBK")
        if callsign.startswith("GFA"):
            return _make_route("OBBI", "VNKT") if (45 <= heading <= 140) else _make_route("VNKT", "OBBI")

        # 9. Southeast Asia Carriers
        if callsign.startswith("SIA"):
            return _make_route("WSSS", "VNKT") if (280 <= heading <= 360 or heading <= 20) else _make_route("VNKT", "WSSS")
        if callsign.startswith("MAS") or callsign.startswith("MXD") or callsign.startswith("BAT"):
            return _make_route("WMKK", "VNKT") if (280 <= heading <= 360 or heading <= 20) else _make_route("VNKT", "WMKK")

        # 10. Regional Neighbors
        if callsign.startswith("DRK") or callsign.startswith("KB"):
            return _make_route("VQPR", "VNKT") if (220 <= heading <= 300) else _make_route("VNKT", "VQPR")
        if callsign.startswith("BIM") or callsign.startswith("BBC"):
            return _make_route("VGHS", "VNKT") if (280 <= heading <= 360) else _make_route("VNKT", "VGHS")
        if callsign.startswith("CSC") or callsign.startswith("CCA"):
            return _make_route("ZUTF", "VNKT") if (180 <= heading <= 270) else _make_route("VNKT", "ZUTF")
        if callsign.startswith("CSN"):
            return _make_route("ZGGG", "VNKT") if (260 <= heading <= 340) else _make_route("VNKT", "ZGGG")

        # 11. General Aviation & Helicopters registered in Nepal (9N-...)
        if callsign.startswith("9N") or callsign.startswith("9-N"):
            return _make_route("VNKT", "VNPK")

        # 12. Overflight / Transiting Airways (High Altitude)
        alt_m = flight.position.altitude_baro_m or 0.0
        if alt_m > 8500:  # Above FL280
            if 45 <= heading <= 160:
                return _make_route("VIDP", "VECC")
            else:
                return _make_route("VECC", "VIDP")

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
        flight.route = self._resolve_flight_route(flight)

        # 3. Aircraft specifications
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
