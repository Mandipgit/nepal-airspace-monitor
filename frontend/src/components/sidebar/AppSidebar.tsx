"use client";

import React from "react";
import { Avatar, Button } from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import {
  PanelLeftClose,
  ListFilter,
  LogOut,
  LogIn,
  Compass,
} from "lucide-react";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  flightCount: number;
  syncViewport: boolean;
  onToggleSyncViewport: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isOpen,
  onToggle,
  isSearchOpen,
  onToggleSearch,
  flightCount,
  syncViewport,
  onToggleSyncViewport,
}) => {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();

  // Strictly dynamic user name and initial - no hardcoded names
  const displayName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email
    : "Guest Pilot";

  const userInitial = (user?.first_name || user?.email || "G").charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="w-64 h-full flex flex-col justify-between glass-sidebar select-none transition-all duration-300 ease-in-out z-30 shrink-0 animate-in fade-in slide-in-from-left-4">
      {/* Top Section: User Profile + Toggle */}
      <div className="p-3.5 border-b border-white/8">
        <div className="flex items-center justify-between">
          {/* User Profile Container */}
          <div className="flex items-center space-x-3 min-w-0">
            {/* Clean Avatar without pulsating green dot */}
            <div className="relative shrink-0">
              <Avatar
                size="sm"
                className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 text-slate-200 font-mono font-bold text-sm flex items-center justify-center shadow-inner"
              >
                <Avatar.Fallback>{userInitial}</Avatar.Fallback>
              </Avatar>
            </div>

            {/* Dynamic Name (No "Session Active" subtitle) */}
            <div className="min-w-0 flex-1">
              <div
                className="text-sm font-semibold text-slate-100 truncate leading-tight tracking-wide"
                title={displayName}
              >
                {displayName}
              </div>
            </div>
          </div>

          {/* Sidebar Toggle Button */}
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onToggle}
            aria-label="Close sidebar"
            className="text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors p-1"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Middle Section: Navigation Tools (No "Live Airspace" or "Nepal Active" text boxes) */}
      <div className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto no-scrollbar">
        {/* Flight Directory Trigger */}
        <Button
          fullWidth
          variant="ghost"
          onPress={onToggleSearch}
          className={`w-full justify-between py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
            isSearchOpen
              ? "bg-slate-800/90 border-cyan-500/50 text-cyan-300 shadow-sm"
              : "border-white/5 text-slate-300 hover:text-white hover:bg-white/5"
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <ListFilter className="w-4 h-4 text-slate-400" />
            <span>Flight Directory</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-avionics font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {flightCount}
          </span>
        </Button>

        {/* Airspace Corridor Sync */}
        <Button
          fullWidth
          variant="ghost"
          onPress={onToggleSyncViewport}
          className={`w-full justify-between py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
            syncViewport
              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
              : "border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Compass className={`w-4 h-4 ${syncViewport ? "text-emerald-400" : "text-slate-500"}`} />
            <span>Corridor Sync</span>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              syncViewport ? "bg-emerald-400 shadow-sm shadow-emerald-400/80" : "bg-slate-600"
            }`}
          />
        </Button>
      </div>

      {/* Bottom Section: Dynamic Logout / Sign In */}
      <div className="p-3 border-t border-white/8">
        {isAuthenticated ? (
          <Button
            fullWidth
            variant="ghost"
            onPress={handleLogout}
            className="w-full py-2 px-3 rounded-xl border border-white/5 hover:border-rose-900/50 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center justify-start space-x-2.5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </Button>
        ) : (
          <Button
            fullWidth
            variant="ghost"
            onPress={() => openAuthModal("login")}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/10 transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </Button>
        )}
      </div>
    </aside>
  );
};
