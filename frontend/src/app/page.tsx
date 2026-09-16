"use client";

import React, { useState, useCallback, useEffect } from "react";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [syncViewport, setSyncViewport] = useState<boolean>(true);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0d14] text-slate-100 relative">
      {/* 1. Left Application Sidebar / App Drawer */}
      <AppSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(false)}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        flightCount={flights.length}
        syncViewport={syncViewport}
        onToggleSyncViewport={handleToggleSyncViewport}
      />

      {/* 2. Selected Aircraft / Flight Details Panel (Immediately next to sidebar) */}
      {selectedFlight && (
        <FlightDetailsPanel
          flight={selectedFlight}
          onClose={() => setSelectedFlight(null)}
        />
      )}

      {/* 3. Flight Explorer & Search Drawer (Shown when requested via sidebar or shortcut) */}
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

      {/* 4. Interactive Airspace Map (Primary visual surface) */}
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
        />

        {/* Bottom Right Telemetry Drawer / Slider (No bulky icons, clean aviation numbers) */}
        <BottomStatsSlider
          totalFlights={stats.total}
          nepalFlights={stats.nepalRegistered}
          countdown={countdown}
          refreshing={refreshing}
          onRefresh={refetch}
          cacheAge={cacheAge}
          rateLimitRemaining={rateLimitRemaining}
        />

        {/* Connection Notice Pill (Positioned top-center so it never overlaps map buttons or toggles) */}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 glass-panel-floating px-3.5 py-1.5 rounded-full text-xs text-amber-300 flex items-center space-x-2.5 shadow-2xl backdrop-blur-xl border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Connection notice: {error}</span>
            <button
              onClick={() => refetch()}
              className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-850 text-amber-200 text-[10px] font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Mobile View Directory Toggle Button */}
        <div className="absolute bottom-4 left-4 z-20 md:hidden">
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900/95 border border-white/10 text-xs font-bold text-slate-200 shadow-2xl backdrop-blur-lg cursor-pointer"
          >
            <List className="w-4 h-4 text-cyan-400" />
            <span>Flights ({flights.length})</span>
          </button>
        </div>
      </main>

      {/* Global HeroUI Authentication Modal */}
      <AuthModal />
    </div>
  );
}
