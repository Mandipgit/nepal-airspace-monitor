/**
 * Airport and Runway Domain Types
 * Matches backend FastAPI airport schemas
 */

export interface Runway {
  id: number;
  airport_ident: string;
  length_ft: number | null;
  width_ft: number | null;
  surface: string | null;
  lighted: boolean;
  closed: boolean;
  le_ident: string | null;
  he_ident: string | null;
  le_heading_degT: number | null;
  he_heading_degT: number | null;
}

export interface AirportSummary {
  ident: string;
  type: string | null;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  elevation_ft: number | null;
  continent: string | null;
  iso_country: string | null;
  iso_region: string | null;
  municipality: string | null;
  scheduled_service: boolean;
  gps_code: string | null;
  iata_code: string | null;
  local_code: string | null;
}

export interface AirportDetail extends AirportSummary {
  home_link: string | null;
  wikipedia_link: string | null;
  keywords: string | null;
  runways: Runway[];
}

export interface AirportListResponse {
  total: number;
  airports: AirportSummary[];
}
