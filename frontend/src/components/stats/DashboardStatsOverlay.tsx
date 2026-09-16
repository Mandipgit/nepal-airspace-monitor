"use client";

import React from "react";
import { Button, Tooltip } from "@heroui/react";
import { Plane, Shield, RefreshCw, Activity, Clock } from "lucide-react";

interface DashboardStatsOverlayProps {
  totalFlights: number;
  nepalFlights: number;
  countdown: number;
  refreshing: boolean;
  onRefresh: () => void;
  cacheAge: number | null;
  rateLimitRemaining?: number | null;
}

export const DashboardStatsOverlay: React.FC<DashboardStatsOverlayProps> = ({
  totalFlights,
  nepalFlights,
  countdown,
  refreshing,
  onRefresh,
  cacheAge,
  rateLimitRemaining,
}) => {
  return (
    <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center gap-2 select-none pointer-events-auto">
      {/* Total Active Flights Card */}
      <div className="glass-panel-floating px-3.5 py-2 rounded-xl flex items-center space-x-2.5">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Plane className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider leading-none">
            Live Flights
          </span>
          <span className="font-mono-avionics text-sm font-extrabold text-slate-100 mt-0.5 block leading-none">
            {totalFlights}
          </span>
        </div>
      </div>

      {/* Nepal Registered Flights Card */}
      <div className="glass-panel-floating px-3.5 py-2 rounded-xl flex items-center space-x-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Shield className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-emerald-400/90 block tracking-wider leading-none">
            Nepal (9N)
          </span>
          <span className="font-mono-avionics text-sm font-extrabold text-emerald-300 mt-0.5 block leading-none">
            {nepalFlights}
          </span>
        </div>
      </div>

      {/* API Usage Quota (OpenSky credits) */}
      {rateLimitRemaining !== null && rateLimitRemaining !== undefined && (
        <Tooltip closeDelay={0}>
          <Tooltip.Trigger>
            <div
              className={`glass-panel-floating px-3.5 py-2 rounded-xl flex items-center space-x-2.5 transition-colors ${
                rateLimitRemaining > 1000
                  ? "border-white/10"
                  : rateLimitRemaining > 200
                  ? "border-amber-500/40 bg-amber-950/20"
                  : "border-rose-500/40 bg-rose-950/20"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  rateLimitRemaining > 1000
                    ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400"
                    : rateLimitRemaining > 200
                    ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                    : "bg-rose-500/15 border border-rose-500/30 text-rose-400"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider leading-none">
                  API Quota
                </span>
                <span className="font-mono-avionics text-sm font-extrabold text-slate-200 mt-0.5 block leading-none">
                  {rateLimitRemaining.toLocaleString()}
                </span>
              </div>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
            OpenSky Credits Remaining: {rateLimitRemaining.toLocaleString()}
          </Tooltip.Content>
        </Tooltip>
      )}

      {/* Polling Countdown & Manual Refresh Button */}
      <div className="glass-panel-floating p-1 rounded-xl flex items-center space-x-2">
        <div className="px-2 py-1 text-right hidden sm:block">
          <div className="text-[9px] uppercase font-semibold text-slate-400 flex items-center space-x-1">
            <Clock className="w-2.5 h-2.5 text-cyan-400" />
            <span>Refresh</span>
          </div>
          <div className="text-xs font-mono-avionics font-bold text-cyan-400">
            {countdown}s
          </div>
        </div>

        <Tooltip closeDelay={0}>
          <Tooltip.Trigger>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={onRefresh}
              isDisabled={refreshing}
              aria-label="Refresh telemetry feed"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 border border-white/5 flex items-center justify-center transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`}
              />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
            Fetch latest aircraft positions
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
};
