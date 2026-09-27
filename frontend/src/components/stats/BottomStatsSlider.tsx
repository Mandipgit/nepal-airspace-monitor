"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { RefreshCw } from "lucide-react";

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
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <div className="absolute bottom-4 right-4 z-20 select-none flex flex-col items-end">
      {/* Slider Container - Hover-Based Reveal with Smooth Hero UI Animation */}
      <div
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className="bg-[#0a0b0e] hover:bg-[#14161f] rounded-2xl overflow-hidden border border-white/18 shadow-[0_6px_20px_rgba(0,0,0,0.48)] ring-1 ring-black/40 backdrop-blur-xl transition-colors duration-300 group cursor-default"
      >
        {/* Header Bar (Arrow completely removed) */}
        <div className="w-full px-4 py-2.5 bg-[#12141c] group-hover:bg-[#1a1c26] flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 transition-colors duration-300 border-b border-white/12">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-sans font-bold tracking-wider text-white text-[11px] uppercase">
              Live Status
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-neutral-300 font-medium font-sans">
              {totalFlights} Active
            </span>
          </div>
        </div>

        {/* Hover-Expanded Drawer Content with Smooth Hero UI Motion Transition */}
        <div
          style={{
            transition: isExpanded
              ? "max-height 340ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 340ms cubic-bezier(0.16, 1, 0.3, 1)"
              : "max-height 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 240ms cubic-bezier(0.4, 0, 0.2, 1), transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          className={`overflow-hidden transition-all ${
            isExpanded
              ? "max-h-28 opacity-100 translate-y-0 pointer-events-auto"
              : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="p-3.5 bg-transparent flex items-center gap-4 divide-x divide-white/12 text-left transition-colors duration-300">
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
                className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/15 group-hover:bg-white/10 text-neutral-300 hover:text-white border border-white/8 transition-all p-1 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-white" : ""}`}
                />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
