"use client";

import React from "react";
import { Avatar } from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import { Sun, Moon, Layers, Scan, Plane, Globe } from "lucide-react";

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
}) => {
  const { user, isAuthenticated } = useAuth();

  // Dynamic user initial & name
  const userInitial = (user?.first_name || user?.email || "G").charAt(0).toUpperCase();
  const displayName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email
    : "Guest Mode";

  return (
    <header className="h-14 w-full bg-[#111113] border-b border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.35)] px-4 flex items-center justify-between z-40 shrink-0 select-none font-sans">
      {/* Left: User Identity / Guest Mode Avatar & Live Status */}
      <div className="flex items-center space-x-3">
        <Avatar
          size="sm"
          className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.08] text-[#FAFAFA] font-semibold text-xs flex items-center justify-center shadow-sm shrink-0 select-none"
        >
          <Avatar.Fallback>{isAuthenticated ? userInitial : "G"}</Avatar.Fallback>
        </Avatar>
        <div className="flex items-center space-x-2.5">
          <h1 className="text-[15px] font-semibold text-[#FAFAFA] tracking-tight font-sans select-none">
            {isAuthenticated ? displayName : "Guest Mode"}
          </h1>
        </div>
      </div>

      {/* Right: Controls - Permanently Dark Shell */}
      <div className="flex items-center space-x-2.5">
        {/* OpenFreeMap Style Switcher */}
        {onCycleMapStyle && (
          <button
            type="button"
            onClick={onCycleMapStyle}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-semibold text-neutral-200 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm"
            title="Switch map style (Positron, Bright, Liberty)"
          >
            <Layers className="w-3.5 h-3.5 text-neutral-300" />
            <span>
              Map Style: {mapStyle === "dark" ? "Bright" : (mapStyle ? mapStyle.charAt(0).toUpperCase() + mapStyle.slice(1) : "Bright")}
            </span>
          </button>
        )}

        {/* Viewport Sync Toggle */}
        {onToggleSyncViewport && (
          <button
            type="button"
            onClick={onToggleSyncViewport}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm ${
              syncViewport
                ? "bg-[#181a24] hover:bg-[#222533] border-white/28 text-white"
                : "bg-white/[0.05] hover:bg-white/[0.10] border-white/[0.08] text-neutral-400"
            }`}
            title={syncViewport ? "Dynamic viewport bounds active (updates as you pan/zoom)" : "Locked to Nepal FIR"}
          >
            <Scan className="w-3.5 h-3.5 text-neutral-300" />
            <span>{syncViewport ? "Viewport Bounds ON" : "Lock FIR"}</span>
          </button>
        )}

        {/* Airspace Traffic Scope Toggle: Nepal Corridors vs All Regional Flights */}
        {onToggleNepalContext && (
          <button
            type="button"
            onClick={onToggleNepalContext}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm ${
              nepalContextOnly
                ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300"
                : "bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-200"
            }`}
            title={
              nepalContextOnly
                ? "Nepal Airspace Focus ON: Inbound, outbound, domestic, and overflights. Click to show All Regional Traffic."
                : "All Regional Flights ON: All planes in map viewport. Click to focus on Nepal Corridors only."
            }
          >
            {nepalContextOnly ? (
              <Plane className="w-3.5 h-3.5 text-emerald-400 rotate-45" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>{nepalContextOnly ? "Nepal Corridors" : "All Traffic"}</span>
          </button>
        )}

        {/* Theme Toggle: rounded-full pill with sliding active thumb */}
        <div className="relative flex items-center p-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] shadow-inner">
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
