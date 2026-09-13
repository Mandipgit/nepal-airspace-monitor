"""
Airport and Runway Response Schemas
"""

from typing import Optional, List
from pydantic import BaseModel, Field

class RunwaySchema(BaseModel):
    """Runway physical dimensions, surface, and threshold headings."""
    id: int
    airport_ident: str
    length_ft: Optional[int] = None
    width_ft: Optional[int] = None
    surface: Optional[str] = None
    lighted: bool = False
    closed: bool = False
    
    # Low-End Threshold
    le_ident: Optional[str] = None
    le_latitude_deg: Optional[float] = None
    le_longitude_deg: Optional[float] = None
    le_elevation_ft: Optional[int] = None
    le_heading_degt: Optional[float] = None
    le_displaced_threshold_ft: Optional[int] = None
    
    # High-End Threshold
    he_ident: Optional[str] = None
    he_latitude_deg: Optional[float] = None
    he_longitude_deg: Optional[float] = None
    he_elevation_ft: Optional[int] = None
    he_heading_degt: Optional[float] = None
    he_displaced_threshold_ft: Optional[int] = None

class AirportSummarySchema(BaseModel):
    """Airport summary entity for listings and map pins."""
    ident: str = Field(description="ICAO or local identifier (e.g. 'VNKT')")
    type: Optional[str] = Field(description="Type: large_airport, medium_airport, small_airport, heliport")
    name: str
    latitude_deg: float
    longitude_deg: float
    elevation_ft: Optional[int] = None
    continent: Optional[str] = None
    iso_country: Optional[str] = None
    iso_region: Optional[str] = None
    municipality: Optional[str] = None
    scheduled_service: bool = False
    gps_code: Optional[str] = None
    iata_code: Optional[str] = None
    local_code: Optional[str] = None

class AirportDetailSchema(AirportSummarySchema):
    """Comprehensive airport information with runways and external links."""
    home_link: Optional[str] = None
    wikipedia_link: Optional[str] = None
    keywords: Optional[str] = None
    runways: List[RunwaySchema] = Field(default_factory=list, description="Associated physical runways")

class AirportListResponse(BaseModel):
    """List envelope for airport queries."""
    total: int
    airports: List[AirportSummarySchema]
