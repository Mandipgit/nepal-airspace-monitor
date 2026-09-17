"use client";

import React from "react";
import { Radar, RefreshCw, Plane, ShieldCheck, Database, Activity, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface HeaderProps {
  totalFlights: number;
  nepalFlights: number;
  countdown: number;
  refreshing: boolean;
  onRefresh: () => void;
  cacheAge: number | null;
  rateLimitRemaining?: number | null;
}

export const Header: React.FC<HeaderProps> = ({
  totalFlights,
  nepalFlights,
  countdown,
  refreshing,
  onRefresh,
  cacheAge,
  rateLimitRemaining,
}) => {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  return (
    <header className="h-16 border-b border-white/8 bg-black/95 backdrop-blur-xl px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Radar Symbol */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white">
          <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: "8s" }} />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 radar-ping" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold tracking-wider text-neutral-100 uppercase font-mono-avionics">
              Nepal Airspace Monitor
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              LIVE
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 flex items-center gap-2">
            <span>FIR: VNKT (Kathmandu)</span>
            <span className="text-neutral-600">•</span>
            <span className="text-emerald-400/90 font-mono-avionics">26.3°N - 30.4°N / 80.0°E - 88.2°E</span>
          </p>
        </div>
      </div>

      {/* Metrics & Control Center */}
      <div className="flex items-center space-x-4">
        {/* Quick Stat Badges */}
        <div className="hidden sm:flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/8 text-xs">
            <Plane className="w-3.5 h-3.5 text-neutral-300" />
            <span className="text-neutral-400">Total:</span>
            <span className="font-bold text-neutral-100 font-mono-avionics">{totalFlights}</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-300/80">Nepal (9N):</span>
            <span className="font-bold text-emerald-300 font-mono-avionics">{nepalFlights}</span>
          </div>

          {rateLimitRemaining !== null && rateLimitRemaining !== undefined && (
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                rateLimitRemaining > 1000
                  ? "bg-neutral-900 border-white/8 text-neutral-300"
                  : rateLimitRemaining > 200
                  ? "bg-amber-950/40 border-amber-800/40 text-amber-300"
                  : "bg-rose-950/40 border-rose-800/40 text-rose-300"
              }`}
              title={`OpenSky Network API Credits: ${rateLimitRemaining.toLocaleString()} remaining (X-Rate-Limit-Remaining)`}
            >
              <Activity
                className={`w-3.5 h-3.5 ${
                  rateLimitRemaining > 1000
                    ? "text-neutral-300"
                    : rateLimitRemaining > 200
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              />
              <span className="text-neutral-400">API Quota:</span>
              <span className="font-bold font-mono-avionics text-neutral-100">
                {rateLimitRemaining.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/8 text-xs text-neutral-400">
            <Database className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-[11px]">Enriched</span>
          </div>
        </div>

        {/* Polling Countdown & Manual Refresh */}
        <div className="flex items-center space-x-2">
          <div className="text-right hidden md:block">
            <div className="text-[10px] uppercase font-semibold text-neutral-400">
              Refresh in <span className="text-white font-mono-avionics font-bold">{countdown}s</span>
            </div>
            {cacheAge !== null && (
              <div className="text-[9px] text-neutral-500 font-mono-avionics">
                Cache age: {Math.round(cacheAge)}s
              </div>
            )}
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh live flights now"
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-200 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-lg"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-white" : ""}`} />
          </button>
        </div>

        {/* User Authentication Status */}
        <div className="flex items-center space-x-2 pl-2 border-l border-white/8">
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-2">
              <div
                className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-neutral-900 border border-white/8 text-xs"
                title={`${user.first_name} ${user.last_name} (${user.email})`}
              >
                <div className="w-5 h-5 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                  {user.first_name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-neutral-200 hidden md:inline max-w-[120px] truncate">
                  {user.first_name} {user.last_name}
                </span>
              </div>
              <button
                onClick={() => logout()}
                title="Sign Out"
                className="p-2 rounded-lg bg-neutral-900 hover:bg-rose-950/50 border border-white/8 hover:border-rose-800/60 text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer shadow-sm"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal("login")}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-neutral-100 text-xs font-semibold shadow-lg transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-neutral-300" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
