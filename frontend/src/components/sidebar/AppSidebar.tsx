"use client";

import React from "react";
import {
  ListFilter,
} from "lucide-react";

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
      className={`fixed left-0 top-14 bottom-0 z-35 w-64 flex flex-col justify-between bg-[#030406] hover:bg-[#0d0f14] border-r border-y border-white/10 shadow-[14px_0_45px_rgba(0,0,0,0.95)] rounded-r-2xl select-none transition-all duration-300 ease-out overflow-hidden group ${
        isOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
      }`}
    >
      {/* Top Section: Sidebar Header without toggle icon */}
      <div className="p-3.5 border-b border-white/8 flex items-center bg-[#07080b] group-hover:bg-[#111319] transition-colors duration-300">
        <span className="text-xs font-sans font-bold uppercase tracking-wider text-white">
          Navigation
        </span>
      </div>

      {/* Middle Section: Flight Directory (Only item under Navigation) */}
      <div className="flex-1 py-4 px-3 flex flex-col justify-start">
        <button
          onClick={onToggleSearch}
          className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            isSearchOpen
              ? "bg-white/15 text-white font-semibold border border-white/25 shadow-lg shadow-black/40"
              : "bg-[#0b0c10] group-hover:bg-[#151720] hover:bg-[#1c1e28] text-neutral-200 hover:text-white border border-white/10 hover:border-white/18 shadow-sm"
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <ListFilter className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">Flight Directory</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-avionics bg-white/5 text-neutral-300 border border-white/8">
            {flightCount}
          </span>
        </button>
      </div>
    </aside>
  );
};
