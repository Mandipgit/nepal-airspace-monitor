"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User, LoginCredentials, RegisterData } from "@/types/auth";
import {
  loginApi,
  registerApi,
  getMeApi,
  refreshTokenApi,
  logoutApi,
} from "@/lib/authApi";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  isAuthModalOpen: boolean;
  modalMode: "login" | "register";
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  openAuthModal: (mode?: "login" | "register") => void;
  closeAuthModal: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"login" | "register">("login");

  // Validate stored tokens and hydrate user session
  const initializeAuth = useCallback(async () => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    // 1. Check if tokens were transferred via OAuth callback cookies
    const cookieAccessToken = getCookie("aerotrace_access_token");
    const cookieRefreshToken = getCookie("aerotrace_refresh_token");

    let savedAccessToken = localStorage.getItem("access_token");
    let savedRefreshToken = localStorage.getItem("refresh_token");

    if (cookieAccessToken) {
      savedAccessToken = cookieAccessToken;
      localStorage.setItem("access_token", cookieAccessToken);
      deleteCookie("aerotrace_access_token");

      if (cookieRefreshToken) {
        savedRefreshToken = cookieRefreshToken;
        localStorage.setItem("refresh_token", cookieRefreshToken);
        deleteCookie("aerotrace_refresh_token");
      }
    }

    if (!savedAccessToken) {
      setIsLoading(false);
      return;
    }

    try {
      // Validate access token with backend
      const userProfile = await getMeApi(savedAccessToken);
      setUser(userProfile);
      setToken(savedAccessToken);
      setRefreshToken(savedRefreshToken);
    } catch {
      // Access token may be expired; attempt refresh if refresh token exists
      if (savedRefreshToken) {
        try {
          const res = await refreshTokenApi(savedRefreshToken);
          localStorage.setItem("access_token", res.access_token);
          if (res.refresh_token) {
            localStorage.setItem("refresh_token", res.refresh_token);
            setRefreshToken(res.refresh_token);
          }
          setToken(res.access_token);
          setUser(res.user);
        } catch {
          // Both tokens invalid; clear state
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          setUser(null);
          setToken(null);
          setRefreshToken(null);
        }
      } else {
        localStorage.removeItem("access_token");
        setUser(null);
        setToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = async (credentials: LoginCredentials) => {
    setAuthError(null);
    try {
      const res = await loginApi(credentials);
      localStorage.setItem("access_token", res.access_token);
      if (res.refresh_token) {
        localStorage.setItem("refresh_token", res.refresh_token);
        setRefreshToken(res.refresh_token);
      }
      setToken(res.access_token);
      setUser(res.user);
      setIsAuthModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to log in.";
      setAuthError(msg);
      throw err;
    }
  };

  const register = async (data: RegisterData) => {
    setAuthError(null);
    try {
      const res = await registerApi(data);
      localStorage.setItem("access_token", res.access_token);
      if (res.refresh_token) {
        localStorage.setItem("refresh_token", res.refresh_token);
        setRefreshToken(res.refresh_token);
      }
      setToken(res.access_token);
      setUser(res.user);
      setIsAuthModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create account.";
      setAuthError(msg);
      throw err;
    }
  };

  const logout = async () => {
    const currentToken = token || localStorage.getItem("access_token");
    const currentRefreshToken = refreshToken || localStorage.getItem("refresh_token");

    // Clear local state immediately for snappy UX
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    setAuthError(null);

    // Revoke refresh token on backend
    await logoutApi(currentToken, currentRefreshToken);
  };

  const openAuthModal = (mode: "login" | "register" = "login") => {
    setModalMode(mode);
    setAuthError(null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthError(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        authError,
        isAuthModalOpen,
        modalMode,
        login,
        register,
        logout,
        openAuthModal,
        closeAuthModal,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
