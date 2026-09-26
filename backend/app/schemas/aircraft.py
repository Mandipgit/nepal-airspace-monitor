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
    owe: Optional[float] = Field(default=None, description="Operating Empty Weight alias (kg)")
    mtow_kg: Optional[float] = Field(default=None, description="Maximum Takeoff Weight (kg)")
    mtow: Optional[float] = Field(default=None, description="Maximum Takeoff Weight alias (kg)")
    mlw_kg: Optional[float] = Field(default=None, description="Maximum Landing Weight (kg)")
    mlw: Optional[float] = Field(default=None, description="Maximum Landing Weight alias (kg)")
    fuel_capacity_liters: Optional[float] = Field(default=None, description="Fuel capacity in liters")
    max_fuel: Optional[float] = Field(default=None, description="Maximum fuel capacity (kg)")

    # Dimensions & Geometry (m, deg, m2)
    fuselage_width: Optional[float] = Field(default=None, description="Fuselage outer width in meters (m)")
    wing_span: Optional[float] = Field(default=None, description="Wing span in meters (m)")
    wing_sweep25: Optional[float] = Field(default=None, description="Wing sweep at 25% chord in degrees (deg)")
    wing_area: Optional[float] = Field(default=None, description="Wing reference area in square meters (m2)")
    wing_position: Optional[str] = Field(default=None, description="Wing position relative to fuselage ('low', 'high')")
    htp_area: Optional[float] = Field(default=None, description="Horizontal tailplane area in square meters (m2)")
    vtp_area: Optional[float] = Field(default=None, description="Vertical tailplane area in square meters (m2)")
    total_length: Optional[float] = Field(default=None, description="Total aircraft length in meters (m)")
    total_height: Optional[float] = Field(default=None, description="Total aircraft height in meters (m)")

    # Propulsion & Engine Details
    thruster_type: Optional[str] = Field(default=None, description="Thruster mechanism ('propeller', 'turbofan')")
    powerplant: Optional[str] = Field(default=None, description="Powerplant model designation")
    bpr: Optional[float] = Field(default=None, description="Engine bypass ratio (dimensionless)")
    energy_type: Optional[str] = Field(default=None, description="Energy/fuel source ('gasoline', 'kerosene')")
    engine_position: Optional[str] = Field(default=None, description="Engine mounting position ('wing', 'fuselage')")
    engine_y_arm: Optional[float] = Field(default=None, description="Engine lateral moment arm in meters (m)")
    rotor_diameter: Optional[float] = Field(default=None, description="Propeller/rotor diameter in meters (m)")
    max_power: Optional[float] = Field(default=None, description="Maximum engine power in kilowatts (kW)")
    max_power_2: Optional[float] = Field(default=None, description="Secondary maximum engine power in kilowatts (kW)")
    max_thrust: Optional[float] = Field(default=None, description="Maximum takeoff thrust in Newtons (N)")
    n_engine: Optional[int] = Field(default=None, description="Engine count alias")
    
    # Performance & Speeds
    cruise_speed_kts: Optional[int] = Field(default=None, description="Cruise speed in Knots TAS")
    max_speed_kts: Optional[int] = Field(default=None, description="Maximum operating speed in Knots TAS")
    cruise_altitude: Optional[float] = Field(default=None, description="Design cruise altitude")
    nominal_range_nm: Optional[int] = Field(default=None, description="Nominal range in Nautical Miles")
    approach_speed_kts: Optional[int] = Field(default=None, description="Approach speed in Knots IAS")
    takeoff_field_length_m: Optional[int] = Field(default=None, description="Takeoff field length in meters")
    landing_field_length_m: Optional[int] = Field(default=None, description="Landing field length in meters")

class AircraftSpecificationListResponse(BaseModel):
    """Envelope for aircraft specifications query."""
    total: int
    specifications: List[AircraftSpecificationSchema]


class NepalAircraftSchema(BaseModel):
    """Nepal registered aircraft schema (sourced from CAAN/OpenSky dataset)."""
    id: Optional[int] = None
    icao24: str = Field(description="24-bit Mode-S transponder hex address (e.g. '70a00d')")
    registration: Optional[str] = Field(default=None, description="Nepalese tail registration (e.g. '9N-AIH')")
    typecode: Optional[str] = Field(default=None, description="ICAO type designator (e.g. 'AT75', 'DH8D')")
    model: Optional[str] = Field(default=None, description="Aircraft model name")
    manufacturer_name: Optional[str] = None
    manufacturer_icao: Optional[str] = None
    operator: Optional[str] = Field(default=None, description="Airline or operator")
    operator_callsign: Optional[str] = None
    operator_icao: Optional[str] = None
    operator_iata: Optional[str] = None
    owner: Optional[str] = None
    serial_number: Optional[str] = None
    icao_aircraft_class: Optional[str] = None
    category_description: Optional[str] = None
    country: Optional[str] = "Nepal"
    engines: Optional[str] = None
    built_year: Optional[str] = None
    first_flight_date: Optional[str] = None
    registered_date: Optional[str] = None
    reg_until: Optional[str] = None
    status: Optional[str] = None
    modes: Optional[bool] = False
    adsb: Optional[bool] = False
    acars: Optional[bool] = False
    vdl: Optional[bool] = False
    notes: Optional[str] = None
    sel_cal: Optional[str] = None


class NepalAircraftSpecificationJunctionSchema(BaseModel):
    """Junction table entry linking a Nepal aircraft to an aircraft specification."""
    id: Optional[int] = None
    nepal_aircraft_id: int
    specification_id: int
    match_method: str = Field(description="Match strategy: exact_typecode, iata_mapping, model_variant")
    match_confidence: float = Field(default=1.00, description="Match confidence score")
    is_primary: bool = Field(default=True, description="Whether this is the primary airframe specification")
    notes: Optional[str] = None


class NepalAircraftDetailSchema(NepalAircraftSchema):
    """Nepal registered aircraft with linked specifications from junction table."""
    specification: Optional[AircraftSpecificationSchema] = Field(default=None, description="Primary linked specification")
    specifications: List[AircraftSpecificationSchema] = Field(default_factory=list, description="All matching specifications")
    junction_links: List[NepalAircraftSpecificationJunctionSchema] = Field(default_factory=list, description="Junction metadata")


class NepalAircraftListResponse(BaseModel):
    """Envelope response for Nepal registered fleet query."""
    total: int
    aircraft: List[NepalAircraftDetailSchema]

