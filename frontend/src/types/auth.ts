/**
 * Authentication Types & Models
 * Strictly matches FastAPI backend authentication schemas.
 */

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface AuthError {
  message: string;
  status?: number;
  details?: unknown;
}
