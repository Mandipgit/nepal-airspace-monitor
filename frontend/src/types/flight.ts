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
}

export interface FlightRoute {
  origin_icao: string | null;
  origin_iata: string | null;
  destination_icao: string | null;
  destination_iata: string | null;
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
  mtow_kg?: number;
  mlw_kg?: number;
  cruise_speed_kts?: number;
  max_speed_kts?: number;
  nominal_range_nm?: number;
  approach_speed_kts?: number;
  takeoff_field_length_m?: number;
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
  last_contact: string | null;
  data_freshness_seconds: number | null;
}

export interface FlightCollectionResponse {
  total: number;
  timestamp: string;
  cached: boolean;
  cache_age_seconds: number | null;
  flights: NormalizedFlight[];
}
