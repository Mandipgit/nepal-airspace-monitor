"use client";

import React from "react";
import { Button } from "@heroui/react";
import {
  PanelLeftClose,
  ListFilter,
} from "lucide-react";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  flightCount: number;
  syncViewport?: boolean;
  onToggleSyncViewport?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isOpen,
  onToggle,
  isSearchOpen,
  onToggleSearch,
  flightCount,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="w-64 h-full flex flex-col justify-between bg-[#0e0f14] border-r border-white/16 shadow-[6px_0_30px_rgba(0,0,0,0.9)] select-none transition-all duration-300 ease-in-out z-30 shrink-0">
      {/* Top Section: Sidebar Header + Toggle */}
      <div className="p-3.5 border-b border-white/12 flex items-center justify-between bg-[#14161f]">
        <span className="text-xs font-sans font-bold uppercase tracking-wider text-white">
          Navigation
        </span>

        {/* Sidebar Toggle Button */}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={onToggle}
          aria-label="Collapse sidebar"
          className="w-7 h-7 text-neutral-400 hover:text-neutral-200 hover:bg-white/5 rounded-lg transition-colors p-1 shrink-0 cursor-pointer"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {/* Middle Section: Flight Directory (Only item under Navigation) */}
      <div className="flex-1 py-4 px-3 flex flex-col justify-start">
        <button
          onClick={onToggleSearch}
          className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            isSearchOpen
              ? "bg-white/15 text-white font-semibold border border-white/25 shadow-lg shadow-black/40"
              : "bg-[#161822] hover:bg-[#1e202c] text-neutral-200 hover:text-white border border-white/12 hover:border-white/20 shadow-sm"
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <ListFilter className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">Flight Directory</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-avionics bg-white/10 text-neutral-200 border border-white/12">
            {flightCount}
          </span>
        </button>
      </div>
    </aside>
  );
};
