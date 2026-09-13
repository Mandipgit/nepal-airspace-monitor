"use client";

import React, { useState, useMemo } from "react";
import { Search, Plane, Compass, ArrowUpRight, Shield, MapPin, Gauge } from "lucide-react";
import { NormalizedFlight } from "@/types/flight";

interface FlightListSidebarProps {
  flights: NormalizedFlight[];
  selectedFlightId: string | null;
  onSelectFlight: (flight: NormalizedFlight) => void;
  loading: boolean;
}

type FilterTab = "all" | "nepal" | "adsb" | "mlat" | "uat" | "airborne" | "ground";

export const FlightListSidebar: React.FC<FlightListSidebarProps> = ({
  flights,
  selectedFlightId,
  onSelectFlight,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      const src = (flight.identification.position_source || "ADS-B").toUpperCase();

      // Tab filter
      if (activeTab === "nepal" && !flight.identification.is_nepal_registered) return false;
      if (activeTab === "adsb" && !src.includes("ADS-B")) return false;
      if (activeTab === "mlat" && !src.includes("MLAT")) return false;
      if (activeTab === "uat" && !src.includes("UAT") && !src.includes("OTHER") && !src.includes("FLARM") && !src.includes("ASTERIX")) return false;
      if (activeTab === "airborne" && flight.position.on_ground) return false;
      if (activeTab === "ground" && !flight.position.on_ground) return false;

      // Text query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const callsign = (flight.identification.callsign || "").toLowerCase();
      const flightNum = (flight.identification.flight_number || "").toLowerCase();
      const operator = (flight.identification.operator_name || "").toLowerCase();
      const icao24 = flight.identification.icao24.toLowerCase();
      const type = (flight.identification.aircraft_type_icao || "").toLowerCase();
      const model = (flight.aircraft_spec?.model || "").toLowerCase();
      const pSource = (flight.identification.position_source || "").toLowerCase();

      return (
        callsign.includes(q) ||
        flightNum.includes(q) ||
        operator.includes(q) ||
        icao24.includes(q) ||
        type.includes(q) ||
        model.includes(q) ||
        pSource.includes(q)
      );
    });
  }, [flights, activeTab, searchQuery]);

  // Compute counts for each filter
  const mlatCount = useMemo(() => {
    return flights.filter((f) => (f.identification.position_source || "").toUpperCase().includes("MLAT")).length;
  }, [flights]);

  const adsbCount = useMemo(() => {
    return flights.filter((f) => (f.identification.position_source || "ADS-B").toUpperCase().includes("ADS-B")).length;
  }, [flights]);

  const uatOtherCount = useMemo(() => {
    return flights.filter((f) => {
      const s = (f.identification.position_source || "").toUpperCase();
      return s.includes("UAT") || s.includes("OTHER") || s.includes("FLARM") || s.includes("ASTERIX");
    }).length;
  }, [flights]);

  return (
    <aside className="w-80 md:w-96 flex flex-col h-full bg-slate-950/80 backdrop-blur-2xl border-r border-slate-800/80 shrink-0 z-20 overflow-hidden">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-800/80 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search callsign, airline, hex (e.g. BHA, 70a8, MLAT)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-lg border border-slate-700/80 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px] font-medium no-scrollbar">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "all"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            All ({flights.length})
          </button>
          <button
            onClick={() => setActiveTab("nepal")}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap flex items-center space-x-1 cursor-pointer ${
              activeTab === "nepal"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Nepal ({flights.filter((f) => f.identification.is_nepal_registered).length})</span>
          </button>
          <button
            onClick={() => setActiveTab("adsb")}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "adsb"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            ADS-B ({adsbCount})
          </button>
          <button
            onClick={() => setActiveTab("mlat")}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "mlat"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            MLAT ({mlatCount})
          </button>
          {uatOtherCount > 0 && (
            <button
              onClick={() => setActiveTab("uat")}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "uat"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              UAT/Other ({uatOtherCount})
            </button>
          )}
          <button
            onClick={() => setActiveTab("airborne")}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "airborne"
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Airborne ({flights.filter((f) => !f.position.on_ground).length})
          </button>
          <button
            onClick={() => setActiveTab("ground")}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "ground"
                ? "bg-slate-700/40 text-slate-300 border border-slate-600"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Ground ({flights.filter((f) => f.position.on_ground).length})
          </button>
        </div>
      </div>

      {/* Flight Cards List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1.5">
        {loading && flights.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Scanning Nepalese airspace...</span>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No aircraft matched current filters.
          </div>
        ) : (
          filteredFlights.map((flight) => {
            const isSelected = flight.id === selectedFlightId;
            const isNepal = flight.identification.is_nepal_registered;
            const onGround = flight.position.on_ground;

            // Calculations
            const altFt = flight.position.altitude_baro_m
              ? Math.round(flight.position.altitude_baro_m * 3.28084)
              : null;
            const speedKts = flight.position.groundspeed_mps
              ? Math.round(flight.position.groundspeed_mps * 1.94384)
              : null;
            const heading = flight.position.heading_deg ? Math.round(flight.position.heading_deg) : null;

            return (
              <div
                key={flight.id}
                onClick={() => onSelectFlight(flight)}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? "bg-slate-800/90 border-cyan-400/80 shadow-lg shadow-cyan-950/40 translate-x-1"
                    : "bg-slate-900/60 hover:bg-slate-850 border-slate-800/60 hover:border-slate-700"
                }`}
              >
                {/* Card Top: Callsign, Operator, Reg badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono-avionics text-sm font-bold text-slate-100 tracking-wider">
                      {flight.identification.callsign || flight.identification.icao24.toUpperCase()}
                    </span>
                    {isNepal && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        NP 9N
                      </span>
                    )}
                    {/* Position Surveillance Source Badge */}
                    {(() => {
                      const posSrc = flight.identification.position_source || "ADS-B";
                      let srcClass = "bg-sky-500/20 text-sky-300 border-sky-500/40";
                      if (posSrc.includes("MLAT")) {
                        srcClass = "bg-amber-500/25 text-amber-300 border-amber-500/50 font-semibold";
                      } else if (posSrc.includes("UAT")) {
                        srcClass = "bg-purple-500/25 text-purple-300 border-purple-500/50";
                      } else if (posSrc.includes("FLARM")) {
                        srcClass = "bg-emerald-500/25 text-emerald-300 border-emerald-500/50";
                      } else if (posSrc.includes("ASTERIX")) {
                        srcClass = "bg-blue-500/25 text-blue-300 border-blue-500/50";
                      }
                      return (
                        <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-mono tracking-tight border ${srcClass}`} title={`Surveillance Technology: ${posSrc}`}>
                          {posSrc}
                        </span>
                      );
                    })()}
                    {onGround && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        GND
                      </span>
                    )}
                    {flight.identification.squawk && (
                      <span className="px-1 py-0.2 rounded text-[8px] font-mono-avionics bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                        SQ {flight.identification.squawk}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    {flight.identification.origin_country && !isNepal && (
                      <span className="text-[9px] text-slate-400 px-1 py-0.5 rounded bg-slate-800/60">
                        {flight.identification.origin_country}
                      </span>
                    )}
                    <span className="font-mono-avionics text-[10px] text-slate-400 uppercase">
                      {flight.identification.icao24}
                    </span>
                  </div>
                </div>

                {/* Card Middle: Airline / Aircraft Model */}
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span className="truncate max-w-[180px] font-medium text-slate-300">
                    {flight.identification.operator_name || (isNepal ? "Domestic Nepal Carrier" : "Commercial Transit")}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                    {flight.aircraft_spec?.model || flight.identification.aircraft_type_icao || "Aircraft"}
                  </span>
                </div>

                {/* Card Bottom: Telemetry pills */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-[11px]">
                  {/* Altitude */}
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">Altitude</span>
                    <span className="font-mono-avionics font-bold text-cyan-300">
                      {onGround ? "Ground" : altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}
                    </span>
                  </div>

                  {/* Groundspeed */}
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">Speed</span>
                    <span className="font-mono-avionics font-bold text-slate-200">
                      {speedKts !== null ? `${speedKts} kts` : "N/A"}
                    </span>
                  </div>

                  {/* Heading */}
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">Heading</span>
                    <div className="flex items-center space-x-1 font-mono-avionics font-bold text-slate-200">
                      <span>{heading !== null ? `${heading}°` : "N/A"}</span>
                      {heading !== null && (
                        <Compass
                          className="w-3 h-3 text-slate-400 inline-block"
                          style={{ transform: `rotate(${heading}deg)` }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Proximity Pill if available */}
                {flight.nearest_airport && (
                  <div className="mt-2 text-[10px] text-emerald-400/90 flex items-center gap-1 font-mono-avionics truncate">
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {flight.nearest_airport_distance_km} km to {flight.nearest_airport.split("/")[1] || flight.nearest_airport}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
