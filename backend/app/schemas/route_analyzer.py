"""
Pydantic Schemas for Route Aircraft Analyzer
Provides validation models for route suitability requests and comparative response structures.
Supports airport lookups by ICAO, IATA, or airport name, and exposes detailed runway parameters for both departure and destination.
"""

from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from app.schemas.airport import RunwaySchema


class RouteAircraftAnalysisRequest(BaseModel):
    """
    Request payload to analyze aircraft compatibility on a specific route within Nepal.
    Accepts ICAO code, IATA code, or airport name for departure and destination.
    """
    departure_ident: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Departure airport ICAO ident, IATA code, or airport name in Nepal (e.g. 'VNKT', 'KTM', 'Tribhuvan')"
    )
    destination_ident: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Destination airport ICAO ident, IATA code, or airport name in Nepal (e.g. 'VNPK', 'PKR', 'Pokhara')"
    )
    aircraft_identifiers: List[str] = Field(
        ...,
        min_length=1,
        max_length=30,
        description="List of aircraft model names or ICAO type codes to analyze and compare"
    )
    wind_kmh: float = Field(
        default=0.0,
        ge=-1000.0,
        le=1000.0,
        description="Wind speed component in km/h. Positive = Headwind (reduces ground speed), Negative = Tailwind (increases ground speed), 0 = Calm."
    )
    descent_distance_km: float = Field(
        default=50.0,
        ge=0.0,
        le=500.0,
        description="Assumed descent phase distance in kilometers. Must be non-negative (default: 50 km)."
    )

    @field_validator("departure_ident", "destination_ident")
    @classmethod
    def normalize_ident(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Airport identifier or name cannot be blank.")
        return cleaned

    @field_validator("aircraft_identifiers")
    @classmethod
    def normalize_and_deduplicate_aircraft(cls, v: List[str]) -> List[str]:
        cleaned = []
        seen = set()
        for item in v:
            name = item.strip()
            if name and name.upper() not in seen:
                cleaned.append(name)
                seen.add(name.upper())
        if not cleaned:
            raise ValueError("At least one valid aircraft identifier must be provided.")
        return cleaned


class AirportRoutePoint(BaseModel):
    """Airport summary details for route origin/destination."""
    ident: str = Field(description="ICAO or local identifier (e.g. 'VNKT')")
    name: str = Field(description="Airport full name")
    latitude: float = Field(description="Latitude in decimal degrees")
    longitude: float = Field(description="Longitude in decimal degrees")
    elevation_ft: Optional[int] = Field(default=None, description="Field elevation in feet above MSL")
    municipality: Optional[str] = Field(default=None, description="Municipality or nearest city")


class RouteInfo(BaseModel):
    """Geographic route information and computed great-circle distance."""
    departure: AirportRoutePoint
    destination: AirportRoutePoint
    distance_km: float = Field(description="Great-circle Haversine distance in kilometers")


class AnalysisConditions(BaseModel):
    """Meteorological and flight profile parameters applied during the analysis."""
    wind_kmh: float = Field(description="Wind component in km/h (positive: headwind, negative: tailwind)")
    descent_distance_km: float = Field(description="Modeled descent distance in kilometers")


class AirportRunwayAnalysisInfo(BaseModel):
    """Detailed physical runway characteristics selected for route analysis."""
    runway_length_m: float = Field(description="Runway length in meters")
    runway_length_ft: Optional[int] = Field(default=None, description="Runway length in feet")
    runway_width_m: Optional[float] = Field(default=None, description="Runway width in meters")
    runway_width_ft: Optional[int] = Field(default=None, description="Runway width in feet")
    selection_method: str = Field(default="longest_available", description="Method used to pick runway")
    runway_ident: Optional[str] = Field(default=None, description="Runway designator/identifier (e.g. '02/20')")
    surface: Optional[str] = Field(default=None, description="Runway surface type (e.g. ASP, CONC, GRVL)")
    lighted: bool = Field(default=False, description="Runway lighting status")
    closed: bool = Field(default=False, description="Runway closure status")

    # Low-End threshold
    le_ident: Optional[str] = Field(default=None, description="Low-end threshold designator (e.g. '02')")
    le_heading_degt: Optional[float] = Field(default=None, description="Low-end true heading in degrees")
    le_elevation_ft: Optional[int] = Field(default=None, description="Low-end threshold elevation in feet")
    le_displaced_threshold_ft: Optional[int] = Field(default=None, description="Low-end displaced threshold in feet")

    # High-End threshold
    he_ident: Optional[str] = Field(default=None, description="High-end threshold designator (e.g. '20')")
    he_heading_degt: Optional[float] = Field(default=None, description="High-end true heading in degrees")
    he_elevation_ft: Optional[int] = Field(default=None, description="High-end threshold elevation in feet")
    he_displaced_threshold_ft: Optional[int] = Field(default=None, description="High-end displaced threshold in feet")

    # Associated physical runway records
    all_runways: List[RunwaySchema] = Field(default_factory=list, description="All physical runways at this airport from runways table")


# Backward compatibility alias
DestinationRunwayInfo = AirportRunwayAnalysisInfo


class AircraftAnalysisResult(BaseModel):
    """Calculated suitability metrics for an individual aircraft model on the selected route."""
    aircraft_identifier: str = Field(description="Requested identifier or alias")
    aircraft_name: str = Field(description="Matched model name in specifications database")
    passenger_capacity: Optional[int] = Field(default=None, description="Maximum passenger seating capacity")

    cruise_speed_kmh: Optional[float] = Field(default=None, description="Cruise true airspeed in km/h")
    approach_speed: Optional[float] = Field(default=None, description="Approach indicated airspeed in km/h")
    nominal_range_km: Optional[float] = Field(default=None, description="Nominal manufacturer range in kilometers")

    estimated_flight_time_min: Optional[float] = Field(default=None, description="Calculated block/flight time in minutes")
    range_margin_km: Optional[float] = Field(default=None, description="Nominal range minus route distance in km")

    takeoff_runway_margin_m: Optional[float] = Field(default=None, description="Destination runway length minus TOFL in meters")
    landing_runway_margin_m: Optional[float] = Field(default=None, description="Destination runway length minus LFL in meters")

    within_calculated_limits: bool = Field(description="Whether the aircraft meets modelled range and runway criteria")
    analysis_status: str = Field(
        description="Analytical status: 'within_calculated_limits', 'outside_calculated_limits', 'insufficient_ground_speed', or 'missing_performance_data'"
    )
    notes: Optional[str] = Field(default=None, description="Contextual guidance or limiting factors")


class RouteAircraftAnalysisResponse(BaseModel):
    """Top-level comparison response for route aircraft suitability analysis."""
    route: RouteInfo
    conditions: AnalysisConditions
    departure_runway: Optional[AirportRunwayAnalysisInfo] = Field(default=None, description="Selected primary runway for departure airport")
    destination_runway: AirportRunwayAnalysisInfo = Field(description="Selected primary runway for destination airport")
    departure_runways: List[RunwaySchema] = Field(default_factory=list, description="All physical runways for departure airport from runways table")
    destination_runways: List[RunwaySchema] = Field(default_factory=list, description="All physical runways for destination airport from runways table")
    results: List[AircraftAnalysisResult] = Field(default_factory=list, description="Suitability calculations per matched aircraft")
    missing_aircraft: List[str] = Field(default_factory=list, description="Aircraft identifiers not found in the specifications database")
    disclaimer: str = Field(
        default=(
            "Approximate analytical comparison based on static aircraft specifications and published runway dimensions. "
            "This output is for exploratory informational use only and is not an operational flight plan, "
            "dispatch release, or certified aviation performance calculation."
        ),
        description="Aviation analytical disclaimer"
    )


class RouteInformationResponse(BaseModel):
    """Detailed response for route distance, departure runway, and destination runway."""
    route: RouteInfo
    departure_runway: AirportRunwayAnalysisInfo = Field(description="Selected primary runway for departure airport")
    destination_runway: AirportRunwayAnalysisInfo = Field(description="Selected primary runway for destination airport")
    departure_runways: List[RunwaySchema] = Field(default_factory=list, description="All physical runways for departure airport from runways table")
    destination_runways: List[RunwaySchema] = Field(default_factory=list, description="All physical runways for destination airport from runways table")
