"use client";

import React from "react";
import { ListFilter } from "lucide-react";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  flightCount: number;
  syncViewport?: boolean;
  onToggleSyncViewport?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isOpen,
  onClose,
  onOpen,
  isSearchOpen,
  onToggleSearch,
  flightCount,
}) => {
  return (
    <aside
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      style={{
        willChange: "transform",
        transition: isOpen
          ? "transform 180ms cubic-bezier(0.05, 0.9, 0.2, 1)"
          : "transform 150ms cubic-bezier(0.4, 0, 0.9, 1)",
      }}
      className={`fixed left-0 top-14 bottom-0 z-35 w-[268px] flex flex-col justify-between bg-[#111113] border-r border-y border-white/[0.08] shadow-[0_1px_5px_rgba(0,0,0,0.18),0_6px_16px_rgba(0,0,0,0.22)] rounded-r-2xl select-none overflow-hidden font-sans ${
        isOpen
          ? "translate-x-0 pointer-events-auto"
          : "-translate-x-full pointer-events-none"
      }`}
    >
      {/* Top Section: Eyebrow label and Nav Rows */}
      <div className="p-4 flex flex-col flex-1">
        {/* Eyebrow label */}
        <div className="text-[11px] font-semibold tracking-[0.05em] uppercase text-[#71717A] mb-4 select-none">
          NAVIGATION
        </div>

        {/* Navigation list with 4px gap between rows */}
        <div className="flex flex-col gap-1">
          {/* Flight Directory Nav Row */}
          <button
            type="button"
            onClick={onToggleSearch}
            className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-sm transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer ${
              isSearchOpen
                ? "bg-white/[0.10] text-[#FAFAFA] font-semibold border border-white/[0.08]"
                : "bg-transparent text-[#A1A1AA] hover:bg-white/[0.06] hover:text-[#FAFAFA] font-medium"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <ListFilter className="w-5 h-5 shrink-0 transition-colors duration-150 ease-out" />
              <span className="leading-none">Flight Directory</span>
            </div>
            {/* Trailing badge */}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-mono-avionics transition-all duration-150 ease-out ${
                flightCount > 0
                  ? "text-[#4ADE80] bg-[rgba(34,197,94,0.18)] border border-[rgba(34,197,94,0.25)] font-bold"
                  : "text-[#71717A] bg-white/[0.05] border border-white/[0.08]"
              }`}
            >
              {flightCount}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
