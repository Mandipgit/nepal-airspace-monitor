/**
 * Route Aircraft Analyzer Domain Types
 * Matches backend FastAPI schemas from app.schemas.route_analyzer and app.schemas.aircraft
 */

import { Runway } from "./airport";

export interface AirportRoutePoint {
  ident: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation_ft?: number | null;
  municipality?: string | null;
}

export interface RouteInfo {
  departure: AirportRoutePoint;
  destination: AirportRoutePoint;
  distance_km: number;
}

export interface AnalysisConditions {
  wind_kmh: number;
  descent_distance_km: number;
}

export interface AirportRunwayAnalysisInfo {
  runway_length_m: number;
  runway_length_ft?: number | null;
  runway_width_m?: number | null;
  runway_width_ft?: number | null;
  selection_method: string;
  runway_ident?: string | null;
  surface?: string | null;
  lighted: boolean;
  closed: boolean;
  le_ident?: string | null;
  le_heading_degt?: number | null;
  le_elevation_ft?: number | null;
  le_displaced_threshold_ft?: number | null;
  he_ident?: string | null;
  he_heading_degt?: number | null;
  he_elevation_ft?: number | null;
  he_displaced_threshold_ft?: number | null;
  all_runways?: Runway[];
}

export interface AircraftAnalysisResult {
  aircraft_identifier: string;
  aircraft_name: string;
  passenger_capacity?: number | null;
  cruise_speed_kmh?: number | null;
  approach_speed?: number | null;
  nominal_range_km?: number | null;
  estimated_flight_time_min?: number | null;
  range_margin_km?: number | null;
  takeoff_runway_margin_m?: number | null;
  landing_runway_margin_m?: number | null;
  within_calculated_limits: boolean;
  analysis_status: "within_calculated_limits" | "outside_calculated_limits" | "insufficient_ground_speed" | "missing_performance_data" | string;
  notes?: string | null;
}

export interface RouteAircraftAnalysisRequest {
  departure_ident: string;
  destination_ident: string;
  aircraft_identifiers: string[];
  wind_kmh?: number;
  descent_distance_km?: number;
}

export interface RouteAircraftAnalysisResponse {
  route: RouteInfo;
  conditions: AnalysisConditions;
  departure_runway?: AirportRunwayAnalysisInfo | null;
  destination_runway: AirportRunwayAnalysisInfo;
  departure_runways: Runway[];
  destination_runways: Runway[];
  results: AircraftAnalysisResult[];
  missing_aircraft: string[];
  disclaimer: string;
}

export interface RouteInformationResponse {
  route: RouteInfo;
  departure_runway: AirportRunwayAnalysisInfo;
  destination_runway: AirportRunwayAnalysisInfo;
  departure_runways: Runway[];
  destination_runways: Runway[];
}

export interface AircraftSpecification {
  id: number;
  model: string;
  icao_type: string;
  category?: string | null;
  engine_type?: string | null;
  engine_model?: string | null;
  number_of_engines?: number | null;
  passenger_capacity?: number | null;
  oew_kg?: number | null;
  owe?: number | null;
  mtow_kg?: number | null;
  mtow?: number | null;
  mlw_kg?: number | null;
  mlw?: number | null;
  fuel_capacity_liters?: number | null;
  max_fuel?: number | null;
  cruise_speed_kts?: number | null;
  max_speed_kts?: number | null;
  cruise_altitude?: number | null;
  nominal_range_nm?: number | null;
  approach_speed_kts?: number | null;
  takeoff_field_length_m?: number | null;
  landing_field_length_m?: number | null;

  // Dimensions & Geometry (m, deg, m2)
  fuselage_width?: number | null;
  wing_span?: number | null;
  wing_sweep25?: number | null;
  wing_area?: number | null;
  wing_position?: string | null;
  htp_area?: number | null;
  vtp_area?: number | null;
  total_length?: number | null;
  total_height?: number | null;

  // Propulsion & Engines
  thruster_type?: string | null;
  powerplant?: string | null;
  bpr?: number | null;
  energy_type?: string | null;
  engine_position?: string | null;
  engine_y_arm?: number | null;
  rotor_diameter?: number | null;
  max_power?: number | null;
  max_power_2?: number | null;
  max_thrust?: number | null;
  n_engine?: number | null;
}

export interface AircraftSpecificationListResponse {
  total: number;
  specifications: AircraftSpecification[];
}
