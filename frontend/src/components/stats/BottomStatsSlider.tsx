"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface BottomStatsSliderProps {
  totalFlights: number;
  nepalFlights: number;
  countdown: number;
  refreshing: boolean;
  onRefresh: () => void;
  cacheAge: number | null;
  rateLimitRemaining?: number | null;
}

export const BottomStatsSlider: React.FC<BottomStatsSliderProps> = ({
  totalFlights,
  nepalFlights,
  countdown,
  refreshing,
  onRefresh,
  rateLimitRemaining,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  return (
    <div className="absolute bottom-4 right-4 z-20 select-none flex flex-col items-end">
      {/* Slider / Drawer Container */}
      <div className="glass-panel rounded-xl overflow-hidden border border-white/8 shadow-2xl transition-all duration-300 backdrop-blur-xl">
        {/* Toggle Bar / Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-1.5 bg-slate-900/80 hover:bg-slate-850 flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors border-b border-white/5 cursor-pointer"
        >
          <span className="font-mono-avionics text-slate-300">Airspace Telemetry</span>
          <div className="flex items-center space-x-1">
            <span className="text-[9px] text-slate-500 font-normal">
              {isExpanded ? "Collapse" : `${totalFlights} Active`}
            </span>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            )}
          </div>
        </button>

        {/* Expanded Drawer Content - Clean Aviation Data Grid (NO ICONS) */}
        {isExpanded && (
          <div className="p-3 bg-slate-950/70 flex items-center gap-4 divide-x divide-white/6 text-left">
            {/* Live Flights */}
            <div className="pr-1">
              <div className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider">
                Live Flights
              </div>
              <div className="font-mono-avionics text-lg font-bold text-slate-100 mt-0.5 leading-none">
                {totalFlights}
              </div>
            </div>

            {/* Nepal Registered Flights */}
            <div className="pl-4 pr-1">
              <div className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider">
                Nepal (9N)
              </div>
              <div className="font-mono-avionics text-lg font-bold text-emerald-400 mt-0.5 leading-none">
                {nepalFlights}
              </div>
            </div>

            {/* OpenSky API Credits Quota */}
            {rateLimitRemaining !== null && rateLimitRemaining !== undefined && (
              <div className="pl-4 pr-1">
                <div className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider">
                  API Quota
                </div>
                <div className="font-mono-avionics text-lg font-bold text-slate-200 mt-0.5 leading-none">
                  {rateLimitRemaining.toLocaleString()}
                </div>
              </div>
            )}

            {/* Refresh Countdown & Manual Polling Button */}
            <div className="pl-4 flex items-center gap-2.5">
              <div>
                <div className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider">
                  Refresh
                </div>
                <div className="font-mono-avionics text-lg font-bold text-cyan-400 mt-0.5 leading-none">
                  {countdown}s
                </div>
              </div>

              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={onRefresh}
                isDisabled={refreshing}
                aria-label="Refresh telemetry"
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/8 transition-all p-1"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`}
                />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
