"""
Aircraft Specifications Response Schemas
"""

from typing import Optional, List
from pydantic import BaseModel, Field

class AircraftSpecificationSchema(BaseModel):
    """Aircraft performance, weight, and dimension specifications."""
    id: int
    model: str = Field(description="Aircraft commercial model name (e.g. 'ATR72-500Basic')")
    icao_type: str = Field(description="ICAO designator or type code (e.g. 'AT7', 'CR2', '320')")
    category: Optional[str] = Field(description="Category: regional, commuter, short_medium, business, general, long_range")
    engine_type: Optional[str] = Field(description="Turboprop, Turbofan, Piston")
    engine_model: Optional[str] = None
    number_of_engines: Optional[int] = 2
    passenger_capacity: Optional[int] = None
    
    # Weights in kg
    oew_kg: Optional[float] = Field(default=None, description="Operating Empty Weight (kg)")
    mtow_kg: Optional[float] = Field(default=None, description="Maximum Takeoff Weight (kg)")
    mlw_kg: Optional[float] = Field(default=None, description="Maximum Landing Weight (kg)")
    fuel_capacity_liters: Optional[float] = None
    
    # Performance
    cruise_speed_kts: Optional[int] = Field(default=None, description="Cruise speed in Knots TAS")
    max_speed_kts: Optional[int] = Field(default=None, description="Maximum operating speed in Knots TAS")
    nominal_range_nm: Optional[int] = Field(default=None, description="Nominal range in Nautical Miles")
    approach_speed_kts: Optional[int] = Field(default=None, description="Approach speed in Knots IAS")
    takeoff_field_length_m: Optional[int] = Field(default=None, description="Takeoff field length in meters")
    landing_field_length_m: Optional[int] = Field(default=None, description="Landing field length in meters")

class AircraftSpecificationListResponse(BaseModel):
    """Envelope for aircraft specifications query."""
    total: int
    specifications: List[AircraftSpecificationSchema]
