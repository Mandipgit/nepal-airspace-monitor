"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAirports } from "@/hooks/useAirports";
import { AirportSummary } from "@/types/airport";
import {
  AircraftSpecification,
  RouteInformationResponse,
  RouteAircraftAnalysisResponse,
  AircraftAnalysisResult,
} from "@/types/routeAnalyzer";
import {
  fetchAircraftList,
  fetchRouteInformation,
  analyzeRouteAircraft,
} from "@/lib/api";

import { RouteAnalyzerHeader } from "@/components/route-analyzer/RouteAnalyzerHeader";
import { AirportSelector } from "@/components/route-analyzer/AirportSelector";
import { ConditionsInput } from "@/components/route-analyzer/ConditionsInput";
import { AircraftSelector } from "@/components/route-analyzer/AircraftSelector";
import { RouteSummaryCard } from "@/components/route-analyzer/RouteSummaryCard";
import { RouteMap } from "@/components/route-analyzer/RouteMap";
import { AnalysisResultsTable } from "@/components/route-analyzer/AnalysisResultsTable";
import { AircraftDetailModal } from "@/components/route-analyzer/AircraftDetailModal";
import { ComparisonVisualization } from "@/components/route-analyzer/ComparisonVisualization";

import { Play, Sparkles, AlertCircle, RefreshCw, Plane, MapPin } from "lucide-react";

export default function RouteAnalyzerPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Left boundary hover trigger for App Drawer
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 12) {
        setIsSidebarOpen(true);
      } else if (e.clientX > 275) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Airports data
  const { airports, loading: airportsLoading } = useAirports();

const DEFAULT_FALLBACK_FLEET: AircraftSpecification[] = [
  {
    id: 1,
    model: "ATR 72-500",
    icao_type: "AT72",
    category: "regional",
    engine_type: "turboprop",
    passenger_capacity: 72,
    cruise_speed_kts: 276,
    nominal_range_nm: 825,
    takeoff_field_length_m: 1220,
    landing_field_length_m: 1050,
  },
  {
    id: 2,
    model: "Airbus A320-200neo",
    icao_type: "A20N",
    category: "commercial",
    engine_type: "turbofan",
    passenger_capacity: 180,
    cruise_speed_kts: 450,
    nominal_range_nm: 3500,
    takeoff_field_length_m: 1950,
    landing_field_length_m: 1500,
  },
  {
    id: 3,
    model: "Boeing 737-800",
    icao_type: "B738",
    category: "commercial",
    engine_type: "turbofan",
    passenger_capacity: 186,
    cruise_speed_kts: 453,
    nominal_range_nm: 2935,
    takeoff_field_length_m: 2300,
    landing_field_length_m: 1400,
  },
  {
    id: 4,
    model: "DHC-6 Twin Otter",
    icao_type: "DHC6",
    category: "commuter",
    engine_type: "turboprop",
    passenger_capacity: 19,
    cruise_speed_kts: 143,
    nominal_range_nm: 775,
    takeoff_field_length_m: 366,
    landing_field_length_m: 320,
  },
  {
    id: 5,
    model: "Dornier 228-212",
    icao_type: "D228",
    category: "commuter",
    engine_type: "turboprop",
    passenger_capacity: 19,
    cruise_speed_kts: 223,
    nominal_range_nm: 560,
    takeoff_field_length_m: 686,
    landing_field_length_m: 540,
  },
  {
    id: 6,
    model: "Bombardier CRJ700",
    icao_type: "CRJ7",
    category: "regional",
    engine_type: "turbofan",
    passenger_capacity: 78,
    cruise_speed_kts: 447,
    nominal_range_nm: 1378,
    takeoff_field_length_m: 1564,
    landing_field_length_m: 1478,
  },
];

  // Aircraft specifications list
  const [availableAircraft, setAvailableAircraft] = useState<AircraftSpecification[]>(DEFAULT_FALLBACK_FLEET);
  const [aircraftLoading, setAircraftLoading] = useState<boolean>(true);
  const [fleetError, setFleetError] = useState<string | null>(null);

  const loadFleet = useCallback(async () => {
    setAircraftLoading(true);
    setFleetError(null);
    try {
      const res = await fetchAircraftList({ limit: 200 });
      if (res && res.specifications && res.specifications.length > 0) {
        setAvailableAircraft(res.specifications);
      }
    } catch (err: unknown) {
      console.warn("Could not fetch remote aircraft fleet, using local catalog:", err);
      const msg = err instanceof Error ? err.message : "Failed to load aircraft fleet";
      setFleetError(msg);
    } finally {
      setAircraftLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  // Route Configuration State
  const [departure, setDeparture] = useState<AirportSummary | null>(null);
  const [destination, setDestination] = useState<AirportSummary | null>(null);
  const [windKmh, setWindKmh] = useState<number>(0);
  const [descentDistanceKm, setDescentDistanceKm] = useState<number>(50);
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftSpecification[]>([]);

  // Map selection mode
  const [isMapSelectMode, setIsMapSelectMode] = useState<boolean>(false);
  const [mapSelectionTarget, setMapSelectionTarget] = useState<"departure" | "destination" | null>(null);

  // Route Info State (fetched from GET /api/v1/route-analyzer/route)
  const [routeInfo, setRouteInfo] = useState<RouteInformationResponse | null>(null);
  const [routeInfoLoading, setRouteInfoLoading] = useState<boolean>(false);
  const [routeInfoError, setRouteInfoError] = useState<string | null>(null);

  // Analysis State (fetched from POST /api/v1/route-analyzer/analyze)
  const [analysis, setAnalysis] = useState<RouteAircraftAnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Modal inspection
  const [selectedAircraftDetail, setSelectedAircraftDetail] = useState<AircraftAnalysisResult | null>(null);

  // Automatically fetch route information when both departure and destination are set
  const loadRouteInfo = useCallback(async (dep: AirportSummary, dest: AirportSummary) => {
    setRouteInfoLoading(true);
    setRouteInfoError(null);
    setAnalysis(null); // Invalidate previous analysis on route change

    try {
      const data = await fetchRouteInformation(dep.ident, dest.ident);
      setRouteInfo(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load route distance and runway data";
      setRouteInfoError(msg);
      setRouteInfo(null);
    } finally {
      setRouteInfoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (departure && destination) {
      if (departure.ident === destination.ident) {
        setRouteInfoError("Departure and destination cannot be the same airport.");
        setRouteInfo(null);
      } else {
        loadRouteInfo(departure, destination);
      }
    } else {
      setRouteInfo(null);
      setRouteInfoError(null);
      setAnalysis(null);
    }
  }, [departure, destination, loadRouteInfo]);

  // Airport selection handlers
  const handleSelectDeparture = (apt: AirportSummary | null) => {
    setDeparture(apt);
    setAnalysis(null);
  };

  const handleSelectDestination = (apt: AirportSummary | null) => {
    setDestination(apt);
    setAnalysis(null);
  };

  const handleSwapAirports = () => {
    const temp = departure;
    setDeparture(destination);
    setDestination(temp);
    setAnalysis(null);
  };

  // Map select mode toggle
  const handleToggleMapSelectMode = () => {
    if (isMapSelectMode) {
      setIsMapSelectMode(false);
      setMapSelectionTarget(null);
    } else {
      setIsMapSelectMode(true);
      setMapSelectionTarget(departure ? "destination" : "departure");
    }
  };

  const handleAirportMapClick = (apt: AirportSummary) => {
    if (!isMapSelectMode) {
      // If clicked without explicitly toggling select mode, set departure if unset, else destination
      if (!departure) {
        setDeparture(apt);
      } else if (!destination && apt.ident !== departure.ident) {
        setDestination(apt);
      } else {
        setDeparture(apt);
      }
      return;
    }

    if (mapSelectionTarget === "departure") {
      setDeparture(apt);
      if (!destination) {
        setMapSelectionTarget("destination");
      } else {
        setIsMapSelectMode(false);
        setMapSelectionTarget(null);
      }
    } else {
      if (departure && apt.ident === departure.ident) return;
      setDestination(apt);
      setIsMapSelectMode(false);
      setMapSelectionTarget(null);
    }
  };

  // Aircraft multi-selection with composite key matching
  const handleToggleAircraft = (aircraft: AircraftSpecification) => {
    setAnalysis(null); // Invalidate results on fleet change
    setSelectedAircraft((prev) => {
      const isTarget = (a: AircraftSpecification) =>
        (a.id !== undefined && aircraft.id !== undefined && a.id === aircraft.id) ||
        a.model.toLowerCase() === aircraft.model.toLowerCase();

      const exists = prev.some(isTarget);
      if (exists) {
        return prev.filter((a) => !isTarget(a));
      }
      if (prev.length >= 15) return prev;
      return [...prev, aircraft];
    });
  };

  const handleClearAllAircraft = () => {
    setSelectedAircraft([]);
    setAnalysis(null);
  };

  const handleSelectPreset = (fleet: AircraftSpecification[]) => {
    setSelectedAircraft(fleet);
    setAnalysis(null);
  };

  // Execute Route Analysis POST request
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const handleAnalyzeRoute = async () => {
    if (!departure || !destination || selectedAircraft.length === 0) return;

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const requestPayload = {
        departure_ident: departure.ident,
        destination_ident: destination.ident,
        aircraft_identifiers: selectedAircraft.map((a) => a.model),
        wind_kmh: windKmh,
        descent_distance_km: descentDistanceKm,
      };

      const response = await analyzeRouteAircraft(requestPayload);
      setAnalysis(response);

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Route analysis failed";
      setAnalysisError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const canAnalyze =
    departure !== null &&
    destination !== null &&
    departure.ident !== destination.ident &&
    selectedAircraft.length > 0 &&
    !routeInfoLoading &&
    !analyzing;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text-primary)] relative font-sans">
      {/* Operations Workspace */}
      <div className="flex flex-1 w-full h-full overflow-hidden relative">
        {/* Leftmost Screen Boundary Hover Trigger Strip */}
        <div
          onMouseEnter={() => setIsSidebarOpen(true)}
          className="fixed left-0 top-0 bottom-0 w-3.5 z-30 pointer-events-auto cursor-pointer"
          aria-hidden="true"
        />

        {/* Application Drawer / Sidebar */}
        <AppSidebar
          isOpen={isSidebarOpen}
          onOpen={() => setIsSidebarOpen(true)}
          onClose={() => setIsSidebarOpen(false)}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          activeNav="route-analyzer"
        />

        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <RouteAnalyzerHeader />

            {/* Two-Part Workspace Grid (Map & Route Setup) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Interactive Map (7 cols) */}
              <div className="lg:col-span-7 h-[420px] lg:h-[580px] sticky top-0">
                <RouteMap
                  airports={airports}
                  departure={departure}
                  destination={destination}
                  isMapSelectMode={isMapSelectMode}
                  mapSelectionTarget={mapSelectionTarget}
                  onAirportMapClick={handleAirportMapClick}
                  onExitMapSelectMode={() => {
                    setIsMapSelectMode(false);
                    setMapSelectionTarget(null);
                  }}
                />
              </div>

              {/* Right Column: Setup Controls (5 cols) */}
              <div className="lg:col-span-5 space-y-5">
                {/* 1. Airport Endpoints Selector */}
                <div className="p-4 md:p-5 rounded-2xl bg-[#111113] border border-white/[0.08] shadow-xl">
                  <AirportSelector
                    airports={airports}
                    departure={departure}
                    destination={destination}
                    onSelectDeparture={handleSelectDeparture}
                    onSelectDestination={handleSelectDestination}
                    onSwapAirports={handleSwapAirports}
                    isMapSelectMode={isMapSelectMode}
                    onToggleMapSelectMode={handleToggleMapSelectMode}
                    mapSelectionTarget={mapSelectionTarget}
                  />
                </div>

                {/* 2. Route Metrics Preview */}
                {(departure && destination) || routeInfoLoading || routeInfoError ? (
                  <RouteSummaryCard
                    routeInfo={routeInfo}
                    loading={routeInfoLoading}
                    error={routeInfoError}
                    onRetry={() => {
                      if (departure && destination) {
                        loadRouteInfo(departure, destination);
                      }
                    }}
                  />
                ) : (
                  /* Empty State Helper */
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-[#A1A1AA] flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-[#108AEF] shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-[#FAFAFA] block">Select Route Endpoints</span>
                      <span>Pick origin and destination airports via search or by clicking on the map.</span>
                    </div>
                  </div>
                )}

                {/* 3. Meteorological Conditions & Descent */}
                <div className="p-4 md:p-5 rounded-2xl bg-[#111113] border border-white/[0.08] shadow-xl">
                  <ConditionsInput
                    windKmh={windKmh}
                    onChangeWindKmh={(v) => {
                      setWindKmh(v);
                      setAnalysis(null);
                    }}
                    descentDistanceKm={descentDistanceKm}
                    onChangeDescentDistanceKm={(v) => {
                      setDescentDistanceKm(v);
                      setAnalysis(null);
                    }}
                    disabled={analyzing}
                  />
                </div>

                {/* 4. Aircraft Selection */}
                <div className="p-4 md:p-5 rounded-2xl bg-[#111113] border border-white/[0.08] shadow-xl">
                  <AircraftSelector
                    availableAircraft={availableAircraft}
                    selectedAircraft={selectedAircraft}
                    onToggleAircraft={handleToggleAircraft}
                    onClearAll={handleClearAllAircraft}
                    onSelectPreset={handleSelectPreset}
                    loading={aircraftLoading}
                    error={fleetError}
                    onRetry={loadFleet}
                    maxLimit={15}
                  />
                </div>

                {/* 5. Primary CTA Analyze Route Button */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={!canAnalyze}
                    onClick={handleAnalyzeRoute}
                    className={`w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl text-sm font-bold tracking-tight shadow-xl transition-all duration-200 cursor-pointer select-none active:scale-[0.98] ${
                      canAnalyze
                        ? "bg-[#108AEF] hover:bg-[#0070d8] text-white shadow-[0_0_24px_rgba(16,138,239,0.4)]"
                        : "bg-white/[0.06] text-[#71717A] border border-white/[0.08] cursor-not-allowed opacity-60"
                    }`}
                  >
                    {analyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Evaluating Fleet Suitability...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Analyze Route</span>
                      </>
                    )}
                  </button>

                  {!departure || !destination ? (
                    <p className="text-[11px] text-center text-[#71717A]">
                      Select departure and destination airports to unlock analysis.
                    </p>
                  ) : selectedAircraft.length === 0 ? (
                    <p className="text-[11px] text-center text-[#71717A]">
                      Select at least one aircraft specification above.
                    </p>
                  ) : null}
                </div>

                {/* Analysis Error Message */}
                {analysisError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center space-x-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-rose-200">Analysis Error: </span>
                      <span>{analysisError}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Results Section */}
            <div ref={resultsRef} className="pt-2">
              <AnalysisResultsTable
                analysis={analysis}
                loading={analyzing}
                onSelectAircraftDetails={(r) => setSelectedAircraftDetail(r)}
              />
            </div>

            {/* Comparative Charts Section */}
            {analysis && analysis.results.length >= 2 && (
              <ComparisonVisualization
                results={analysis.results}
                routeDistanceKm={analysis.route.distance_km}
              />
            )}
          </div>
        </main>
      </div>

      {/* Deep-Dive Inspection Modal */}
      <AircraftDetailModal
        result={selectedAircraftDetail}
        onClose={() => setSelectedAircraftDetail(null)}
        routeDistanceKm={analysis?.route.distance_km}
      />

      {/* Global Auth Modal */}
      <AuthModal />
    </div>
  );
}
