/**
 * Backend Authentication API Client
 * Connects frontend directly to FastAPI authentication endpoints.
 */

import {
  TokenResponse,
  LoginCredentials,
  RegisterData,
  User,
} from "@/types/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

import { resolveUserFacingMessage } from "@/lib/errors";

/**
 * Parse server error responses cleanly into user-friendly messages.
 */
async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const data = await res.json();

    // 1. Pydantic validation errors (HTTP 422)
    if (data.detail && Array.isArray(data.detail)) {
      const messages = data.detail.map((d: { msg?: string; loc?: string[] }) => {
        let msg = d.msg || "Invalid field";
        // Clean up common Pydantic prefix
        msg = msg.replace(/^Value error,\s*/i, "");
        const field = d.loc && d.loc.length > 1 ? d.loc[d.loc.length - 1] : "";
        if (field && !msg.toLowerCase().includes(field.toLowerCase())) {
          const formattedField = field.replace(/_/g, " ");
          return `${formattedField.charAt(0).toUpperCase() + formattedField.slice(1)}: ${msg}`;
        }
        return msg;
      });
      return messages.join(". ");
    }

    // 2. Structured AppError / ProviderError / RateLimitError
    if (data.error && typeof data.error === "object") {
      return resolveUserFacingMessage(
        res.status,
        data.error.type,
        data.error.message,
        data.error.details,
        "auth"
      );
    }

    // 3. FastAPI standard detail string
    if (typeof data.detail === "string" && data.detail.trim().length > 0) {
      // Check if detail contains technical exception or DB message
      const lower = data.detail.toLowerCase();
      if (
        lower.includes("postgres") ||
        lower.includes("supabase") ||
        lower.includes("error:") ||
        lower.includes("exception") ||
        lower.includes("traceback")
      ) {
        return resolveUserFacingMessage(res.status, undefined, data.detail, undefined, "auth");
      }
      return data.detail;
    }

    if (typeof data.message === "string" && data.message.trim().length > 0) {
      return resolveUserFacingMessage(res.status, undefined, data.message, undefined, "auth");
    }
  } catch {
    // Response was not JSON
  }

  // Fallback status codes
  switch (res.status) {
    case 400:
      return "Invalid request. Please verify your inputs.";
    case 401:
      return "Invalid email or password.";
    case 403:
      return "Access denied. Your account does not have permission.";
    case 404:
      return "Authentication service endpoint not found.";
    case 409:
      return "An account with this email address already exists.";
    case 422:
      return "Please correct the form fields and try again.";
    case 500:
    case 502:
    case 503:
      return "Authentication service is temporarily unavailable. Please try again shortly.";
    default:
      return `Authentication failed (Status ${res.status}).`;
  }
}

/**
 * Register a new user account.
 */
export async function registerApi(data: RegisterData): Promise<TokenResponse> {
  const url = `${API_BASE_URL}/auth/register`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
    }),
  });

  if (!res.ok) {
    const errorMsg = await parseErrorResponse(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

/**
 * Authenticate existing user with email and password.
 */
export async function loginApi(credentials: LoginCredentials): Promise<TokenResponse> {
  const url = `${API_BASE_URL}/auth/login`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    }),
  });

  if (!res.ok) {
    const errorMsg = await parseErrorResponse(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

/**
 * Fetch current authenticated user profile using Bearer JWT.
 */
export async function getMeApi(token: string): Promise<User> {
  const url = `${API_BASE_URL}/auth/me`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorMsg = await parseErrorResponse(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

/**
 * Refresh access token using active refresh token.
 */
export async function refreshTokenApi(refreshToken: string): Promise<TokenResponse> {
  const url = `${API_BASE_URL}/auth/refresh`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errorMsg = await parseErrorResponse(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

/**
 * Verify Google OAuth session from Supabase with backend and obtain AeroTrace JWT tokens.
 */
export async function verifyGoogleSessionApi(
  supabaseToken: string,
  firstName?: string,
  lastName?: string
): Promise<TokenResponse> {
  const url = `${API_BASE_URL}/auth/google/verify`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      supabase_token: supabaseToken,
      first_name: firstName?.trim() || undefined,
      last_name: lastName?.trim() || undefined,
    }),
  });

  if (!res.ok) {
    const errorMsg = await parseErrorResponse(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

/**
 * Logout and revoke active refresh token on backend.
 */
export async function logoutApi(token?: string | null, refreshToken?: string | null): Promise<void> {
  const url = `${API_BASE_URL}/auth/logout`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        refresh_token: refreshToken || "",
      }),
    });
  } catch (err) {
    // Non-blocking logout network error
    console.warn("Server logout notification failed:", err);
  }
}

