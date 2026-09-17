"use client";

import React, { useState } from "react";
import { Avatar, Button } from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import { Radar, Bell, Sun, Moon, LogOut, User as UserIcon } from "lucide-react";

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = () => {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);

  // Dynamic user initial & name - strictly dynamic, no hardcoded values
  const userInitial = (user?.first_name || user?.email || "G").charAt(0).toUpperCase();
  const displayName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email
    : "Guest Pilot";

  return (
    <header className="h-14 w-full bg-[#080a0f] border-b border-white/7 px-4 flex items-center justify-between z-40 shrink-0 select-none">
      {/* Left: Brand Identity & Radar Status */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400">
          <Radar className="w-4 h-4 animate-spin" style={{ animationDuration: "10s" }} />
        </div>
        <div className="flex items-center space-x-2.5">
          <h1 className="text-xs font-bold tracking-widest uppercase text-slate-100 font-mono-avionics">
            Nepal Airspace Monitor
          </h1>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            LIVE
          </span>
        </div>
      </div>

      {/* Right: Controls strictly matching the reference screenshot */}
      <div className="flex items-center space-x-3">
        {/* Theme / Display Control Capsule [ ☼ ☾ ] */}
        <div className="hidden sm:flex items-center bg-[#12151c] border border-white/8 rounded-full p-0.5 shadow-inner">
          <button
            type="button"
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            title="Light mode (preview)"
            aria-label="Light mode"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-full bg-white/10 text-sky-400 shadow-sm transition-colors cursor-pointer"
            title="Dark mode active"
            aria-label="Dark mode active"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Notification Button (Dark circular container, subtle border, bell icon, red alert dot) */}
        <div className="relative">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => setNotificationsOpen(!notificationsOpen)}
            aria-label="Airspace notifications"
            className="w-9 h-9 rounded-full bg-[#12151c] hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all p-0 flex items-center justify-center cursor-pointer shadow-sm relative active:scale-95"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#080a0f]" />
          </Button>

          {/* Quick Notification Dropdown (Subtle operations telemetry notice) */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 p-3.5 rounded-xl bg-[#12151c] border border-white/10 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-white/7 mb-2">
                <span className="font-semibold text-slate-200">Airspace Feed Alerts</span>
                <span className="text-[10px] text-emerald-400 font-mono-avionics font-bold">ALL CLEAR</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ADS-B receivers across Kathmandu FIR (VNKT) are operating nominally. 100% telemetry synced with OpenSky feeds.
              </p>
            </div>
          )}
        </div>

        {/* User Profile Avatar [M] */}
        <div className="relative">
          {isAuthenticated ? (
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-0.5 rounded-full hover:ring-2 hover:ring-white/10 transition-all cursor-pointer focus:outline-none"
              aria-label="User account menu"
            >
              <Avatar
                size="sm"
                className="w-9 h-9 rounded-full bg-slate-800 border border-white/15 text-slate-100 font-mono font-bold text-sm flex items-center justify-center shadow-md"
              >
                <Avatar.Fallback>{userInitial}</Avatar.Fallback>
              </Avatar>
            </button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => openAuthModal("login")}
              className="h-9 px-3.5 rounded-full bg-[#12151c] hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Sign In</span>
            </Button>
          )}

          {/* Authenticated User Menu Dropdown */}
          {isAuthenticated && showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 p-2 rounded-xl bg-[#12151c] border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95">
              <div className="px-2.5 py-2 border-b border-white/7 mb-1">
                <div className="text-xs font-semibold text-slate-200 truncate">{displayName}</div>
                <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
              </div>
              <Button
                fullWidth
                size="sm"
                variant="ghost"
                onPress={async () => {
                  setShowUserMenu(false);
                  await logout();
                }}
                className="w-full justify-start py-1.5 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
