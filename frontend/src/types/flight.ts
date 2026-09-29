/**
 * Normalized Flight Domain Types
 * Matches backend FastAPI NormalizedFlight model
 */

export interface FlightIdentification {
  icao24: string;
  callsign: string | null;
  flight_number: string | null;
  registration: string | null;
  aircraft_type_icao: string | null;
  operator_icao: string | null;
  operator_name: string | null;
  origin_country: string | null;
  is_nepal_registered: boolean;
  squawk: string | null;
  category: number | null;
  category_name: string | null;
  position_source: string | null;
  spi: boolean | null;
}

export interface FlightPosition {
  latitude: number | null;
  longitude: number | null;
  altitude_baro_m: number | null;
  altitude_geo_m: number | null;
  groundspeed_mps: number | null;
  heading_deg: number | null;
  vertical_rate_mps: number | null;
  on_ground: boolean;
  timestamp: string | null;
  altitude_baro_ft?: number | null;
  groundspeed_kts?: number | null;
  vertical_rate_fpm?: number | null;
}

export interface FlightRoute {
  origin_icao: string | null;
  origin_iata: string | null;
  origin_name?: string | null;
  destination_icao: string | null;
  destination_iata: string | null;
  destination_name?: string | null;
}

export interface AircraftSpec {
  id?: number;
  model: string;
  icao_type: string;
  category?: string;
  engine_type?: string;
  engine_model?: string;
  number_of_engines?: number;
  passenger_capacity?: number;
  oew_kg?: number;
  owe?: number;
  mtow_kg?: number;
  mtow?: number;
  mlw_kg?: number;
  mlw?: number;
  fuel_capacity_liters?: number;
  max_fuel?: number;
  cruise_speed_kts?: number;
  max_speed_kts?: number;
  cruise_altitude?: number;
  nominal_range_nm?: number;
  approach_speed_kts?: number;
  takeoff_field_length_m?: number;
  landing_field_length_m?: number;

  // Dimensions & Geometry (m, deg, m2)
  fuselage_width?: number;
  wing_span?: number;
  wing_sweep25?: number;
  wing_area?: number;
  wing_position?: string;
  htp_area?: number;
  vtp_area?: number;
  total_length?: number;
  total_height?: number;

  // Propulsion & Engines
  thruster_type?: string;
  powerplant?: string;
  bpr?: number;
  energy_type?: string;
  engine_position?: string;
  engine_y_arm?: number;
  rotor_diameter?: number;
  max_power?: number;
  max_power_2?: number;
  max_thrust?: number;
  n_engine?: number;
}

export interface NepalAircraft {
  id?: number;
  icao24: string;
  registration?: string | null;
  typecode?: string | null;
  model?: string | null;
  aircraft_type?: string | null;
  manufacturer_name?: string | null;
  manufacturer_icao?: string | null;
  operator?: string | null;
  operator_callsign?: string | null;
  operator_icao?: string | null;
  operator_iata?: string | null;
  owner?: string | null;
  serial_number?: string | null;
  icao_aircraft_class?: string | null;
  category_description?: string | null;
  country?: string | null;
  engines?: string | null;
  built_year?: string | null;
  first_flight_date?: string | null;
  registered_date?: string | null;
  reg_until?: string | null;
  status?: string | null;
  modes?: boolean;
  adsb?: boolean;
  acars?: boolean;
  vdl?: boolean;
  notes?: string | null;
  sel_cal?: string | null;
  [key: string]: any;
}

export interface NormalizedFlight {
  id: string;
  provider: string;
  identification: FlightIdentification;
  position: FlightPosition;
  route: FlightRoute | null;
  nearest_airport: string | null;
  nearest_airport_distance_km: number | null;
  aircraft_spec: AircraftSpec | null;
  nepal_aircraft?: NepalAircraft | null;
  last_contact: string | null;
  data_freshness_seconds: number | null;
}

export interface FlightCollectionResponse {
  total: number;
  timestamp: string;
  cached: boolean;
  cache_age_seconds: number | null;
  rate_limit_remaining?: number | null;
  flights: NormalizedFlight[];
}

export interface TrajectoryPoint {
  latitude: number;
  longitude: number;
  altitude_ft: number | null;
  groundspeed_kts: number | null;
  heading_deg: number | null;
  timestamp: string;
}

export interface FlightTrajectoryResponse {
  icao24: string;
  callsign: string | null;
  total_points: number;
  points: TrajectoryPoint[];
}

export function createNormalizedFlightFromNepalAircraft(ac: NepalAircraft): NormalizedFlight {
  return {
    id: `nepal-${ac.registration || ac.icao24}`,
    provider: "nepal_registry",
    identification: {
      icao24: (ac.icao24 || "").toLowerCase(),
      callsign: ac.registration || ac.operator_callsign || null,
      flight_number: null,
      registration: ac.registration || null,
      aircraft_type_icao: ac.typecode || null,
      operator_icao: ac.operator_icao || null,
      operator_name: ac.operator || null,
      origin_country: "Nepal",
      is_nepal_registered: true,
      squawk: null,
      category: null,
      category_name: ac.icao_aircraft_class || "Civil Aircraft",
      position_source: "CAAN Registry",
      spi: false,
    },
    position: {
      latitude: null,
      longitude: null,
      altitude_baro_m: null,
      altitude_geo_m: null,
      groundspeed_mps: null,
      heading_deg: null,
      vertical_rate_mps: null,
      on_ground: true,
      timestamp: new Date().toISOString(),
      altitude_baro_ft: null,
      groundspeed_kts: null,
      vertical_rate_fpm: null,
    },
    route: null,
    nearest_airport: null,
    nearest_airport_distance_km: null,
    aircraft_spec: ac.specification || null,
    nepal_aircraft: ac,
    last_contact: null,
    data_freshness_seconds: 0,
  };
}

