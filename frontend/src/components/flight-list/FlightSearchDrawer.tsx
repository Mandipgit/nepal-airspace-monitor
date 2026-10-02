"use client";

import React, { useState, useMemo } from "react";
import { NormalizedFlight } from "@/types/flight";
import {
  Search,
  X,
  Compass,
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

  const nepalCount = useMemo(
    () => flights.filter((f) => f.identification.is_nepal_registered).length,
    [flights]
  );
  const airborneCount = useMemo(
    () => flights.filter((f) => !f.position.on_ground).length,
    [flights]
  );
  const groundCount = useMemo(
    () => flights.filter((f) => f.position.on_ground).length,
    [flights]
  );

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

      // Comprehensive search query filtering
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const qNoDash = q.replace(/[-\s]/g, "");

      const callsign = (flight.identification.callsign || "").toLowerCase();
      const flightNum = (flight.identification.flight_number || "").toLowerCase();
      const operatorName = (flight.identification.operator_name || "").toLowerCase();
      const operatorIcao = (flight.identification.operator_icao || "").toLowerCase();
      const icaoHex = (flight.identification.icao24 || "").toLowerCase();
      const reg = (flight.identification.registration || "").toLowerCase();
      const regNoDash = reg.replace(/[-\s]/g, "");
      const typeIcao = (flight.identification.aircraft_type_icao || "").toLowerCase();
      const specModel = (flight.aircraft_spec?.model || "").toLowerCase();
      const originIata = (flight.route?.origin_iata || "").toLowerCase();
      const originIcao = (flight.route?.origin_icao || "").toLowerCase();
      const destIata = (flight.route?.destination_iata || "").toLowerCase();
      const destIcao = (flight.route?.destination_icao || "").toLowerCase();

      return (
        callsign.includes(q) ||
        flightNum.includes(q) ||
        operatorName.includes(q) ||
        operatorIcao.includes(q) ||
        icaoHex.includes(q) ||
        reg.includes(q) ||
        regNoDash.includes(qNoDash) ||
        typeIcao.includes(q) ||
        specModel.includes(q) ||
        originIata.includes(q) ||
        originIcao.includes(q) ||
        destIata.includes(q) ||
        destIcao.includes(q)
      );
    });
  }, [flights, activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="w-80 md:w-[380px] h-full bg-[#111113] z-25 flex flex-col shrink-0 select-none overflow-hidden border-r border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.35),0_12px_32px_rgba(0,0,0,0.45)] font-sans transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]">
      {/* Header with Search & Controls */}
      <div className="p-4 border-b border-white/[0.08] bg-[#111113] space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ListFilter className="w-4 h-4 text-[#108AEF]" />
            <h2 className="text-sm font-semibold text-[#FAFAFA] tracking-tight font-sans">
              Flight Directory
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close directory"
            className="w-7 h-7 rounded-lg text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/[0.06] flex items-center justify-center transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* HeroUI-styled Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search callsign, airline, reg (e.g. BHA, 9N-AMK, KTM)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-[#161618] hover:bg-[#1a1a1d] focus:bg-[#161618] text-[#FAFAFA] placeholder-[#71717A] rounded-xl border border-white/[0.08] focus:border-[#108AEF] transition-all duration-150 ease-out outline-none font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-[#71717A] hover:text-[#FAFAFA] absolute right-2.5 top-1/2 -translate-y-1/2 text-xs cursor-pointer transition-colors duration-150"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* HeroUI-styled Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-xl transition-all duration-150 ease-out whitespace-nowrap cursor-pointer text-xs active:scale-[0.97] ${activeCategory === "all"
              ? "bg-white/[0.12] text-[#FAFAFA] font-semibold border border-white/[0.10] shadow-sm"
              : "bg-white/[0.05] text-[#A1A1AA] hover:bg-white/[0.08] hover:text-[#FAFAFA] border border-white/[0.06] font-medium"
              }`}
          >
            All ({flights.length})
          </button>

          {/* Nepal Filter Button - Clean without shield icon or badge */}
          <button
            type="button"
            onClick={() => setActiveCategory("nepal")}
            className={`px-3 py-1.5 rounded-xl transition-all duration-150 ease-out whitespace-nowrap cursor-pointer text-xs active:scale-[0.97] ${activeCategory === "nepal"
              ? "bg-[rgba(34,197,94,0.18)] text-[#4ADE80] border border-[rgba(34,197,94,0.30)] font-semibold shadow-sm"
              : "bg-white/[0.05] text-[#A1A1AA] hover:bg-white/[0.08] hover:text-[#FAFAFA] border border-white/[0.06] font-medium"
              }`}
          >
            Nepal ({nepalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("adsb")}
            className={`px-3 py-1.5 rounded-xl transition-all duration-150 ease-out whitespace-nowrap cursor-pointer text-xs active:scale-[0.97] ${activeCategory === "adsb"
              ? "bg-white/[0.12] text-[#FAFAFA] font-semibold border border-white/[0.10] shadow-sm"
              : "bg-white/[0.05] text-[#A1A1AA] hover:bg-white/[0.08] hover:text-[#FAFAFA] border border-white/[0.06] font-medium"
              }`}
          >
            ADS-B
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("mlat")}
            className={`px-3 py-1.5 rounded-xl transition-all duration-150 ease-out whitespace-nowrap cursor-pointer text-xs active:scale-[0.97] ${activeCategory === "mlat"
              ? "bg-white/[0.12] text-[#FAFAFA] font-semibold border border-white/[0.10] shadow-sm"
              : "bg-white/[0.05] text-[#A1A1AA] hover:bg-white/[0.08] hover:text-[#FAFAFA] border border-white/[0.06] font-medium"
              }`}
          >
            MLAT
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("airborne")}
            className={`px-3 py-1.5 rounded-xl transition-all duration-150 ease-out whitespace-nowrap cursor-pointer text-xs active:scale-[0.97] ${activeCategory === "airborne"
              ? "bg-white/[0.12] text-[#FAFAFA] font-semibold border border-white/[0.10] shadow-sm"
              : "bg-white/[0.05] text-[#A1A1AA] hover:bg-white/[0.08] hover:text-[#FAFAFA] border border-white/[0.06] font-medium"
              }`}
          >
            Airborne ({airborneCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("ground")}
            className={`px-3 py-1.5 rounded-xl transition-all duration-150 ease-out whitespace-nowrap cursor-pointer text-xs active:scale-[0.97] ${activeCategory === "ground"
              ? "bg-white/[0.12] text-[#FAFAFA] font-semibold border border-white/[0.10] shadow-sm"
              : "bg-white/[0.05] text-[#A1A1AA] hover:bg-white/[0.08] hover:text-[#FAFAFA] border border-white/[0.06] font-medium"
              }`}
          >
            Ground ({groundCount})
          </button>
        </div>
      </div>

      {/* Flight Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar bg-[#0d0d10]">
        {loading && flights.length === 0 ? (
          <div className="p-8 text-center text-[#71717A] text-xs flex flex-col items-center justify-center space-y-3 font-sans">
            <div className="w-6 h-6 border-2 border-[#108AEF] border-t-transparent rounded-full animate-spin" />
            <span>Scanning airspace telemetry...</span>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="p-8 text-center text-[#71717A] text-xs font-sans">
            No aircraft found matching current criteria.
          </div>
        ) : (
          filteredFlights.map((flight) => {
            const isSelected = flight.id === selectedFlightId;
            const callsignUpper = (flight.identification.callsign || "").trim().toUpperCase();
            const regUpper = (flight.identification.registration || "").trim().toUpperCase();
            const opUpper = (flight.identification.operator_icao || "").trim().toUpperCase();
            const originLower = (flight.identification.origin_country || "").trim().toLowerCase();

            const isNepal =
              Boolean(flight.identification.is_nepal_registered) ||
              originLower === "nepal" ||
              callsignUpper.startsWith("9N") ||
              callsignUpper.startsWith("9-N") ||
              regUpper.startsWith("9N") ||
              regUpper.startsWith("9-N") ||
              ["BHA", "NYT", "SHA", "RNA", "HRA", "TRA", "SMT", "GKR", "HIM", "GBL"].includes(opUpper) ||
              ["BHA", "NYT", "SHA", "RNA", "HRA", "TRA", "SMT", "GKR", "HIM", "GBL"].some((prefix) =>
                callsignUpper.startsWith(prefix)
              );
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
                className={`p-3 rounded-xl border transition-all duration-150 ease-out cursor-pointer select-none font-sans active:scale-[0.98] ${isSelected
                  ? "bg-[#1f2025] border-[#108AEF]/60 ring-1 ring-[#108AEF]/40 shadow-md"
                  : "bg-[#161618] hover:bg-[#1c1c20] border-white/[0.08] hover:border-white/[0.14]"
                  }`}
              >
                {/* Card Top: Callsign, Reg, Origin country */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${isSelected
                        ? "bg-[#FAFAFA] shadow-sm shadow-white/40"
                        : isNepal
                          ? "bg-[#4ADE80]"
                          : "bg-[#FACC15]"
                        }`}
                    />
                    <span className={`font-mono-avionics text-sm font-bold tracking-wider truncate ${isNepal ? "text-emerald-400" : "text-yellow-400"}`}>
                      {flight.identification.callsign || flight.identification.icao24.toUpperCase()}
                    </span>
                    {isNepal && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(34,197,94,0.18)] text-[#4ADE80] border border-[rgba(34,197,94,0.25)] shrink-0">
                        9N
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/[0.05] text-[#71717A] border border-white/[0.06] shrink-0">
                      {flight.identification.position_source || "ADS-B"}
                    </span>
                  </div>

                  <span className="font-mono-avionics text-[11px] text-[#71717A] uppercase shrink-0">
                    {flight.identification.icao24}
                  </span>
                </div>

                {/* Card Middle: Airline / Aircraft Model */}
                <div className="mt-1.5 flex items-center justify-between text-xs text-[#A1A1AA]">
                  <span className="truncate max-w-[180px] font-medium text-[#D4D4D8]">
                    {flight.identification.operator_name || flight.identification.operator_icao || (isNepal ? "Nepalese Aviation" : "Unknown Operator")}
                  </span>
                  <span className="text-[11px] text-[#71717A] truncate max-w-[120px] font-mono-avionics">
                    {flight.aircraft_spec?.model || flight.identification.aircraft_type_icao || "Aircraft"}
                  </span>
                </div>

                {/* Card Bottom: Telemetry Grid */}
                <div className="mt-2.5 pt-2 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-[9px] uppercase font-semibold text-[#71717A] block tracking-wider">
                      Altitude
                    </span>
                    <span className="font-mono-avionics font-bold text-[#FAFAFA]">
                      {onGround ? "GND" : altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-semibold text-[#71717A] block tracking-wider">
                      Speed
                    </span>
                    <span className="font-mono-avionics font-bold text-[#FAFAFA]">
                      {speedKts !== null ? `${speedKts} kts` : "N/A"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-semibold text-[#71717A] block tracking-wider">
                      Heading
                    </span>
                    <div className="flex items-center space-x-1 font-mono-avionics font-bold text-[#FAFAFA]">
                      <span>{heading !== null ? `${heading}°` : "N/A"}</span>
                      {heading !== null && (
                        <Compass
                          className="w-3 h-3 text-[#A1A1AA] shrink-0"
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
