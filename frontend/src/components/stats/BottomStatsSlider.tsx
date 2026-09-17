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
      {/* Slider Container - Distinct Elevated Console */}
      <div className="bg-[#111218] rounded-xl overflow-hidden border border-white/18 shadow-[0_12px_40px_rgba(0,0,0,0.95)] ring-1 ring-black/80 backdrop-blur-xl transition-all duration-300">
        {/* Toggle Bar / Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3.5 py-2 bg-[#191b24] hover:bg-[#222430] flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-200 transition-colors border-b border-white/12 cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-sans font-bold tracking-wider text-white text-[11px] uppercase">
              Live Status
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            {!isExpanded && (
              <span className="text-[10px] text-neutral-400 font-medium font-sans">
                {totalFlights} Active
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-neutral-300" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-neutral-300" />
            )}
          </div>
        </button>

        {/* Expanded Drawer Content - Clean Aviation Data Grid */}
        {isExpanded && (
          <div className="p-3.5 bg-[#111218] flex items-center gap-4 divide-x divide-white/12 text-left">
            {/* Live Flights */}
            <div className="pr-1">
              <div className="text-[9px] uppercase font-semibold text-neutral-400 tracking-wider">
                Live Flights
              </div>
              <div className="font-mono-avionics text-base font-bold text-neutral-100 mt-0.5 leading-none">
                {totalFlights}
              </div>
            </div>

            {/* Nepal Registered Flights */}
            <div className="pl-4 pr-1">
              <div className="text-[9px] uppercase font-semibold text-neutral-400 tracking-wider">
                Nepal (9N)
              </div>
              <div className="font-mono-avionics text-base font-bold text-emerald-400 mt-0.5 leading-none">
                {nepalFlights}
              </div>
            </div>

            {/* OpenSky API Credits Quota */}
            {rateLimitRemaining !== null && rateLimitRemaining !== undefined && (
              <div className="pl-4 pr-1">
                <div className="text-[9px] uppercase font-semibold text-neutral-400 tracking-wider">
                  API Quota
                </div>
                <div className="font-mono-avionics text-base font-bold text-neutral-200 mt-0.5 leading-none">
                  {rateLimitRemaining.toLocaleString()}
                </div>
              </div>
            )}

            {/* Refresh Countdown & Manual Polling Button */}
            <div className="pl-4 flex items-center gap-2.5">
              <div>
                <div className="text-[9px] uppercase font-semibold text-neutral-400 tracking-wider">
                  Refresh
                </div>
                <div className="font-mono-avionics text-base font-bold text-neutral-200 mt-0.5 leading-none">
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
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/8 transition-all p-1 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-white" : ""}`}
                />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
