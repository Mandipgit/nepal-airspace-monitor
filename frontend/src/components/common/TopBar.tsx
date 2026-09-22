"use client";

import React, { useState } from "react";
import { Avatar } from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import { Bell, Sun, Moon, LogOut, User as UserIcon } from "lucide-react";

interface TopBarProps {
  onToggleSidebar?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (dark: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  isDarkMode = true,
  onToggleDarkMode,
}) => {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);

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
      <div className="flex items-center space-x-3">
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

        {/* Notification Bell Icon Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label="Airspace notifications"
            className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] text-[#A1A1AA] hover:text-[#FAFAFA] transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm relative flex items-center justify-center"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FB7185] ring-2 ring-[#111113] animate-scale-in-once" />
          </button>

          {/* Quick Notification Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 p-3.5 rounded-xl bg-[#111113] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.35),0_12px_32px_rgba(0,0,0,0.45)] z-50 text-xs transition-all duration-240 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] mb-2">
                <span className="font-semibold text-[#FAFAFA]">Airspace Feed Alerts</span>
                <span className="text-[10px] text-[#4ADE80] bg-[rgba(34,197,94,0.18)] px-1.5 py-0.5 rounded font-mono-avionics font-bold">ALL CLEAR</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                ADS-B receivers across Kathmandu FIR (VNKT) are operating nominally. 100% telemetry synced with OpenSky feeds.
              </p>
            </div>
          )}
        </div>

        {/* User Profile Avatar / Sign In Button */}
        <div className="relative">
          <div className="transition-opacity duration-150 ease-out">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="rounded-full focus:outline-none hover:ring-2 hover:ring-[#108AEF]/50 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer"
                aria-label="User account menu"
              >
                <Avatar
                  size="sm"
                  className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.08] text-[#FAFAFA] font-semibold text-xs flex items-center justify-center shadow-sm"
                >
                  <Avatar.Fallback>{userInitial}</Avatar.Fallback>
                </Avatar>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal("login")}
                className="h-9 px-4 rounded-full bg-transparent hover:bg-white/[0.06] border border-white/[0.08] text-[#A1A1AA] hover:text-[#FAFAFA] text-xs font-semibold flex items-center space-x-1.5 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* Authenticated User Menu Dropdown */}
          {isAuthenticated && showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 p-2 rounded-xl bg-[#111113] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.35),0_12px_32px_rgba(0,0,0,0.45)] z-50 transition-all duration-240 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="px-2.5 py-2 border-b border-white/[0.08] mb-1">
                <div className="text-xs font-semibold text-[#FAFAFA] truncate">{displayName}</div>
                <div className="text-[10px] text-[#A1A1AA] truncate">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setShowUserMenu(false);
                  await logout();
                }}
                className="w-full justify-start py-2 px-3 text-xs text-[#FB7185] hover:bg-[rgba(244,63,94,0.18)] rounded-xl flex items-center space-x-2 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
