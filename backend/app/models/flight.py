"""
Normalized Flight Data Models
Provider-independent schema for live aircraft tracking.
"""

from datetime import datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, computed_field

class FlightPosition(BaseModel):
    """Normalized spatial and kinematic position of an aircraft."""
    latitude: Optional[float] = Field(default=None, description="WGS-84 latitude in decimal degrees")
    longitude: Optional[float] = Field(default=None, description="WGS-84 longitude in decimal degrees")
    altitude_baro_m: Optional[float] = Field(default=None, description="Barometric altitude in meters")
    altitude_geo_m: Optional[float] = Field(default=None, description="Geometric altitude in meters")
    groundspeed_mps: Optional[float] = Field(default=None, description="Groundspeed in meters per second")
    heading_deg: Optional[float] = Field(default=None, description="True track / heading in degrees clockwise from North (0-360)")
    vertical_rate_mps: Optional[float] = Field(default=None, description="Vertical rate in m/s (+ climbing, - descending)")
    on_ground: bool = Field(default=False, description="True if surface position report indicates aircraft is on ground")
    timestamp: Optional[datetime] = Field(default=None, description="UTC timestamp of the position update")

    @computed_field
    def altitude_baro_ft(self) -> Optional[int]:
        """Barometric altitude converted to feet for standard aviation display."""
        if self.altitude_baro_m is not None:
            return round(self.altitude_baro_m * 3.28084)
        return None

    @computed_field
    def groundspeed_kts(self) -> Optional[int]:
        """Groundspeed converted to knots for standard aviation display."""
        if self.groundspeed_mps is not None:
            return round(self.groundspeed_mps * 1.94384)
        return None

    @computed_field
    def vertical_rate_fpm(self) -> Optional[int]:
        """Vertical rate converted to feet per minute (fpm)."""
        if self.vertical_rate_mps is not None:
            return round(self.vertical_rate_mps * 196.85)
        return None

class FlightIdentification(BaseModel):
    """Normalized aircraft and operator identification attributes."""
    icao24: str = Field(description="24-bit ICAO transponder address in lowercase hex representation")
    callsign: Optional[str] = Field(default=None, description="Radiotelephony callsign (e.g. 'BHA137', 'SHA826')")
    flight_number: Optional[str] = Field(default=None, description="Commercial flight number if resolved (e.g. 'U4 137')")
    registration: Optional[str] = Field(default=None, description="Aircraft tail registration if resolved (e.g. '9N-AMF')")
    aircraft_type_icao: Optional[str] = Field(default=None, description="ICAO aircraft type designator (e.g. 'AT76', 'DH8D')")
    operator_icao: Optional[str] = Field(default=None, description="ICAO 3-letter operator designator (e.g. 'BHA', 'SHA', 'RNA')")
    operator_name: Optional[str] = Field(default=None, description="Airline / operator company name (e.g. 'Buddha Air')")
    origin_country: Optional[str] = Field(default=None, description="Country of registration or ICAO address allocation")
    is_nepal_registered: bool = Field(default=False, description="True if ICAO24 belongs to the Nepalese 70a8.. allocation block")
    squawk: Optional[str] = Field(default=None, description="4-digit octal transponder squawk code")
    category: Optional[int] = Field(default=None, description="OpenSky emitter category code (0-17)")
    category_name: Optional[str] = Field(default=None, description="Descriptive category name (e.g. Light, Small, Large, Rotorcraft)")
    position_source: Optional[str] = Field(default=None, description="Position source technology (ADS-B, MLAT, ASTERIX, FLARM)")
    spi: Optional[bool] = Field(default=None, description="Special Purpose Indicator (ident button active)")

class FlightRoute(BaseModel):
    """Normalized flight origin and destination airport references."""
    origin_icao: Optional[str] = Field(default=None, description="Origin airport 4-letter ICAO code (e.g. 'VNKT')")
    origin_iata: Optional[str] = Field(default=None, description="Origin airport 3-letter IATA code (e.g. 'KTM')")
    origin_name: Optional[str] = Field(default=None, description="Origin airport common name")
    destination_icao: Optional[str] = Field(default=None, description="Destination airport 4-letter ICAO code (e.g. 'VNPK')")
    destination_iata: Optional[str] = Field(default=None, description="Destination airport 3-letter IATA code (e.g. 'PKR')")
    destination_name: Optional[str] = Field(default=None, description="Destination airport common name")

class NormalizedFlight(BaseModel):
    """Canonical representation of an active flight."""
    id: str = Field(description="Unique internal flight identifier, typically '{provider}_{icao24}'")
    provider: str = Field(description="Source provider name ('opensky' or 'flightaware')")
    identification: FlightIdentification
    position: FlightPosition
    route: Optional[FlightRoute] = None
    aircraft_spec: Optional[dict] = Field(default=None, description="Linked aircraft performance & capacity specifications")
    nearest_airport: Optional[str] = Field(default=None, description="Nearest airport code and name")
    nearest_airport_distance_km: Optional[float] = Field(default=None, description="Distance to nearest airport in km")
    last_contact: Optional[datetime] = Field(default=None, description="UTC timestamp of the latest signal receipt")
    data_freshness_seconds: Optional[float] = Field(default=None, description="Seconds elapsed between signal receipt and query")

class FlightCollectionResponse(BaseModel):
    """API response envelope for live flight queries."""
    total: int = Field(description="Total count of active flights returned")
    timestamp: datetime = Field(description="UTC timestamp when this response was assembled")
    cached: bool = Field(default=False, description="True if served from server-side in-memory cache")
    cache_age_seconds: Optional[float] = Field(default=None, description="Age of cached payload in seconds")
    flights: List[NormalizedFlight] = Field(default_factory=list, description="List of normalized flight entities")
