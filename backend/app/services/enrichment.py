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
    "VOBL": {"iata": "BLR", "icao": "VOBL", "name": "Bengaluru (Kempegowda)"},
    "VIAR": {"iata": "ATQ", "icao": "VIAR", "name": "Amritsar (Sri Guru Ram Dass)"},
    "VILK": {"iata": "LKO", "icao": "VILK", "name": "Lucknow (Chaudhary Charan Singh)"},
    "VIBN": {"iata": "VNS", "icao": "VIBN", "name": "Varanasi (Lal Bahadur Shastri)"},
    "VEPT": {"iata": "PAT", "icao": "VEPT", "name": "Patna (Jay Prakash Narayan)"},
    "VEGK": {"iata": "GOP", "icao": "VEGK", "name": "Gorakhpur"},
    "VOMM": {"iata": "MAA", "icao": "VOMM", "name": "Chennai"},
    "VOHS": {"iata": "HYD", "icao": "VOHS", "name": "Hyderabad (Rajiv Gandhi)"},
    "VGHS": {"iata": "DAC", "icao": "VGHS", "name": "Dhaka (Hazrat Shahjalal)"},
    "VQPR": {"iata": "PBH", "icao": "VQPR", "name": "Paro International"},

    # Middle East
    "OMDB": {"iata": "DXB", "icao": "OMDB", "name": "Dubai International"},
    "OTHH": {"iata": "DOH", "icao": "OTHH", "name": "Doha (Hamad International)"},
    "OKBK": {"iata": "KWI", "icao": "OKBK", "name": "Kuwait International"},
    "OMSJ": {"iata": "SHJ", "icao": "OMSJ", "name": "Sharjah International"},
    "OMAA": {"iata": "AUH", "icao": "OMAA", "name": "Abu Dhabi International"},
    "OBBI": {"iata": "BAH", "icao": "OBBI", "name": "Bahrain International"},
    "OEDF": {"iata": "DMM", "icao": "OEDF", "name": "Dammam (King Fahd)"},
    "OERK": {"iata": "RUH", "icao": "OERK", "name": "Riyadh (King Khalid)"},
    "OOMS": {"iata": "MCT", "icao": "OOMS", "name": "Muscat International"},

    # Southeast & East Asia
    "VTBS": {"iata": "BKK", "icao": "VTBS", "name": "Bangkok (Suvarnabhumi)"},
    "VTBD": {"iata": "DMK", "icao": "VTBD", "name": "Bangkok (Don Mueang)"},
    "WMKK": {"iata": "KUL", "icao": "WMKK", "name": "Kuala Lumpur International"},
    "WSSS": {"iata": "SIN", "icao": "WSSS", "name": "Singapore Changi"},
    "VHHH": {"iata": "HKG", "icao": "VHHH", "name": "Hong Kong International"},
    "RJAA": {"iata": "NRT", "icao": "RJAA", "name": "Tokyo (Narita)"},
    "ZUTF": {"iata": "TFU", "icao": "ZUTF", "name": "Chengdu Tianfu"},
    "ZGGG": {"iata": "CAN", "icao": "ZGGG", "name": "Guangzhou Baiyun"},
    "ZUCK": {"iata": "CKG", "icao": "ZUCK", "name": "Chongqing Jiangbei"},
    "ZPPP": {"iata": "KMG", "icao": "ZPPP", "name": "Kunming Changshui"},
    "ZULS": {"iata": "LXA", "icao": "ZULS", "name": "Lhasa Gonggar"},
    "UTAA": {"iata": "ASB", "icao": "UTAA", "name": "Ashgabat"},
    "VVNB": {"iata": "HAN", "icao": "VVNB", "name": "Hanoi (Noi Bai)"},
    "LTFM": {"iata": "IST", "icao": "LTFM", "name": "Istanbul Airport"},
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

# Verified commercial airline route mappings for flights operating in Nepal & transit airways
KNOWN_SCHEDULED_ROUTES: Dict[str, Tuple[str, str]] = {
    # Air India (AIC) - Real daily schedules into Kathmandu
    "AIC211": ("VIDP", "VNKT"),  # DEL -> KTM (Flight in user report)
    "AIC212": ("VNKT", "VIDP"),  # KTM -> DEL
    "AIC213": ("VIDP", "VNKT"),  # DEL -> KTM
    "AIC214": ("VNKT", "VIDP"),  # KTM -> DEL
    "AIC215": ("VIDP", "VNKT"),  # DEL -> KTM
    "AIC216": ("VNKT", "VIDP"),  # KTM -> DEL
    "AIC217": ("VIDP", "VNKT"),  # DEL -> KTM
    "AIC218": ("VNKT", "VIDP"),  # KTM -> DEL

    # IndiGo (IGO)
    "IGO6041": ("VIDP", "VNKT"), # DEL -> KTM
    "IGO6042": ("VNKT", "VIDP"), # KTM -> DEL
    "IGO31": ("VIDP", "VNKT"),   # DEL -> KTM
    "IGO32": ("VNKT", "VIDP"),   # KTM -> DEL
    "IGO1151": ("VIDP", "VNKT"), # DEL -> KTM
    "IGO1152": ("VNKT", "VIDP"), # KTM -> DEL
    "IGO1153": ("VIDP", "VNKT"), # DEL -> KTM
    "IGO1154": ("VNKT", "VIDP"), # KTM -> DEL
    "IGO1157": ("VABB", "VNKT"), # BOM -> KTM
    "IGO1158": ("VNKT", "VABB"), # KTM -> BOM
    "IGO493": ("VECC", "VIDP"),  # CCU -> DEL (Overflight transit)

    # flydubai (FDB)
    "FDB575": ("OMDB", "VNKT"),  # DXB -> KTM
    "FDB576": ("VNKT", "OMDB"),  # KTM -> DXB
    "FDB577": ("OMDB", "VNKT"),
    "FDB578": ("VNKT", "OMDB"),
    "FDB583": ("OMDB", "VNKT"),
    "FDB584": ("VNKT", "OMDB"),
    "FDB1595": ("OMDB", "VNKT"), # DXB -> KTM
    "FDB1596": ("VNKT", "OMDB"), # KTM -> DXB

    # Qatar Airways (QTR)
    "QTR644": ("OTHH", "VNKT"),  # DOH -> KTM
    "QTR645": ("VNKT", "OTHH"),  # KTM -> DOH
    "QTR648": ("OTHH", "VNKT"),
    "QTR649": ("VNKT", "OTHH"),
    "QTR650": ("OTHH", "VNKT"),
    "QTR651": ("VNKT", "OTHH"),
    "QTR652": ("OTHH", "VNKT"),
    "QTR653": ("VNKT", "OTHH"),

    # Himalaya Airlines (HIM / HRA)
    "HIM891": ("WMKK", "VNKT"),  # KUL -> KTM
    "HRA891": ("WMKK", "VNKT"),
    "HIM890": ("VNKT", "WMKK"),  # KTM -> KUL
    "HRA890": ("VNKT", "WMKK"),
    "HIM381": ("OMDB", "VNKT"),  # DXB -> KTM
    "HRA381": ("OMDB", "VNKT"),
    "HIM382": ("VNKT", "OMDB"),  # KTM -> DXB
    "HRA382": ("VNKT", "OMDB"),
    "HIM361": ("OEDF", "VNKT"),  # DMM -> KTM
    "HRA361": ("OEDF", "VNKT"),
    "HIM362": ("VNKT", "OEDF"),  # KTM -> DMM
    "HRA362": ("VNKT", "OEDF"),
    "HIM391": ("OKBK", "VNKT"),  # KWI -> KTM
    "HRA391": ("OKBK", "VNKT"),
    "HIM392": ("VNKT", "OKBK"),  # KTM -> KWI
    "HRA392": ("VNKT", "OKBK"),
    "HIM751": ("ZUTF", "VNKT"),  # TFU -> KTM
    "HRA751": ("ZUTF", "VNKT"),
    "HIM752": ("VNKT", "ZUTF"),  # KTM -> TFU
    "HRA752": ("VNKT", "ZUTF"),

    # Nepal Airlines (RNA)
    "RNA205": ("VIDP", "VNKT"),  # DEL -> KTM
    "RNA206": ("VNKT", "VIDP"),  # KTM -> DEL
    "RNA207": ("VIDP", "VNKT"),
    "RNA208": ("VNKT", "VIDP"),
    "RNA217": ("VABB", "VNKT"),  # BOM -> KTM
    "RNA218": ("VNKT", "VABB"),  # KTM -> BOM
    "RNA231": ("OMDB", "VNKT"),  # DXB -> KTM
    "RNA232": ("VNKT", "OMDB"),  # KTM -> DXB
    "RNA239": ("OTHH", "VNKT"),  # DOH -> KTM
    "RNA240": ("VNKT", "OTHH"),  # KTM -> DOH
    "RNA401": ("VTBS", "VNKT"),  # BKK -> KTM
    "RNA402": ("VNKT", "VTBS"),  # KTM -> BKK
    "RNA415": ("WMKK", "VNKT"),  # KUL -> KTM
    "RNA416": ("VNKT", "WMKK"),  # KTM -> KUL
    "RNA701": ("RJAA", "VNKT"),  # NRT -> KTM
    "RNA702": ("VNKT", "RJAA"),  # KTM -> NRT

    # Singapore Airlines (SIA)
    "SIA146": ("WSSS", "VNKT"),  # SIN -> KTM
    "SIA145": ("VNKT", "WSSS"),  # KTM -> SIN
    "SIA148": ("WSSS", "VNKT"),
    "SIA147": ("VNKT", "WSSS"),

    # Malaysia Airlines (MAS)
    "MAS114": ("WMKK", "VNKT"),  # KUL -> KTM
    "MAS113": ("VNKT", "WMKK"),  # KTM -> KUL

    # Batik Air Malaysia (MXD / BAT)
    "MXD814": ("WMKK", "VNKT"),  # KUL -> KTM
    "BAT814": ("WMKK", "VNKT"),
    "MXD813": ("VNKT", "WMKK"),  # KTM -> KUL
    "BAT813": ("VNKT", "WMKK"),

    # Drukair (DRK)
    "DRK101": ("VQPR", "VNKT"),  # PBH -> KTM
    "DRK102": ("VNKT", "VQPR"),  # KTM -> PBH

    # Biman Bangladesh (BBC / BIM)
    "BBC371": ("VGHS", "VNKT"),  # DAC -> KTM
    "BBC372": ("VNKT", "VGHS"),  # KTM -> DAC

    # Thai Airways (THA)
    "THA319": ("VTBS", "VNKT"),  # BKK -> KTM
    "THA320": ("VNKT", "VTBS"),  # KTM -> BKK

    # Air Arabia (ABY / BPA)
    "ABY535": ("OMSJ", "VNKT"),  # SHJ -> KTM
    "ABY536": ("VNKT", "OMSJ"),  # KTM -> SHJ
    "ABY537": ("OMSJ", "VNKT"),
    "ABY538": ("VNKT", "OMSJ"),
    "BPA511": ("OMAA", "VNKT"),  # AUH -> KTM
    "BPA512": ("VNKT", "OMAA"),  # KTM -> AUH

    # Overflights / Regional Transits Across Nepal Airspace Corridor
    "CPA665": ("VHHH", "VIDP"),  # HKG -> DEL
    "TUA698": ("VVNB", "UTAA"),  # HAN -> ASB
    "SEJ2472": ("VEGK", "VIDP"), # GOP -> DEL
    "AXB1408": ("VEBD", "VOBL"), # IXB -> BLR
}


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate initial great-circle bearing in degrees from point 1 to point 2."""
    dlon = math.radians(lon2 - lon1)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    y = math.sin(dlon) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def is_heading_towards(cur_lat: Optional[float], cur_lon: Optional[float], heading: Optional[float], target_icao: str) -> Optional[bool]:
    """
    Checks if aircraft track is pointing towards target airport (within 85 degrees of true bearing).
    Works accurately from any quadrant (North, South, East, West) and on runway approach turns.
    """
    if cur_lat is None or cur_lon is None or heading is None:
        return None
    target_coord = AIRPORT_COORDS.get(target_icao)
    if not target_coord:
        return None
    
    target_lat, target_lon = target_coord
    bearing = calculate_bearing(cur_lat, cur_lon, target_lat, target_lon)
    diff = abs(heading - bearing) % 360.0
    if diff > 180.0:
        diff = 360.0 - diff
    return diff <= 85.0

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
        Dynamically resolve departure and arrival destinations using:
        1. Verified commercial airline route catalog (real scheduled airline operations)
        2. Spherical great-circle bearing calculations (track towards vs away from destination)
        3. Domestic odd/even flight numbering conventions in Nepal
        """
        raw_callsign = (flight.identification.callsign or "").strip().upper()
        if not raw_callsign:
            return None

        callsign = "".join(c for c in raw_callsign if c.isalnum())
        if not callsign:
            return None

        # 1. Check Known Verified Airline Routes first (highest accuracy)
        if callsign in KNOWN_SCHEDULED_ROUTES:
            orig_k, dest_k = KNOWN_SCHEDULED_ROUTES[callsign]
            return _make_route(orig_k, dest_k)

        lat = flight.position.latitude
        lon = flight.position.longitude
        heading = flight.position.heading_deg

        # 2. Buddha Air (BHA) Routes
        if callsign.startswith("BHA"):
            digits_str = "".join(c for c in callsign if c.isdigit())
            flight_num = int(digits_str) if digits_str else None

            # Mountain Scenic Flight: strictly 100-109
            if flight_num and 100 <= flight_num <= 109:
                return _make_route("VNKT", "VNKT")

            dest_code = "VNPK"  # Default KTM - PKR
            if flight_num:
                if 200 <= flight_num <= 249:
                    dest_code = "VNBW"  # Bhairahawa
                elif 250 <= flight_num <= 269:
                    # Inter-regional Pokhara - Bhairahawa
                    is_pkr = is_heading_towards(lat, lon, heading, "VNPK")
                    return _make_route("VNBW", "VNPK") if is_pkr else _make_route("VNPK", "VNBW")
                elif 300 <= flight_num <= 349:
                    dest_code = "VNVT"  # Biratnagar
                elif 400 <= flight_num <= 449:
                    dest_code = "VNNG"  # Nepalgunj
                elif 500 <= flight_num <= 549:
                    dest_code = "VNCG"  # Bhadrapur
                elif 600 <= flight_num <= 649:
                    dest_code = "VNJP"  # Janakpur
                elif 650 <= flight_num <= 699:
                    dest_code = "VNPK"  # Pokhara
                elif 700 <= flight_num <= 749:
                    dest_code = "VNDH"  # Dhangadhi
                elif 800 <= flight_num <= 849:
                    dest_code = "VNSI"  # Simara
                elif 900 <= flight_num <= 949:
                    dest_code = "VNBP"  # Bharatpur
                elif 950 <= flight_num <= 979:
                    dest_code = "VNCG"  # Bhadrapur (including BHA960)

            # Determine direction:
            # 1) Spherical bearing calculation towards KTM
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            if is_inbound is not None:
                return _make_route(dest_code, "VNKT") if is_inbound else _make_route("VNKT", dest_code)

            # 2) Domestic numbering standard: Even = Inbound to KTM, Odd = Outbound from KTM
            if flight_num is not None:
                return _make_route(dest_code, "VNKT") if (flight_num % 2 == 0) else _make_route("VNKT", dest_code)

            return _make_route("VNKT", dest_code)

        # 3. Yeti Airlines (NYT) Routes
        if callsign.startswith("NYT"):
            digits_str = "".join(c for c in callsign if c.isdigit())
            flight_num = int(digits_str) if digits_str else None

            if flight_num and 100 <= flight_num <= 109:
                return _make_route("VNKT", "VNKT")

            dest_code = "VNPK"
            if flight_num:
                if 350 <= flight_num <= 399:
                    dest_code = "VNVT"  # Biratnagar
                elif 420 <= flight_num <= 449:
                    dest_code = "VNNG"  # Nepalgunj
                elif 550 <= flight_num <= 569:
                    dest_code = "VNJP"  # Janakpur
                elif 670 <= flight_num <= 699:
                    dest_code = "VNPK"  # Pokhara
                elif 780 <= flight_num <= 799:
                    dest_code = "VNBW"  # Bhairahawa
                elif 890 <= flight_num <= 899:
                    dest_code = "VNCG"  # Bhadrapur

            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            if is_inbound is not None:
                return _make_route(dest_code, "VNKT") if is_inbound else _make_route("VNKT", dest_code)
            if flight_num is not None:
                return _make_route(dest_code, "VNKT") if (flight_num % 2 == 0) else _make_route("VNKT", dest_code)
            return _make_route("VNKT", dest_code)

        # 4. Shree Airlines (SHA) Routes
        if callsign.startswith("SHA"):
            digits_str = "".join(c for c in callsign if c.isdigit())
            flight_num = int(digits_str) if digits_str else None

            if flight_num and 100 <= flight_num <= 109:
                return _make_route("VNKT", "VNKT")

            dest_code = "VNPK"
            if flight_num:
                if 220 <= flight_num <= 239:
                    dest_code = "VNBW"  # Bhairahawa
                elif 410 <= flight_num <= 429:
                    dest_code = "VNNG"  # Nepalgunj
                elif 700 <= flight_num <= 729:
                    dest_code = "VNVT"  # Biratnagar
                elif 800 <= flight_num <= 829:
                    dest_code = "VNDH"  # Dhangadhi
                elif 850 <= flight_num <= 879:
                    dest_code = "VNCG"  # Bhadrapur
                elif 910 <= flight_num <= 929:
                    dest_code = "VNSI"  # Simara

            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            if is_inbound is not None:
                return _make_route(dest_code, "VNKT") if is_inbound else _make_route("VNKT", dest_code)
            if flight_num is not None:
                return _make_route(dest_code, "VNKT") if (flight_num % 2 == 0) else _make_route("VNKT", dest_code)
            return _make_route("VNKT", dest_code)

        # 5. Tara Air (TRA) & Summit Air (SMT) Mountain Routes
        if callsign.startswith("TRA") or callsign.startswith("SMT"):
            digits = "".join(c for c in callsign if c.isdigit())
            if digits.startswith("2"):
                return _make_route("VNPK", "VNJS") # Pokhara - Jomsom
            elif digits.startswith("3"):
                return _make_route("VNNG", "VNST") # Nepalgunj - Simikot
            else:
                return _make_route("VNKT", "VNLK") # Kathmandu - Lukla

        # 6. Air India (AIC) & IndiGo (IGO)
        if callsign.startswith("IGO") or callsign.startswith("AIC"):
            digits_str = "".join(c for c in callsign if c.isdigit())
            indian_port = "VABB" if (digits_str and digits_str.startswith("4")) else "VIDP"
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            if is_inbound is not None:
                return _make_route(indian_port, "VNKT") if is_inbound else _make_route("VNKT", indian_port)
            flight_num = int(digits_str) if digits_str else None
            if flight_num is not None:
                # Odd flight numbers (AIC211, IGO6041) = Inbound to KTM, Even = Outbound from KTM
                return _make_route(indian_port, "VNKT") if (flight_num % 2 != 0) else _make_route("VNKT", indian_port)
            return _make_route(indian_port, "VNKT")

        # 7. Nepal Airlines (RNA)
        if callsign.startswith("RNA"):
            digits = "".join(c for c in callsign if c.isdigit())
            if digits.startswith("20"):
                intl_port = "VIDP" # Delhi
            elif digits.startswith("21"):
                intl_port = "VABB" # Mumbai
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

            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            if is_inbound is not None:
                return _make_route(intl_port, "VNKT") if is_inbound else _make_route("VNKT", intl_port)
            flight_num = int(digits) if digits else None
            if flight_num is not None:
                return _make_route(intl_port, "VNKT") if (flight_num % 2 != 0) else _make_route("VNKT", intl_port)
            return _make_route(intl_port, "VNKT")

        # 8. Himalaya Airlines (HRA / HIM)
        if callsign.startswith("HRA") or callsign.startswith("HIM"):
            digits = "".join(c for c in callsign if c.isdigit())
            if digits.startswith("36"):
                intl_port = "OEDF" # Dammam
            elif digits.startswith("38"):
                intl_port = "OMDB" # Dubai
            elif digits.startswith("39"):
                intl_port = "OKBK" # Kuwait
            elif digits.startswith("89"):
                intl_port = "WMKK" # Kuala Lumpur
            elif digits.startswith("75"):
                intl_port = "ZUTF" # Chengdu
            elif digits.startswith("73"):
                intl_port = "ZGGG" # Guangzhou
            else:
                intl_port = "OTHH" # Doha

            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            if is_inbound is not None:
                return _make_route(intl_port, "VNKT") if is_inbound else _make_route("VNKT", intl_port)
            flight_num = int(digits) if digits else None
            if flight_num is not None:
                return _make_route(intl_port, "VNKT") if (flight_num % 2 != 0) else _make_route("VNKT", intl_port)
            return _make_route(intl_port, "VNKT")

        # 9. Gulf Carriers
        if callsign.startswith("QTR"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("OTHH", "VNKT") if is_inbound is not False else _make_route("VNKT", "OTHH")
        if callsign.startswith("FDB"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("OMDB", "VNKT") if is_inbound is not False else _make_route("VNKT", "OMDB")
        if callsign.startswith("ABY") or callsign.startswith("BPA"):
            intl_port = "OMAA" if callsign.startswith("BPA") else "OMSJ"
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route(intl_port, "VNKT") if is_inbound is not False else _make_route("VNKT", intl_port)
        if callsign.startswith("JZR"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("OKBK", "VNKT") if is_inbound is not False else _make_route("VNKT", "OKBK")
        if callsign.startswith("GFA"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("OBBI", "VNKT") if is_inbound is not False else _make_route("VNKT", "OBBI")

        # 10. Southeast Asia Carriers
        if callsign.startswith("SIA"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("WSSS", "VNKT") if is_inbound is not False else _make_route("VNKT", "WSSS")
        if callsign.startswith("MAS") or callsign.startswith("MXD") or callsign.startswith("BAT"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("WMKK", "VNKT") if is_inbound is not False else _make_route("VNKT", "WMKK")
        if callsign.startswith("THA"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("VTBS", "VNKT") if is_inbound is not False else _make_route("VNKT", "VTBS")

        # 11. Regional Neighbors
        if callsign.startswith("DRK") or callsign.startswith("KB"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("VQPR", "VNKT") if is_inbound is not False else _make_route("VNKT", "VQPR")
        if callsign.startswith("BIM") or callsign.startswith("BBC"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("VGHS", "VNKT") if is_inbound is not False else _make_route("VNKT", "VGHS")
        if callsign.startswith("CSC") or callsign.startswith("CCA"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("ZUTF", "VNKT") if is_inbound is not False else _make_route("VNKT", "ZUTF")
        if callsign.startswith("CSN"):
            is_inbound = is_heading_towards(lat, lon, heading, "VNKT")
            return _make_route("ZGGG", "VNKT") if is_inbound is not False else _make_route("VNKT", "ZGGG")

        # 12. General Aviation & Helicopters registered in Nepal (9N-...)
        if callsign.startswith("9N") or callsign.startswith("9-N"):
            return _make_route("VNKT", "VNPK")

        # 13. Overflight / Transiting Airways (High Altitude)
        alt_m = flight.position.altitude_baro_m or 0.0
        if alt_m > 8500:  # Above FL280
            # If tracking towards Delhi/Northwest India
            if heading and (240 <= heading <= 330):
                return _make_route("VECC", "VIDP")
            else:
                return _make_route("VIDP", "VECC")

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
