"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  flightCount?: number;
  syncViewport?: boolean;
  onToggleSyncViewport?: () => void;
  activeNav?: "directory" | "route-analyzer" | "dashboard";
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isOpen,
  onClose,
  onOpen,
  isSearchOpen = false,
  onToggleSearch,
  flightCount = 0,
  activeNav = "dashboard",
}) => {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  // Dynamic user data
  const userInitial = (user?.first_name || user?.email || "G").charAt(0).toUpperCase();
  const displayName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email
    : "Guest User";
  const userEmail = user?.email || (isAuthenticated ? "" : "Not signed in");

  const isRouteAnalyzerActive = activeNav === "route-analyzer";
  const isNepalAircraftActive = activeNav === "nepal-aircraft";
  const isDirectoryActive = !isRouteAnalyzerActive && !isNepalAircraftActive && (activeNav === "directory" || isSearchOpen);

  const handleDirectoryClick = () => {
    if (activeNav === "route-analyzer" || activeNav === "nepal-aircraft") {
      router.push("/");
    } else if (onToggleSearch) {
      onToggleSearch();
    }
  };

  const handleRouteAnalyzerClick = () => {
    if (activeNav !== "route-analyzer") {
      router.push("/route-analyzer");
    }
    if (onClose) {
      onClose();
    }
  };

  const handleNepalAircraftClick = () => {
    if (activeNav !== "nepal-aircraft") {
      router.push("/nepal-aircraft");
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      style={{
        willChange: "transform",
        transition: isOpen
          ? "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)"
          : "transform 260ms cubic-bezier(0.25, 1, 0.5, 1)",
      }}
      className={`fixed left-0 top-14 bottom-0 z-35 w-[268px] flex flex-col justify-between bg-[#111113] border-r border-y border-white/[0.08] shadow-[0_1px_5px_rgba(0,0,0,0.18),0_6px_16px_rgba(0,0,0,0.22)] rounded-r-2xl select-none overflow-hidden font-sans ${
        isOpen
          ? "translate-x-0 pointer-events-auto"
          : "-translate-x-full pointer-events-none"
      }`}
    >
      {/* Top Container */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* User Profile Header Area */}
        <div className="p-4 pb-0 flex flex-col">
          <div className="flex items-center space-x-3">
            {/* Left: Larger circular avatar with dynamic first letter */}
            <div className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.12] text-[#FAFAFA] font-bold text-base flex items-center justify-center shrink-0 shadow-sm select-none">
              {isAuthenticated ? userInitial : "G"}
            </div>

            {/* Adjacent: User name in larger bold text, email underneath as subtitle */}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-[#FAFAFA] tracking-tight truncate font-sans">
                {isAuthenticated ? displayName : "Guest User"}
              </span>
              <span className="text-[11px] text-[#71717A] truncate font-sans">
                {userEmail}
              </span>
            </div>
          </div>

          {/* Thin divider line with horizontal gap from both left and right edges */}
          <div className="mx-1 mt-4 mb-3 border-t border-white/[0.08]" />
        </div>

        {/* Navigation Section */}
        <div className="px-4 pb-4 flex flex-col flex-1">
          {/* Eyebrow label - Slightly bold and bright / clearly visible */}
          <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-neutral-200 mb-3 select-none font-sans">
            NAVIGATION
          </div>

          {/* Navigation list with 4px gap between rows */}
          <div className="flex flex-col gap-1">
            {/* 1. Flight Directory Nav Row (logos removed) */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={handleDirectoryClick}
              className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-sm transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer ${
                isDirectoryActive
                  ? "bg-white/[0.10] text-[#FAFAFA] font-semibold border border-white/[0.08]"
                  : "bg-transparent text-[#A1A1AA] hover:bg-white/[0.06] hover:text-[#FAFAFA] font-medium"
              }`}
            >
              <span className="leading-none">Flight Directory</span>
              {/* Trailing badge */}
              <span
                suppressHydrationWarning
                className={`rounded-full px-2 py-0.5 text-[11px] font-mono-avionics transition-all duration-150 ease-out ${
                  flightCount > 0
                    ? "text-[#4ADE80] bg-[rgba(34,197,94,0.18)] border border-[rgba(34,197,94,0.25)] font-bold"
                    : "text-[#71717A] bg-white/[0.05] border border-white/[0.08]"
                }`}
              >
                {flightCount}
              </span>
            </button>

            {/* 2. Route Analyzer Nav Row (logos removed) */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={handleRouteAnalyzerClick}
              className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-sm transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer ${
                isRouteAnalyzerActive
                  ? "bg-white/[0.10] text-[#FAFAFA] font-semibold border border-white/[0.08]"
                  : "bg-transparent text-[#A1A1AA] hover:bg-white/[0.06] hover:text-[#FAFAFA] font-medium"
              }`}
            >
              <span className="leading-none">Route Analyzer</span>
              {/* Context Badge */}
              <span className="rounded-full px-2 py-0.5 text-[10px] font-mono tracking-wider text-[#108AEF] bg-[#108AEF]/10 border border-[#108AEF]/20 font-semibold uppercase">
                Tool
              </span>
            </button>

            {/* 3. Nepal Aircraft Nav Row */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={handleNepalAircraftClick}
              className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-sm transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer ${
                isNepalAircraftActive
                  ? "bg-white/[0.10] text-[#FAFAFA] font-semibold border border-white/[0.08]"
                  : "bg-transparent text-[#A1A1AA] hover:bg-white/[0.06] hover:text-[#FAFAFA] font-medium"
              }`}
            >
              <span className="leading-none">Nepal Aircraft</span>
              {/* Context Badge */}
              <span className="rounded-full px-2 py-0.5 text-[10px] font-mono tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-semibold uppercase">
                Fleet
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Authentication Action */}
      <div className="p-3 border-t border-white/[0.08] bg-[#111113]">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={async () => {
              if (onClose) onClose();
              await logout();
              router.push("/login");
            }}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-[#FB7185] hover:bg-[rgba(244,63,94,0.14)] border border-transparent hover:border-[#FB7185]/20 flex items-center space-x-2.5 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              openAuthModal("login");
            }}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-[#FAFAFA] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center space-x-2.5 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm"
          >
            <UserIcon className="w-4 h-4 shrink-0 text-[#A1A1AA]" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </aside>
  );
};

