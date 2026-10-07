"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";

interface BottomStatsSliderProps {
  totalFlights: number;
  nepalFlights: number;
  countdown?: number;
  refreshing: boolean;
  onRefresh: () => void;
  cacheAge: number | null;
  rateLimitRemaining?: number | null;
  isDetailedMode?: boolean;
  onToggleDetailedMode?: () => void;
  detailedRemainingSeconds?: number;
  detailedResetCountdown?: string;
  isDetailedQuotaExhausted?: boolean;
  isMonthlyQuotaExhausted?: boolean;
  monthlyQuotaMessage?: string | null;
}

function formatMinutesSeconds(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const BottomStatsSlider: React.FC<BottomStatsSliderProps> = ({
  totalFlights,
  nepalFlights,
  countdown,
  refreshing,
  onRefresh,
  rateLimitRemaining,
  isDetailedMode = false,
  onToggleDetailedMode,
  detailedRemainingSeconds = 210,
  detailedResetCountdown = "24h",
  isDetailedQuotaExhausted = false,
  isMonthlyQuotaExhausted = false,
  monthlyQuotaMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <div className="absolute bottom-4 right-4 z-20 select-none flex flex-col items-end">
      {/* Slider Container - Interactive Click Toggle & Hover with Smooth Direct Collapse */}
      <div
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        style={{
          transition: isExpanded
            ? "width 280ms cubic-bezier(0.16, 1, 0.3, 1), background-color 280ms ease"
            : "width 240ms cubic-bezier(0.4, 0, 0.2, 1) 220ms, background-color 240ms ease",
        }}
        className={`${
          isExpanded
            ? "w-fit"
            : isMonthlyQuotaExhausted
            ? "w-[265px]"
            : isDetailedMode
            ? "w-[245px]"
            : "w-[172px]"
        } bg-[#0a0b0e] hover:bg-[#14161f] rounded-2xl overflow-hidden border border-white/18 shadow-[0_6px_20px_rgba(0,0,0,0.48)] ring-1 ring-black/40 backdrop-blur-xl group cursor-pointer`}
        onClick={() => setIsExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        aria-label="Toggle Live Status Details"
      >
        {/* Header Bar - Snug horizontal length and clean balanced spacing */}
        <div
          className={`w-full ${
            isExpanded ? "px-3.5 py-2 gap-4" : "px-3.5 py-2 gap-3"
          } bg-[#12141c] group-hover:bg-[#1a1c26] flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-neutral-400 transition-colors duration-200 border-b ${
            isExpanded ? "border-white/12" : "border-transparent"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold tracking-wider text-white text-[11px] uppercase">
              Live Status
            </span>
            {isMonthlyQuotaExhausted ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40" title="AeroAPI monthly limit reached">
                AEROAPI: MONTHLY LIMIT
              </span>
            ) : isDetailedMode ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                AEROAPI: {formatMinutesSeconds(detailedRemainingSeconds)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center">
            <span className="text-[10px] text-neutral-300 font-medium font-sans whitespace-nowrap">
              {totalFlights} Active
            </span>
          </div>
        </div>

        {/* Collapsible Drawer - Direct In-Place Vertical Collapse without 2x2 wrapping */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: isExpanded ? "1fr" : "0fr",
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded ? "translateY(0)" : "translateY(-4px)",
            transition: isExpanded
              ? "grid-template-rows 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1)"
              : "grid-template-rows 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 180ms ease, transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          className="overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden min-w-max">
            <div className="px-3.5 py-2.5 bg-transparent flex flex-nowrap items-center gap-3.5 divide-x divide-white/12 text-left whitespace-nowrap min-w-max transition-colors duration-200">
              {/* Live Flights */}
              <div className="pr-1 shrink-0">
                <div className="text-[9px] uppercase font-semibold text-neutral-400 tracking-wider">
                  Live Flights
                </div>
                <div className="font-mono-avionics text-base font-bold text-neutral-100 mt-0.5 leading-none">
                  {totalFlights}
                </div>
              </div>

              {/* Nepal Registered Flights */}
              <div className="pl-3.5 pr-1 shrink-0">
                <div className="text-[9px] uppercase font-semibold text-neutral-400 tracking-wider">
                  Nepal (9N)
                </div>
                <div className="font-mono-avionics text-base font-bold text-emerald-400 mt-0.5 leading-none">
                  {nepalFlights}
                </div>
              </div>

              {/* Provider / API Credits Quota */}
              {rateLimitRemaining !== null && rateLimitRemaining !== undefined && (
                <div className="pl-3.5 pr-1 shrink-0">
                  <div className="text-[9px] uppercase font-semibold text-neutral-400 tracking-wider">
                    {isDetailedMode ? "AeroAPI Quota" : "OpenSky Quota"}
                  </div>
                  <div className="font-mono-avionics text-base font-bold text-neutral-200 mt-0.5 leading-none">
                    {rateLimitRemaining.toLocaleString()}
                  </div>
                </div>
              )}

              {/* FlightAware AeroAPI "Load Detailed Flights" Section */}
              <div className="pl-3.5 flex items-center gap-3 shrink-0">
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <span className="text-[9px] uppercase font-semibold text-neutral-400 tracking-wider">
                      Live Data
                    </span>
                  </div>
                  <div className="font-mono-avionics text-xs font-bold mt-0.5 leading-none">
                    {isMonthlyQuotaExhausted ? (
                      <span className="text-rose-400">Monthly limit</span>
                    ) : isDetailedMode ? (
                      <span className="text-amber-400">{formatMinutesSeconds(detailedRemainingSeconds)} live</span>
                    ) : isDetailedQuotaExhausted ? (
                      <span className="text-rose-400">00:00 (Daily limit)</span>
                    ) : (
                      <span className="text-neutral-400">{formatMinutesSeconds(detailedRemainingSeconds)} daily</span>
                    )}
                  </div>
                </div>

                {isMonthlyQuotaExhausted ? (
                  <Button
                    size="sm"
                    radius="full"
                    isDisabled
                    title={monthlyQuotaMessage || "FlightAware monthly API quota limit reached. Reverted to OpenSky Network."}
                    className="h-8 px-4 rounded-full !bg-rose-500/15 border border-rose-500/30 !text-rose-300 text-xs font-medium cursor-not-allowed select-none opacity-80"
                    aria-label="Monthly quota limit reached"
                  >
                    Monthly Limit Reached
                  </Button>
                ) : isDetailedMode ? (
                  <Button
                    size="sm"
                    radius="full"
                    onPress={onToggleDetailedMode}
                    className="h-8 px-4 rounded-full !bg-amber-500/20 hover:!bg-amber-500/30 !text-amber-200 border border-amber-500/40 text-xs font-medium transition-colors cursor-pointer shadow-none active:scale-95"
                    aria-label="Stop Detailed Mode"
                  >
                    Stop ({formatMinutesSeconds(detailedRemainingSeconds)})
                  </Button>
                ) : isDetailedQuotaExhausted ? (
                  <Button
                    size="sm"
                    radius="full"
                    isDisabled
                    className="h-8 px-4 rounded-full !bg-[#27272a]/70 !text-neutral-400 text-xs font-medium cursor-not-allowed select-none opacity-60 border-0"
                    aria-label="Daily limit reached"
                  >
                    Disabled (Resets in {detailedResetCountdown})
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    radius="full"
                    onPress={onToggleDetailedMode}
                    className="h-8 px-4 rounded-full !bg-[#27272a] hover:!bg-[#3f3f46] !text-[#f4f4f5] hover:!text-white text-xs font-medium transition-colors cursor-pointer shadow-none border-0 active:scale-95"
                    aria-label="Load Detailed Flights"
                  >
                    Load Detailed Flights
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
