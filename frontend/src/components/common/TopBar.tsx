"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button, Tooltip } from "@heroui/react";
import {
  Sun,
  Moon,
  Layers,
  Scan,
  ChevronLeft,
} from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { NormalizedFlight } from "@/types/flight";
import { AirportSummary } from "@/types/airport";

interface TopBarProps {
  onToggleSidebar?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (dark: boolean) => void;
  mapStyle?: string;
  onCycleMapStyle?: () => void;
  syncViewport?: boolean;
  onToggleSyncViewport?: () => void;
  nepalContextOnly?: boolean;
  onToggleNepalContext?: () => void;

  // Global Search integration props
  flights?: NormalizedFlight[];
  airports?: AirportSummary[];
  onSelectFlight?: (flight: NormalizedFlight) => void;
  onSelectAirport?: (ident: string) => void;
  onCenterFlight?: (flight: NormalizedFlight) => void;
  onCenterAirport?: (lat: number, lon: number) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  isDarkMode = true,
  onToggleDarkMode,
  mapStyle,
  onCycleMapStyle,
  syncViewport,
  onToggleSyncViewport,
  nepalContextOnly = true,
  onToggleNepalContext,
  flights = [],
  airports = [],
  onSelectFlight,
  onSelectAirport,
  onCenterFlight,
  onCenterAirport,
}) => {
  // Default state: The control section restores persisted preference or defaults to closed
  const [isControlsOpen, setIsControlsOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aerotrace_controls_open");
      if (saved !== null) return saved === "true";
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aerotrace_controls_open", String(isControlsOpen));
    }
  }, [isControlsOpen]);

  return (
    <header className="h-14 w-full bg-[#111113] border-b border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.35)] px-4 flex items-center justify-between z-40 shrink-0 select-none font-sans">
      {/* Left: Project Brand Logo */}
      <div className="flex items-center h-full pl-0.5 shrink-0">
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-90 active:scale-[0.98] cursor-pointer"
          title="AeroTrace - Nepal Airspace Monitor"
        >
          <Image
            src="/aerotrace_logo.jpg"
            alt="AeroTrace"
            width={180}
            height={48}
            priority
            unoptimized
            className="h-9 md:h-11 w-auto object-contain select-none mix-blend-screen"
          />
        </Link>
      </div>

      {/* Right: Global Search + Collapsible Controls + Circular Toggle Button + Theme Switcher */}
      <div className="flex items-center space-x-2.5">
        {/* Global Dashboard Search Bar (Positioned to the left of the collapsible controls) */}
        {onSelectFlight && onSelectAirport && (
          <GlobalSearch
            flights={flights}
            airports={airports}
            onSelectFlight={onSelectFlight}
            onSelectAirport={onSelectAirport}
            onCenterFlight={onCenterFlight}
            onCenterAirport={onCenterAirport}
          />
        )}

        {/* Collapsible Controls Section (Expands toward the left) */}
        <motion.div
          initial={false}
          animate={{
            width: isControlsOpen ? "auto" : 0,
            opacity: isControlsOpen ? 1 : 0,
          }}
          transition={{
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex items-center overflow-hidden"
        >
          <div className="flex items-center space-x-2.5 pr-2.5 shrink-0">
            {/* Map Style Switcher */}
            {onCycleMapStyle && (
              <button
                type="button"
                onClick={onCycleMapStyle}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-semibold text-neutral-200 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm whitespace-nowrap"
                title="Switch map style (Positron, Bright, Liberty)"
              >
                <Layers className="w-3.5 h-3.5 text-neutral-300" />
                <span>
                  Map Style:{" "}
                  {mapStyle === "dark"
                    ? "Bright"
                    : mapStyle
                    ? mapStyle.charAt(0).toUpperCase() + mapStyle.slice(1)
                    : "Bright"}
                </span>
              </button>
            )}

            {/* Viewport Bounds Sync Toggle */}
            {onToggleSyncViewport && (
              <button
                type="button"
                onClick={onToggleSyncViewport}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm whitespace-nowrap ${
                  syncViewport
                    ? "bg-[#181a24] hover:bg-[#222533] border-white/28 text-white"
                    : "bg-white/[0.05] hover:bg-white/[0.10] border-white/[0.08] text-neutral-400"
                }`}
                title={
                  syncViewport
                    ? "Dynamic viewport bounds active (updates as you pan/zoom)"
                    : "Locked to Nepal FIR"
                }
              >
                <Scan className="w-3.5 h-3.5 text-neutral-300" />
                <span>{syncViewport ? "Viewport Bounds ON" : "Lock FIR"}</span>
              </button>
            )}

            {/* Nepal Flights vs All Regional Flights Scope Toggle */}
            {onToggleNepalContext && (
              <button
                type="button"
                onClick={onToggleNepalContext}
                className={`flex items-center px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm whitespace-nowrap ${
                  nepalContextOnly
                    ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300"
                    : "bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-200"
                }`}
                title={
                  nepalContextOnly
                    ? "Nepal Airspace Focus ON: Inbound, outbound, domestic, and overflights. Click to show All Regional Traffic."
                    : "All Regional Flights ON: All planes in map viewport. Click to focus on Nepal Flights only."
                }
              >
                <span>{nepalContextOnly ? "Nepal Flights" : "All Traffic"}</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Circular HeroUI-style button with left-pointing arrow */}
        <Tooltip closeDelay={100}>
          <Tooltip.Trigger>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => setIsControlsOpen((prev) => !prev)}
              aria-label={isControlsOpen ? "Collapse controls" : "Expand controls"}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] text-neutral-300 hover:text-white transition-all duration-300 ease-out cursor-pointer shadow-sm shrink-0 flex items-center justify-center"
            >
              <ChevronLeft
                className={`w-4 h-4 transition-transform duration-450 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isControlsOpen ? "rotate-180" : "rotate-0"
                }`}
              />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content className="px-2.5 py-1 text-xs rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-200">
            {isControlsOpen ? "Collapse controls" : "Map & airspace controls"}
          </Tooltip.Content>
        </Tooltip>

        {/* Theme Toggle: rounded-full pill with sliding active thumb */}
        <div className="relative flex items-center p-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] shadow-inner shrink-0">
          {/* Sliding Thumb */}
          <div
            className="absolute top-0.5 bottom-0.5 left-0.5 w-7 rounded-full bg-white/[0.12] shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: isDarkMode ? "translateX(28px)" : "translateX(0px)",
            }}
          />

          <button
            type="button"
            onClick={() => onToggleDarkMode?.(false)}
            className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 ease-out cursor-pointer active:scale-[0.97] ${
              !isDarkMode
                ? "text-amber-400 font-semibold"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
            title="Switch to Light mode (map only)"
            aria-label="Light mode"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onToggleDarkMode?.(true)}
            className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 ease-out cursor-pointer active:scale-[0.97] ${
              isDarkMode
                ? "text-[#FAFAFA] font-semibold"
                : "text-[#71717A] hover:text-[#FAFAFA]"
            }`}
            title="Switch to Dark mode (map only)"
            aria-label="Dark mode"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
