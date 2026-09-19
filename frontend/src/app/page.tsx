"use client";

import React, { useState, useCallback, useEffect } from "react";
import { TopBar } from "@/components/common/TopBar";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { FlightDetailsPanel } from "@/components/flight-details/FlightDetailsPanel";
import { FlightSearchDrawer } from "@/components/flight-list/FlightSearchDrawer";
import { BottomStatsSlider } from "@/components/stats/BottomStatsSlider";
import { DynamicFlightMap } from "@/components/map";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { useLiveFlights } from "@/hooks/useLiveFlights";
import { useAirports } from "@/hooks/useAirports";
import { NormalizedFlight } from "@/types/flight";
import { List } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [syncViewport, setSyncViewport] = useState<boolean>(true);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Automatic App Drawer reveal when cursor touches the leftmost boundary of the entire screen
  // and smooth hide when mouse directs away into the map (> 270px)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 8) {
        setIsSidebarOpen(true);
      } else if (e.clientX > 270) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);
  const [viewportBounds, setViewportBounds] = useState<{
    lamin?: number;
    lomin?: number;
    lamax?: number;
    lomax?: number;
  }>({});

  const {
    flights,
    loading,
    refreshing,
    error,
    stats,
    cacheAge,
    countdown,
    rateLimitRemaining,
    refetch,
  } = useLiveFlights({
    enriched: true,
    ...(syncViewport ? viewportBounds : {}),
  });

  // Automatically refetch live flights when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const { airports } = useAirports();

  const [selectedFlight, setSelectedFlight] = useState<NormalizedFlight | null>(null);

  // Sync selected flight with live updates from polling
  useEffect(() => {
    if (selectedFlight) {
      const updated = flights.find((f) => f.id === selectedFlight.id);
      if (updated) {
        setSelectedFlight(updated);
      }
    }
  }, [flights, selectedFlight?.id]);

  const handleSelectFlight = useCallback((flight: NormalizedFlight | null) => {
    setSelectedFlight((prev) => {
      if (!flight || prev?.id === flight.id) {
        return null;
      }
      return flight;
    });
  }, []);

  const handleBoundsChange = useCallback(
    (bounds: { lamin: number; lomin: number; lamax: number; lomax: number }) => {
      setViewportBounds((prev) => {
        if (
          prev.lamin !== undefined &&
          prev.lomin !== undefined &&
          prev.lamax !== undefined &&
          prev.lomax !== undefined &&
          Math.abs(prev.lamin - bounds.lamin) < 0.02 &&
          Math.abs(prev.lomin - bounds.lomin) < 0.02 &&
          Math.abs(prev.lamax - bounds.lamax) < 0.02 &&
          Math.abs(prev.lomax - bounds.lomax) < 0.02
        ) {
          return prev;
        }
        return bounds;
      });
    },
    []
  );

  const handleToggleSyncViewport = useCallback(() => {
    setSyncViewport((prev) => {
      const next = !prev;
      if (!next) {
        setViewportBounds({});
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-neutral-100 relative">
      {/* 1. Dedicated Top Navigation Bar Inspired by Reference Screenshot */}
      <TopBar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={setIsDarkMode}
      />

      {/* 2. Operations Workspace (Sidebar | Flight Details | Live Map) */}
      <div className="flex flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden relative">
        {/* Leftmost Screen Boundary Hover Trigger Strip */}
        <div
          onMouseEnter={() => setIsSidebarOpen(true)}
          className="fixed left-0 top-14 bottom-0 w-3 z-30 pointer-events-auto cursor-pointer"
          aria-hidden="true"
        />

        {/* Left Application Sidebar / App Drawer */}
        <AppSidebar
          isOpen={isSidebarOpen}
          onOpen={() => setIsSidebarOpen(true)}
          onClose={() => setIsSidebarOpen(false)}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
          flightCount={flights.length}
          syncViewport={syncViewport}
          onToggleSyncViewport={handleToggleSyncViewport}
        />

        {/* Selected Aircraft / Flight Details Panel (Immediately next to sidebar) */}
        {selectedFlight && (
          <FlightDetailsPanel
            flight={selectedFlight}
            onClose={() => setSelectedFlight(null)}
          />
        )}

        {/* Flight Explorer & Search Drawer (When requested via sidebar) */}
        {isSearchOpen && (
          <FlightSearchDrawer
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            flights={flights}
            selectedFlightId={selectedFlight?.id ?? null}
            onSelectFlight={(flight) => {
              setSelectedFlight(flight);
            }}
            loading={loading}
          />
        )}

        {/* Interactive Airspace Map (Primary visual surface) */}
        <main className="flex-1 h-full relative overflow-hidden">
          <DynamicFlightMap
            flights={flights}
            airports={airports}
            selectedFlightId={selectedFlight?.id ?? null}
            onSelectFlight={handleSelectFlight}
            onBoundsChange={handleBoundsChange}
            syncViewport={syncViewport}
            onToggleSyncViewport={handleToggleSyncViewport}
            isSidebarOpen={isSidebarOpen}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={setIsDarkMode}
          />

          {/* Bottom Right Telemetry Drawer / Slider */}
          <BottomStatsSlider
            totalFlights={stats.total}
            nepalFlights={stats.nepalRegistered}
            countdown={countdown}
            refreshing={refreshing}
            onRefresh={refetch}
            cacheAge={cacheAge}
            rateLimitRemaining={rateLimitRemaining}
          />

          {/* Connection Notice Pill */}
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/95 px-3.5 py-1.5 rounded-full text-xs text-amber-300 flex items-center space-x-2.5 shadow-2xl backdrop-blur-xl border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Connection notice: {error}</span>
              <button
                onClick={() => refetch()}
                className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-[10px] font-semibold transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Mobile View Directory Toggle Button */}
          <div className="absolute bottom-4 left-4 z-20 md:hidden">
            <button
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs font-bold text-neutral-200 shadow-2xl cursor-pointer"
            >
              <List className="w-4 h-4 text-white" />
              <span>Flights ({flights.length})</span>
            </button>
          </div>
        </main>
      </div>

      {/* Global HeroUI Authentication Modal */}
      <AuthModal />
    </div>
  );
}
