"use client";

import React from "react";
import { Radar, RefreshCw, Plane, ShieldCheck, Database } from "lucide-react";

interface HeaderProps {
  totalFlights: number;
  nepalFlights: number;
  countdown: number;
  refreshing: boolean;
  onRefresh: () => void;
  cacheAge: number | null;
}

export const Header: React.FC<HeaderProps> = ({
  totalFlights,
  nepalFlights,
  countdown,
  refreshing,
  onRefresh,
  cacheAge,
}) => {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Radar Symbol */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-400">
          <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: "8s" }} />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 radar-ping" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
              Nepal Airspace Monitor
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              LIVE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>FIR: VNKT (Kathmandu)</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400/90 font-mono-avionics">26.3°N - 30.4°N / 80.0°E - 88.2°E</span>
          </p>
        </div>
      </div>

      {/* Metrics & Control Center */}
      <div className="flex items-center space-x-4">
        {/* Quick Stat Badges */}
        <div className="hidden sm:flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <Plane className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Total:</span>
            <span className="font-bold text-slate-200 font-mono-avionics">{totalFlights}</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-300/80">Nepal (9N):</span>
            <span className="font-bold text-emerald-300 font-mono-avionics">{nepalFlights}</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
            <Database className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px]">Enriched</span>
          </div>
        </div>

        {/* Polling Countdown & Manual Refresh */}
        <div className="flex items-center space-x-2">
          <div className="text-right hidden md:block">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Refresh in <span className="text-cyan-400 font-mono-avionics font-bold">{countdown}s</span>
            </div>
            {cacheAge !== null && (
              <div className="text-[9px] text-slate-500 font-mono-avionics">
                Cache age: {Math.round(cacheAge)}s
              </div>
            )}
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh live flights now"
            className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-cyan-400 transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-lg"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
