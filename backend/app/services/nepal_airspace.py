"""
Nepal Airspace Boundaries & Flight Filtering Service.

Enforces Nepal FIR airspace rules:
1. Live flights inbound to Nepal airports (e.g. destination is VNKT, VNPK, VNBW, etc.)
2. Live flights outbound from Nepal airports (e.g. origin is VNKT, VNPK, VNBW, etc.)
3. Domestic flights within Nepal (registered, local carriers, or both origin/destination in Nepal)
4. Transit/overflight flights physically entering Nepal's international boundary
   (even if not associated with Nepal).

Unrelated foreign flights outside Nepal borders (e.g. domestic Indian flights in Uttar Pradesh/Bihar)
are strictly excluded.
"""

import json
import logging
from pathlib import Path
from typing import Optional, Set

from shapely.geometry import shape, Point
from shapely.prepared import prep, PreparedGeometry

from app.models.flight import NormalizedFlight
from app.services.supabase.aviation_repository import FALLBACK_NEPAL_AIRPORTS

logger = logging.getLogger(__name__)

# Compile known Nepalese airport ICAO and IATA sets from the repository catalog
NEPAL_AIRPORT_ICAOS: Set[str] = set()
NEPAL_AIRPORT_IATAS: Set[str] = set()

for apt in FALLBACK_NEPAL_AIRPORTS:
    ident = (apt.get("ident") or "").strip().upper()
    iata = (apt.get("iata_code") or "").strip().upper()
    local = (apt.get("local_code") or "").strip().upper()
    if ident:
        NEPAL_AIRPORT_ICAOS.add(ident)
    if iata:
        NEPAL_AIRPORT_IATAS.add(iata)
    if local:
        NEPAL_AIRPORT_IATAS.add(local)

# Known Nepalese commercial and charter airline operator codes
NEPAL_OPERATOR_ICAOS: Set[str] = {
    "BHA",  # Buddha Air
    "NYT",  # Yeti Airlines
    "SHA",  # Shree Airlines
    "RNA",  # Nepal Airlines
    "TRA",  # Tara Air
    "SMT",  # Summit Air
    "HRA",  # Sita Air
    "HIM",  # Himalaya Airlines
    "GBL",  # Guna Airlines
    "NYA",  # Air Dynasty
}

# Pre-computed bounding box for fast early-exit before shapely point-in-polygon
# Bounding box of Nepal with ~0.05 deg margin
NEPAL_GEO_LAMIN = 26.30
NEPAL_GEO_LOMIN = 80.00
NEPAL_GEO_LAMAX = 30.50
NEPAL_GEO_LOMAX = 88.25

_prepared_boundary: Optional[PreparedGeometry] = None


def _get_prepared_nepal_boundary() -> Optional[PreparedGeometry]:
    """Load and prepare Nepal international border polygon from GeoJSON for microsecond queries."""
    global _prepared_boundary
    if _prepared_boundary is not None:
        return _prepared_boundary

    possible_paths = [
        Path(__file__).resolve().parent.parent / "data" / "nepal-boundary.geojson",
        Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "nepal-boundary.geojson",
    ]

    for p in possible_paths:
        if p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                features = data.get("features", [])
                if features:
                    geom = shape(features[0]["geometry"])
                    _prepared_boundary = prep(geom)
                    logger.info(f"Loaded and prepared Nepal border geometry from {p}")
                    return _prepared_boundary
            except Exception as e:
                logger.error(f"Failed to load Nepal boundary GeoJSON from {p}: {e}")

    logger.warning("Nepal boundary GeoJSON not found; falling back to bounding box containment.")
    return None


def is_point_inside_nepal(lat: float, lon: float) -> bool:
    """Check if GPS coordinate (lat, lon) is physically within Nepal's international border."""
    # Fast early-exit rejection if outside Nepal's bounding box
    if not (NEPAL_GEO_LAMIN <= lat <= NEPAL_GEO_LAMAX and NEPAL_GEO_LOMIN <= lon <= NEPAL_GEO_LOMAX):
        return False

    prepared = _get_prepared_nepal_boundary()
    if prepared is not None:
        # GeoJSON is [lon, lat]
        return prepared.contains(Point(lon, lat))

    # Bbox fallback if GeoJSON failed to load
    return True


def is_nepal_airport(code: Optional[str]) -> bool:
    """Check if an ICAO or IATA code corresponds to an airport in Nepal."""
    if not code:
        return False
    clean = code.strip().upper()
    # Nepalese ICAO airport codes are strictly 4 characters starting with 'VN' (ICAO Doc 7910)
    if len(clean) == 4 and clean.startswith("VN"):
        return True
    # Nepalese IATA (3-letter) or local codes (e.g. KTM, PKR, BWA, LUA, BIR, KEP, etc.)
    if clean in NEPAL_AIRPORT_ICAOS or clean in NEPAL_AIRPORT_IATAS:
        return True
    return False


def is_flight_associated_with_nepal(flight: NormalizedFlight) -> bool:
    """
    Check if a flight is associated with Nepal through registry, operator, or route.
    """
    # 1. Nepalese registration
    if flight.identification.is_nepal_registered:
        return True

    country = (flight.identification.origin_country or "").strip().lower()
    if country == "nepal":
        return True

    # 2. Callsign or registration prefix (9N-)
    cs = (flight.identification.callsign or "").strip().upper()
    reg = (flight.identification.registration or "").strip().upper()
    if cs.startswith("9N") or cs.startswith("9-N") or reg.startswith("9N") or reg.startswith("9-N"):
        return True

    # 3. Operator code
    op = (flight.identification.operator_icao or "").strip().upper()
    if op in NEPAL_OPERATOR_ICAOS or (len(cs) >= 3 and cs[:3] in NEPAL_OPERATOR_ICAOS):
        return True

    # 4. Route: Inbound to Nepal or Outbound from Nepal
    if flight.route:
        if is_nepal_airport(flight.route.origin_icao) or is_nepal_airport(flight.route.origin_iata):
            return True
        if is_nepal_airport(flight.route.destination_icao) or is_nepal_airport(flight.route.destination_iata):
            return True

    return False


def should_display_flight_in_nepal_context(flight: NormalizedFlight) -> bool:
    """
    Determine if a flight meets the user's display criteria:
    - Inbound to Nepal, outbound from Nepal, or domestic Nepal flights.
    - OR physically inside Nepal's boundary (transit/overflights).
    - Unrelated foreign flights outside Nepal are rejected.
    """
    # 1. Associated with Nepal (inbound, outbound, domestic)
    if is_flight_associated_with_nepal(flight):
        return True

    # 2. Physically inside Nepal boundary (transit/overflight)
    if flight.position.latitude is not None and flight.position.longitude is not None:
        if is_point_inside_nepal(flight.position.latitude, flight.position.longitude):
            return True

    return False
