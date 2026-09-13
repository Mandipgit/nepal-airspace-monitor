"use client";

import React, { useState, useCallback } from "react";
import { Header } from "@/components/common/Header";
import { FlightListSidebar } from "@/components/flight-list/FlightListSidebar";
import { DynamicFlightMap } from "@/components/map";
import { FlightDetailsDrawer } from "@/components/flight-details/FlightDetailsDrawer";
import { useLiveFlights } from "@/hooks/useLiveFlights";
import { useAirports } from "@/hooks/useAirports";
import { NormalizedFlight } from "@/types/flight";
import { AlertTriangle, List, Map as MapIcon } from "lucide-react";

export default function Home() {
  const [syncViewport, setSyncViewport] = useState<boolean>(true);
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
    refetch,
  } = useLiveFlights({
    enriched: true,
    ...(syncViewport ? viewportBounds : {}),
  });

  const { airports } = useAirports();

  const [selectedFlight, setSelectedFlight] = useState<NormalizedFlight | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");

  const handleSelectFlight = useCallback((flight: NormalizedFlight | null) => {
    setSelectedFlight((prev) => {
      if (!flight || prev?.id === flight.id) {
        return null;
      }
      return flight;
    });
    // Switch to map view on mobile when a flight is selected
    if (flight && mobileView === "list") {
      setMobileView("map");
    }
  }, [mobileView]);

  const handleBoundsChange = useCallback(
    (bounds: { lamin: number; lomin: number; lamax: number; lomax: number }) => {
      setViewportBounds(bounds);
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <Header
        totalFlights={stats.total}
        nepalFlights={stats.nepalRegistered}
        countdown={countdown}
        refreshing={refreshing}
        onRefresh={refetch}
        cacheAge={cacheAge}
      />

      {/* Network / Provider Error Banner */}
      {error && (
        <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-300 flex items-center justify-between z-40 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Connection degraded: {error}. Retrying automatically...</span>
          </div>
          <button
            onClick={() => refetch()}
            className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Main Workspace (Sidebar + Interactive Map) */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Flight List Sidebar (Desktop visible, Mobile toggled) */}
        <div
          className={`${
            mobileView === "list" ? "flex" : "hidden"
          } md:flex h-full`}
        >
          <FlightListSidebar
            flights={flights}
            selectedFlightId={selectedFlight?.id ?? null}
            onSelectFlight={handleSelectFlight}
            loading={loading}
          />
        </div>

        {/* Map Container */}
        <div
          className={`${
            mobileView === "map" ? "flex" : "hidden"
          } md:flex flex-1 h-full relative`}
        >
          <DynamicFlightMap
            flights={flights}
            airports={airports}
            selectedFlightId={selectedFlight?.id ?? null}
            onSelectFlight={handleSelectFlight}
            onBoundsChange={handleBoundsChange}
            syncViewport={syncViewport}
            onToggleSyncViewport={handleToggleSyncViewport}
          />

          {/* Selected Flight Details Drawer Overlay */}
          <FlightDetailsDrawer
            flight={selectedFlight}
            onClose={() => setSelectedFlight(null)}
          />

          {/* Mobile View Toggle Button */}
          <div className="absolute bottom-4 right-4 z-20 md:hidden">
            <button
              onClick={() => setMobileView(mobileView === "map" ? "list" : "map")}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 shadow-2xl backdrop-blur-lg cursor-pointer"
            >
              {mobileView === "map" ? (
                <>
                  <List className="w-4 h-4 text-cyan-400" />
                  <span>List View ({flights.length})</span>
                </>
              ) : (
                <>
                  <MapIcon className="w-4 h-4 text-emerald-400" />
                  <span>Map View</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
