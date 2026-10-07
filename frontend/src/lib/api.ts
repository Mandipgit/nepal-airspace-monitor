/**
 * Backend API Client
 * Connects frontend strictly to FastAPI backend. Never talks to external providers directly.
 */

import { FlightCollectionResponse, NormalizedFlight, AircraftSpec, FlightTrajectoryResponse, NepalAircraft } from "@/types/flight";
import { AirportListResponse, AirportDetail, Runway } from "@/types/airport";
import {
  RouteAircraftAnalysisRequest,
  RouteAircraftAnalysisResponse,
  RouteInformationResponse,
  AircraftSpecificationListResponse,
} from "@/types/routeAnalyzer";
import { parseApiResponseError } from "@/lib/errors";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

// In-memory cache for static route distance/runway lookups (keyed by DEP:DEST)
const routeInfoCache = new Map<string, RouteInformationResponse>();

/**
 * Returns authorization headers with active Bearer token.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

/**
 * Robust fetch wrapper that automatically injects JWT Bearer tokens.
 */
async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders,
    ...(options.headers || {}),
  };

  return await fetch(url, { ...options, headers });
}

export interface FetchLiveFlightsOptions {
  nepalOnly?: boolean;
  nepalContextOnly?: boolean;
  filterGround?: boolean;
  source?: string;
  provider?: "opensky" | "flightaware";
  enriched?: boolean;
  lamin?: number;
  lomin?: number;
  lamax?: number;
  lomax?: number;
}

export async function fetchLiveFlights(
  options: FetchLiveFlightsOptions = {},
  signal?: AbortSignal
): Promise<FlightCollectionResponse> {
  const {
    nepalOnly = false,
    nepalContextOnly,
    filterGround = false,
    source,
    provider,
    enriched = true,
    lamin,
    lomin,
    lamax,
    lomax,
  } = options;
  const params = new URLSearchParams();
  if (nepalOnly) params.append("nepal_only", "true");
  if (nepalContextOnly !== undefined) {
    params.append("nepal_context_only", nepalContextOnly ? "true" : "false");
  }
  if (filterGround) params.append("filter_ground", "true");
  if (source) params.append("source", source);
  if (provider) params.append("provider", provider);
  if (enriched) params.append("enriched", "true");
  if (lamin !== undefined) params.append("lamin", lamin.toFixed(4));
  if (lomin !== undefined) params.append("lomin", lomin.toFixed(4));
  if (lamax !== undefined) params.append("lamax", lamax.toFixed(4));
  if (lomax !== undefined) params.append("lomax", lomax.toFixed(4));

  const url = `${API_BASE_URL}/flights/live?${params.toString()}`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "live_flights");
  }

  return res.json();
}

export async function fetchFlightById(id: string): Promise<NormalizedFlight> {
  const url = `${API_BASE_URL}/flights/${encodeURIComponent(id)}`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "flight_details");
  }

  return res.json();
}

export async function fetchFlightTrajectory(icao24: string): Promise<FlightTrajectoryResponse> {
  const url = `${API_BASE_URL}/flights/${encodeURIComponent(icao24.toLowerCase())}/trajectory`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "trajectory");
  }

  return res.json();
}

export async function fetchNepalAirports(): Promise<AirportListResponse> {
  const url = `${API_BASE_URL}/airports/nepal`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "airports");
  }

  return res.json();
}

export async function fetchAirportDetail(ident: string): Promise<AirportDetail> {
  const url = `${API_BASE_URL}/airports/${encodeURIComponent(ident)}`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "airports");
  }

  return res.json();
}

export async function fetchAirportRunways(ident: string): Promise<Runway[]> {
  const url = `${API_BASE_URL}/airports/${encodeURIComponent(ident)}/runways`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "airports");
  }

  return res.json();
}

export async function fetchAircraftSpec(identifier: string): Promise<AircraftSpec> {
  const url = `${API_BASE_URL}/aircraft/${encodeURIComponent(identifier)}`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "aircraft_specs");
  }

  return res.json();
}

export async function checkBackendHealth(): Promise<{ status: string; uptime_seconds?: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    if (res.ok) return await res.json();
    return { status: "degraded" };
  } catch {
    return { status: "offline" };
  }
}

/**
 * Fetch available aircraft specifications with optional query & category filter.
 * Defaults to retrieving up to 300 models to cover complete commercial and regional fleet.
 */
export async function fetchAircraftList(options: {
  query?: string;
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AircraftSpecificationListResponse> {
  const { query, category, limit = 200, offset = 0 } = options;
  const params = new URLSearchParams();
  if (query) params.append("query", query);
  if (category && category !== "all") params.append("category", category);
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());

  const url = `${API_BASE_URL}/aircraft?${params.toString()}`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "aircraft_specs");
  }

  return res.json();
}

/**
 * Fetch route distance, departure runway, and destination runway specifications.
 * Uses in-memory caching to avoid redundant requests for the same airport pair.
 */
export async function fetchRouteInformation(
  departure: string,
  destination: string
): Promise<RouteInformationResponse> {
  const cacheKey = `${departure.trim().toUpperCase()}:${destination.trim().toUpperCase()}`;
  if (routeInfoCache.has(cacheKey)) {
    return routeInfoCache.get(cacheKey)!;
  }

  const params = new URLSearchParams({
    departure_ident: departure.trim(),
    destination_ident: destination.trim(),
  });

  const url = `${API_BASE_URL}/route-analyzer/route?${params.toString()}`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "route_analyzer");
  }

  const data: RouteInformationResponse = await res.json();
  routeInfoCache.set(cacheKey, data);
  return data;
}

/**
 * Execute analytical suitability comparison for a selected route and aircraft set.
 */
export async function analyzeRouteAircraft(
  request: RouteAircraftAnalysisRequest
): Promise<RouteAircraftAnalysisResponse> {
  const url = `${API_BASE_URL}/route-analyzer/analyze`;
  const res = await authenticatedFetch(url, {
    method: "POST",
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "route_analyzer");
  }

  return res.json();
}

/**
 * Clear route info cache (useful when resetting inputs or reloading).
 */
export function clearRouteInfoCache(): void {
  routeInfoCache.clear();
}

export interface NepalAircraftListResponse {
  total: number;
  aircraft: NepalAircraft[];
}

/**
 * Fetch civil aircraft registered in Nepal from the database.
 * Supports filtering by search query (registration, model, icao24), operator, and typecode.
 */
export async function fetchNepalAircraftFleet(options: {
  query?: string;
  operator?: string;
  typecode?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<NepalAircraftListResponse> {
  const { query, operator, typecode, limit = 100, offset = 0 } = options;
  const params = new URLSearchParams();
  if (query && query.trim()) params.append("query", query.trim());
  if (operator && operator !== "all") params.append("operator", operator);
  if (typecode && typecode !== "all") params.append("typecode", typecode);
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());

  const url = `${API_BASE_URL}/aircraft/nepal/fleet?${params.toString()}`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "nepal_fleet");
  }

  return res.json();
}

/**
 * Retrieve single Nepal registered aircraft by registration mark (e.g. '9N-AOH')
 * or Mode-S icao24 hex ('70a8e5') with its linked engineering specifications.
 */
export async function fetchNepalAircraftDetail(identifier: string): Promise<NepalAircraft> {
  const url = `${API_BASE_URL}/aircraft/nepal/${encodeURIComponent(identifier.trim())}`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "nepal_aircraft_detail");
  }

  return res.json();
}

/**
 * Official ICAO Phonetic Alphabet contract
 */
export interface IcaoPhoneticItem {
  letter: string;
  phonetic: string;
  morse_code?: string | null;
  pronunciation?: string | null;
}

export interface IcaoPhoneticResponse {
  total: number;
  alphabet: IcaoPhoneticItem[];
}

/**
 * Retrieve official ICAO phonetic alphabet data from the backend database.
 * Returns all 26 entries (A through Z) in alphabetical order.
 */
export async function fetchIcaoPhoneticAlphabet(): Promise<IcaoPhoneticResponse> {
  const url = `${API_BASE_URL}/icao/phonetic`;
  const res = await authenticatedFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseApiResponseError(res, "icao_phonetic");
  }

  return res.json();
}


