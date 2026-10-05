/**
 * User-Facing Error Handling Layer
 * 
 * Converts raw backend, server, provider, database, and network errors into
 * clean, concise, human-readable messages for end users.
 * 
 * Technical error details, raw HTTP status codes, and exception objects are
 * preserved for developer debugging in the browser console.
 */

export type ErrorContext =
  | "live_flights"
  | "flight_details"
  | "trajectory"
  | "airports"
  | "aircraft_specs"
  | "nepal_fleet"
  | "nepal_aircraft_detail"
  | "route_analyzer"
  | "auth"
  | "general";

export interface ApiErrorPayload {
  error?: {
    type?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
  detail?: string | Array<{ msg?: string; loc?: string[] }>;
  message?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly errorType?: string;
  public readonly technicalMessage?: string;
  public readonly details?: Record<string, unknown>;
  public readonly context: ErrorContext;

  constructor(
    userFacingMessage: string,
    options: {
      status: number;
      errorType?: string;
      technicalMessage?: string;
      details?: Record<string, unknown>;
      context?: ErrorContext;
    }
  ) {
    super(userFacingMessage);
    this.name = "ApiError";
    this.status = options.status;
    this.errorType = options.errorType;
    this.technicalMessage = options.technicalMessage;
    this.details = options.details;
    this.context = options.context || "general";

    // Maintains proper stack trace for where error was thrown (V8 / modern JS)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Extracts human-readable user message based on HTTP status, provider error type,
 * context, and optional retry parameters.
 */
export function resolveUserFacingMessage(
  status: number,
  errorType?: string,
  technicalMessage?: string,
  details?: Record<string, unknown>,
  context: ErrorContext = "general"
): string {
  const techLower = (technicalMessage || "").toLowerCase();

  // 1. Rate-Limit Errors (HTTP 429 or RateLimitError)
  if (status === 429 || errorType === "RateLimitError" || techLower.includes("rate limit") || techLower.includes("429")) {
    let retrySec: number | undefined;
    const rawRetry = details?.retry_after;
    if (typeof rawRetry === "number") {
      retrySec = rawRetry;
    } else if (typeof rawRetry === "string") {
      const parsed = parseInt(rawRetry, 10);
      if (!isNaN(parsed)) retrySec = parsed;
    }
    if (!retrySec) {
      const match = techLower.match(/retry after (\d+)/);
      if (match) retrySec = parseInt(match[1], 10);
    }

    if (typeof retrySec === "number" && retrySec > 0) {
      if (retrySec > 120) {
        const minutes = Math.ceil(retrySec / 60);
        return `Live flight updates are temporarily rate-limited due to high traffic. Service resumes in ~${minutes} min.`;
      }
      return `Live flight updates are temporarily rate-limited. Resuming in ${retrySec} seconds.`;
    }

    switch (context) {
      case "live_flights":
        return "Live flight data is temporarily rate-limited due to high traffic. Please try again shortly.";
      case "route_analyzer":
        return "Analysis request limit reached. Please wait a moment before trying again.";
      case "nepal_fleet":
      case "nepal_aircraft_detail":
        return "Nepal aircraft registry is temporarily rate-limited. Please try again shortly.";
      case "auth":
        return "Too many attempts. Please wait a few minutes before trying again.";
      default:
    }
  }

  // 2. Provider / Upstream Feed Failures (502, 503, 504 or ProviderError)
  if (
    status === 502 ||
    status === 504 ||
    errorType === "ProviderError" ||
    techLower.includes("provider") ||
    techLower.includes("bad gateway") ||
    techLower.includes("gateway timeout")
  ) {
    switch (context) {
      case "live_flights":
        return "Airspace radar feed is temporarily delayed from the upstream provider. Retrying connection...";
      case "trajectory":
        return "Flight trajectory data is temporarily unavailable from the radar feed.";
      case "airports":
        return "Airport information service is temporarily unavailable. Please try again shortly.";
      case "route_analyzer":
        return "Upstream aviation calculations are momentarily unavailable. Please try again shortly.";
      case "nepal_fleet":
      case "nepal_aircraft_detail":
        return "Civil aviation registry service is temporarily unavailable. Please try again shortly.";
      default:
        return "External aviation feed is temporarily unavailable. Please try again shortly.";
    }
  }

  // 3. Database Failures (Supabase / PostgreSQL / PostgREST)
  if (
    techLower.includes("supabase") ||
    techLower.includes("postgres") ||
    techLower.includes("postgrest") ||
    techLower.includes("database") ||
    techLower.includes("connection pool") ||
    techLower.includes("pg_")
  ) {
    switch (context) {
      case "aircraft_specs":
        return "Aviation database specifications are temporarily unavailable.";
      case "airports":
        return "Airport database is momentarily unavailable. Please try again shortly.";
      case "nepal_fleet":
      case "nepal_aircraft_detail":
        return "Civil aviation registry database is momentarily unavailable. Please try again shortly.";
      case "auth":
        return "Account service database is temporarily unavailable. Please try again later.";
      default:
        return "Aviation database is momentarily unavailable. Please try again shortly.";
    }
  }

  // 4. Authentication & Authorization Errors (401, 403)
  if (status === 401) {
    return context === "auth"
      ? "Invalid email or password. Please check your credentials."
      : "Your session has expired. Please sign in again.";
  }
  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  // 5. Not-Found Errors (404 / FlightNotFoundError)
  if (status === 404 || errorType === "FlightNotFoundError") {
    switch (context) {
      case "live_flights":
      case "flight_details":
        return "The requested flight is no longer active in the current airspace.";
      case "trajectory":
        return "No radar track history is available for this flight.";
      case "airports":
        return "Airport could not be found.";
      case "route_analyzer":
        return "Route information could not be found for the selected airports.";
      case "nepal_fleet":
        return "No matching aircraft found in the Nepal civil aviation registry.";
      case "nepal_aircraft_detail":
        return "The requested aircraft could not be found in the Nepal civil aviation registry.";
      default:
        return "The requested aviation record could not be found.";
    }
  }

  // 6. Validation Errors (422)
  if (status === 422) {
    return "The request contained invalid parameters. Please check your inputs.";
  }

  // 7. General Server / Backend Errors (500)
  if (status === 500) {
    switch (context) {
      case "live_flights":
        return "The flight tracking service encountered a temporary error. Please try again shortly.";
      case "route_analyzer":
        return "Unable to complete route analysis right now. Please try again later.";
      case "airports":
        return "Unable to load airport database right now. Please try again shortly.";
      case "nepal_fleet":
      case "nepal_aircraft_detail":
        return "Unable to load Nepal civil aviation registry right now. Please try again shortly.";
      case "auth":
        return "Authentication service is temporarily unavailable. Please try again shortly.";
      default:
        return "A temporary server error occurred. Please try again shortly.";
    }
  }

  // 8. Bad Request (400)
  if (status === 400) {
    return "Invalid request. Please check your inputs and try again.";
  }

  // 9. Context-specific default fallbacks
  switch (context) {
    case "live_flights":
      return "Unable to load live flight data right now. Please try again later.";
    case "trajectory":
      return "Unable to load flight trajectory. Please try again later.";
    case "airports":
      return "Unable to load airport data right now. Please try again later.";
    case "aircraft_specs":
      return "Unable to load aircraft specifications right now.";
    case "route_analyzer":
      return "Route analysis could not be completed. Please try again.";
    case "nepal_fleet":
      return "Unable to load Nepal civil aircraft registry right now. Please try again later.";
    case "nepal_aircraft_detail":
      return "Unable to load Nepal aircraft details right now. Please try again later.";
    case "auth":
      return "Authentication failed. Please try again.";
    default:
      return "An unexpected error occurred. Please try again later.";
  }
}

/**
 * Parses a non-ok Response object, logs the technical debugging info to console,
 * and throws a clean ApiError with a user-facing message.
 */
export async function parseApiResponseError(
  res: Response,
  context: ErrorContext = "general"
): Promise<ApiError> {
  let technicalMessage = "";
  let errorType: string | undefined;
  let details: Record<string, unknown> | undefined;

  try {
    const rawText = await res.text();
    technicalMessage = rawText;

    try {
      const data: ApiErrorPayload = JSON.parse(rawText);
      if (data.error) {
        errorType = data.error.type;
        technicalMessage = data.error.message || technicalMessage;
        details = data.error.details;
      } else if (typeof data.detail === "string") {
        technicalMessage = data.detail;
      } else if (Array.isArray(data.detail)) {
        technicalMessage = data.detail.map((d) => d.msg || "").filter(Boolean).join("; ");
      } else if (typeof data.message === "string") {
        technicalMessage = data.message;
      }
    } catch {
      // Body is not JSON (e.g. plain text or HTML error page from proxy/gateway)
    }
  } catch {
    technicalMessage = `HTTP ${res.status} ${res.statusText}`;
  }

  // Developer logging: Preserves full technical details for debugging in browser console
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Aviation API Error] [${context}] HTTP ${res.status}:`, {
      status: res.status,
      url: res.url,
      errorType,
      technicalMessage,
      details,
    });
  }

  const userFacingMessage = resolveUserFacingMessage(
    res.status,
    errorType,
    technicalMessage,
    details,
    context
  );

  return new ApiError(userFacingMessage, {
    status: res.status,
    errorType,
    technicalMessage,
    details,
    context,
  });
}

/**
 * Converts ANY error (ApiError, TypeError from network failure, AbortError, string, or unknown)
 * into a guaranteed safe, human-readable user message.
 * 
 * Never leaks raw JSON, stack traces, provider names (e.g. opensky), or SQL details.
 */
export function getUserFriendlyErrorMessage(
  err: unknown,
  context: ErrorContext = "general"
): string {
  // If already an ApiError with clean user message, use it directly
  if (err instanceof ApiError) {
    return err.message;
  }

  const rawMsg = typeof err === "string" ? err : err instanceof Error ? err.message : "";
  const name = err instanceof Error ? err.name : "";
  const lower = rawMsg.toLowerCase();

  // 1. Timeout / Abort errors
  if (name === "AbortError" || lower.includes("aborted") || lower.includes("timeout")) {
    return "Request timed out while waiting for live data. Please try again.";
  }

  // 2. Network failures (fetch failed, offline, connection refused, DNS error)
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("connection refused") ||
    lower.includes("err_connection") ||
    lower.includes("load failed")
  ) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "You appear to be offline. Please check your internet connection.";
    }
    return context === "live_flights"
      ? "Unable to reach the flight tracking service. Retrying connection..."
      : "Unable to connect to the server. Please check your internet connection.";
  }

  // 3. Raw JSON or technical strings trapped in legacy Error messages
  // e.g. "Failed to fetch live flights (429): {"error":{"type":"RateLimitError",...}}"
  if (lower.includes("ratelimiterror") || lower.includes("rate limit") || lower.includes("(429)")) {
    return resolveUserFacingMessage(429, "RateLimitError", rawMsg, undefined, context);
  }
  if (lower.includes("providererror") || lower.includes("(502)") || lower.includes("(504)")) {
    return resolveUserFacingMessage(502, "ProviderError", rawMsg, undefined, context);
  }
  if (lower.includes("(500)") || lower.includes("internalservererror")) {
    return resolveUserFacingMessage(500, undefined, rawMsg, undefined, context);
  }
  if (lower.includes("(404)") || lower.includes("not found")) {
    return resolveUserFacingMessage(404, undefined, rawMsg, undefined, context);
  }
  if (lower.includes("(401)") || lower.includes("unauthorized")) {
    return resolveUserFacingMessage(401, undefined, rawMsg, undefined, context);
  }

  // 4. If message contains JSON error envelope or curly braces, sanitize completely
  if (rawMsg.includes("{\"") || rawMsg.includes("{\n") || rawMsg.includes("error\":")) {
    return resolveUserFacingMessage(500, undefined, undefined, undefined, context);
  }

  // 5. If message is already a clean, human-readable sentence (and not raw technical jargon)
  if (
    rawMsg.length > 0 &&
    rawMsg.length < 150 &&
    !/[{}[\]\\]/.test(rawMsg) &&
    !lower.includes("provider '") &&
    !lower.includes("http ") &&
    !lower.includes("status ")
  ) {
    return rawMsg;
  }

  // General safe fallback
  return resolveUserFacingMessage(500, undefined, undefined, undefined, context);
}
