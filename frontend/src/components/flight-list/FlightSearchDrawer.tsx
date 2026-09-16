"use client";

import React, { useState, useMemo } from "react";
import { Button, Chip } from "@heroui/react";
import { NormalizedFlight } from "@/types/flight";
import {
  Search,
  X,
  Shield,
  Radio,
  Plane,
  Compass,
  MapPin,
  ListFilter,
} from "lucide-react";

interface FlightSearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  flights: NormalizedFlight[];
  selectedFlightId: string | null;
  onSelectFlight: (flight: NormalizedFlight) => void;
  loading: boolean;
}

type FilterCategory = "all" | "nepal" | "adsb" | "mlat" | "airborne" | "ground";

export const FlightSearchDrawer: React.FC<FlightSearchDrawerProps> = ({
  isOpen,
  onClose,
  flights,
  selectedFlightId,
  onSelectFlight,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");

  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      const posSource = (flight.identification.position_source || "ADS-B").toUpperCase();
      const isNepal = flight.identification.is_nepal_registered;
      const onGround = flight.position.on_ground;

      // Category filter
      if (activeCategory === "nepal" && !isNepal) return false;
      if (activeCategory === "adsb" && !posSource.includes("ADS-B")) return false;
      if (activeCategory === "mlat" && !posSource.includes("MLAT")) return false;
      if (activeCategory === "airborne" && onGround) return false;
      if (activeCategory === "ground" && !onGround) return false;

      // Text query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const callsign = (flight.identification.callsign || "").toLowerCase();
      const flightNum = (flight.identification.flight_number || "").toLowerCase();
      const operator = (flight.identification.operator_name || "").toLowerCase();
      const icaoHex = flight.identification.icao24.toLowerCase();
      const reg = (flight.identification.registration || "").toLowerCase();
      const type = (flight.identification.aircraft_type_icao || "").toLowerCase();
      const model = (flight.aircraft_spec?.model || "").toLowerCase();

      return (
        callsign.includes(q) ||
        flightNum.includes(q) ||
        operator.includes(q) ||
        icaoHex.includes(q) ||
        reg.includes(q) ||
        type.includes(q) ||
        model.includes(q)
      );
    });
  }, [flights, activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="w-80 md:w-96 h-full glass-panel z-25 flex flex-col shrink-0 select-none overflow-hidden border-r border-white/8 transition-all duration-300 animate-in fade-in slide-in-from-left-4">
      {/* Header with Search */}
      <div className="p-3.5 border-b border-white/8 bg-slate-950/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ListFilter className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Airspace Flight Directory
            </h2>
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onClose}
            aria-label="Close directory"
            className="text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search callsign, airline, hex (e.g. BHA, 70a8)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-xl border border-white/10 focus:outline-none focus:border-cyan-500 transition-colors"
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
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer font-medium ${
              activeCategory === "all"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-white/5"
            }`}
          >
            All ({flights.length})
          </button>
          <button
            onClick={() => setActiveCategory("nepal")}
            className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center space-x-1 cursor-pointer font-medium ${
              activeCategory === "nepal"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-white/5"
            }`}
          >
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Nepal ({flights.filter((f) => f.identification.is_nepal_registered).length})</span>
          </button>
          <button
            onClick={() => setActiveCategory("adsb")}
            className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer font-medium ${
              activeCategory === "adsb"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-white/5"
            }`}
          >
            ADS-B
          </button>
          <button
            onClick={() => setActiveCategory("mlat")}
            className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer font-medium ${
              activeCategory === "mlat"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-white/5"
            }`}
          >
            MLAT
          </button>
          <button
            onClick={() => setActiveCategory("airborne")}
            className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer font-medium ${
              activeCategory === "airborne"
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-white/5"
            }`}
          >
            Airborne ({flights.filter((f) => !f.position.on_ground).length})
          </button>
          <button
            onClick={() => setActiveCategory("ground")}
            className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer font-medium ${
              activeCategory === "ground"
                ? "bg-slate-700/50 text-slate-200 border border-slate-600"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-white/5"
            }`}
          >
            Ground ({flights.filter((f) => f.position.on_ground).length})
          </button>
        </div>
      </div>

      {/* Flight Cards List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 no-scrollbar">
        {loading && flights.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Scanning airspace telemetry...</span>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No aircraft found matching current criteria.
          </div>
        ) : (
          filteredFlights.map((flight) => {
            const isSelected = flight.id === selectedFlightId;
            const isNepal = flight.identification.is_nepal_registered;
            const onGround = flight.position.on_ground;

            const altFt =
              flight.position.altitude_baro_ft ??
              (flight.position.altitude_baro_m
                ? Math.round(flight.position.altitude_baro_m * 3.28084)
                : null);
            const speedKts =
              flight.position.groundspeed_kts ??
              (flight.position.groundspeed_mps
                ? Math.round(flight.position.groundspeed_mps * 1.94384)
                : null);
            const heading =
              flight.position.heading_deg !== null && flight.position.heading_deg !== undefined
                ? Math.round(flight.position.heading_deg)
                : null;

            return (
              <div
                key={flight.id}
                onClick={() => onSelectFlight(flight)}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? "glass-card-active translate-x-1"
                    : "glass-card hover:border-white/15"
                }`}
              >
                {/* Card Top: Callsign, Reg, Origin country */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected
                          ? "bg-cyan-400 shadow-sm shadow-cyan-400 animate-pulse"
                          : isNepal
                          ? "bg-emerald-400"
                          : "bg-amber-400"
                      }`}
                    />
                    <span className="font-mono-avionics text-sm font-bold text-slate-100 tracking-wider truncate">
                      {flight.identification.callsign || flight.identification.icao24.toUpperCase()}
                    </span>
                    {isNepal && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                        9N
                      </span>
                    )}
                    <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono border bg-slate-800/80 text-slate-300 border-slate-700 shrink-0">
                      {flight.identification.position_source || "ADS-B"}
                    </span>
                  </div>

                  <span className="font-mono-avionics text-[10px] text-slate-400 uppercase shrink-0">
                    {flight.identification.icao24}
                  </span>
                </div>

                {/* Card Middle: Airline / Aircraft Model */}
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span className="truncate max-w-[170px] font-medium text-slate-300">
                    {flight.identification.operator_name || (isNepal ? "Domestic Nepal Carrier" : "Commercial Transit")}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[110px] font-mono-avionics">
                    {flight.aircraft_spec?.model || flight.identification.aircraft_type_icao || "Aircraft"}
                  </span>
                </div>

                {/* Card Bottom: Telemetry */}
                <div className="mt-2 pt-2 border-t border-white/6 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-[9px] uppercase font-semibold text-slate-500 block">
                      Altitude
                    </span>
                    <span className="font-mono-avionics font-bold text-cyan-300">
                      {onGround ? "GND" : altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-semibold text-slate-500 block">
                      Speed
                    </span>
                    <span className="font-mono-avionics font-bold text-slate-200">
                      {speedKts !== null ? `${speedKts} kts` : "N/A"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-semibold text-slate-500 block">
                      Heading
                    </span>
                    <div className="flex items-center space-x-1 font-mono-avionics font-bold text-slate-200">
                      <span>{heading !== null ? `${heading}°` : "N/A"}</span>
                      {heading !== null && (
                        <Compass
                          className="w-3 h-3 text-cyan-400 shrink-0"
                          style={{ transform: `rotate(${heading}deg)` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
