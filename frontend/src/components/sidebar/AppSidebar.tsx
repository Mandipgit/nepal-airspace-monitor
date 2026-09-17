"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import {
  PanelLeftClose,
  LogOut,
  LogIn,
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
  const { isAuthenticated, logout, openAuthModal } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="w-60 h-full flex flex-col justify-between bg-[#0d1017] border-r border-white/7 select-none transition-all duration-300 ease-in-out z-30 shrink-0">
      {/* Top Section: Sidebar Header + Toggle */}
      <div className="p-3 border-b border-white/7 flex items-center justify-between">
        <span className="text-[11px] font-mono-avionics uppercase tracking-wider font-semibold text-slate-400">
          Navigation
        </span>

        {/* Sidebar Toggle Button */}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={onToggle}
          aria-label="Collapse sidebar"
          className="w-7 h-7 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors p-1 shrink-0 cursor-pointer"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {/* Middle Section: Leave mostly empty as requested; minimal trigger */}
      <div className="flex-1 py-4 px-3 flex flex-col justify-start space-y-2">
        <Button
          fullWidth
          variant="ghost"
          onPress={onToggleSearch}
          className={`w-full justify-between py-2 px-2.5 rounded-lg border text-xs font-medium transition-all ${
            isSearchOpen
              ? "bg-white/10 border-white/20 text-slate-100"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
        >
          <div className="flex items-center space-x-2">
            <ListFilter className="w-3.5 h-3.5 text-slate-400" />
            <span>Flight Directory</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-avionics bg-white/5 text-slate-400 border border-white/5">
            {flightCount}
          </span>
        </Button>
      </div>

      {/* Bottom Section: Connected Logout / Sign In */}
      <div className="p-3 border-t border-white/7">
        {isAuthenticated ? (
          <Button
            fullWidth
            variant="ghost"
            onPress={handleLogout}
            className="w-full py-2 px-2.5 rounded-lg hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 text-xs font-medium flex items-center justify-start space-x-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </Button>
        ) : (
          <Button
            fullWidth
            variant="ghost"
            onPress={() => openAuthModal("login")}
            className="w-full py-2 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Button>
        )}
      </div>
    </aside>
  );
};
