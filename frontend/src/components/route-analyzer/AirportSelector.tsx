"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { AirportSummary } from "@/types/airport";
import {
  Search,
  ArrowRightLeft,
  MapPin,
  X,
  Compass,
  Check,
  MousePointerClick,
} from "lucide-react";

interface AirportSelectorProps {
  airports: AirportSummary[];
  departure: AirportSummary | null;
  destination: AirportSummary | null;
  onSelectDeparture: (airport: AirportSummary | null) => void;
  onSelectDestination: (airport: AirportSummary | null) => void;
  onSwapAirports: () => void;
  isMapSelectMode: boolean;
  onToggleMapSelectMode: () => void;
  mapSelectionTarget: "departure" | "destination" | null;
}

export const AirportSelector: React.FC<AirportSelectorProps> = ({
  airports,
  departure,
  destination,
  onSelectDeparture,
  onSelectDestination,
  onSwapAirports,
  isMapSelectMode,
  onToggleMapSelectMode,
  mapSelectionTarget,
}) => {
  const [depQuery, setDepQuery] = useState<string>("");
  const [destQuery, setDestQuery] = useState<string>("");
  const [depDropdownOpen, setDepDropdownOpen] = useState<boolean>(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  const depRef = useRef<HTMLDivElement | null>(null);
  const destRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (depRef.current && !depRef.current.contains(e.target as Node)) {
        setDepDropdownOpen(false);
      }
      if (destRef.current && !destRef.current.contains(e.target as Node)) {
        setDestDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter airports by search term (matching ICAO, IATA, name, or municipality)
  const filterAirports = (query: string, excludeIdent?: string): AirportSummary[] => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Return top major/scheduled airports by default
      return airports
        .filter((a) => a.ident !== excludeIdent)
        .slice(0, 8);
    }
    return airports
      .filter((a) => {
        if (excludeIdent && a.ident === excludeIdent) return false;
        const ident = (a.ident || "").toLowerCase();
        const iata = (a.iata_code || "").toLowerCase();
        const name = (a.name || "").toLowerCase();
        const city = (a.municipality || "").toLowerCase();
        return (
          ident.includes(q) ||
          iata.includes(q) ||
          name.includes(q) ||
          city.includes(q)
        );
      })
      .slice(0, 15);
  };

  const depFiltered = useMemo(
    () => filterAirports(depQuery, destination?.ident),
    [depQuery, destination?.ident, airports]
  );

  const destFiltered = useMemo(
    () => filterAirports(destQuery, departure?.ident),
    [destQuery, departure?.ident, airports]
  );

  const handleSwapClick = () => {
    setIsSwapping(true);
    onSwapAirports();
    setTimeout(() => setIsSwapping(false), 300);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Map Select Mode Action */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA] flex items-center space-x-1.5 font-sans">
          <span>Route Endpoints</span>
        </label>
        <button
          type="button"
          onClick={onToggleMapSelectMode}
          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer ${
            isMapSelectMode
              ? "bg-[#108AEF] text-white border-[#108AEF] shadow-[0_0_12px_rgba(16,138,239,0.35)]"
              : "bg-white/[0.04] text-[#A1A1AA] border-white/[0.08] hover:text-[#FAFAFA] hover:bg-white/[0.08]"
          }`}
        >
          <MousePointerClick className="w-3.5 h-3.5" />
          <span>
            {isMapSelectMode
              ? `Picking ${mapSelectionTarget === "departure" ? "Departure" : "Destination"} on Map`
              : "Select on Map"}
          </span>
        </button>
      </div>

      {/* Airport Inputs Container */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-3">
        {/* Departure Airport Block */}
        <div ref={depRef} className="relative w-full">
          <span className="block text-[11px] font-semibold uppercase text-[#71717A] tracking-wider mb-1.5">
            Departure
          </span>

          {departure ? (
            /* Selected Card */
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-[#108AEF]/30 hover:border-[#108AEF]/50 transition-colors">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#108AEF]/15 border border-[#108AEF]/25 flex items-center justify-center text-[#108AEF] font-mono font-bold text-xs shrink-0">
                  {departure.iata_code || departure.ident.slice(0, 3)}
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-[#FAFAFA] tracking-tight">
                      {departure.ident}
                    </span>
                    {departure.iata_code && (
                      <span className="text-[10px] font-mono text-[#108AEF] bg-[#108AEF]/10 px-1 rounded">
                        {departure.iata_code}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] truncate">
                    {departure.name}
                  </div>
                  {departure.municipality && (
                    <div className="text-[10px] text-[#71717A]">
                      {departure.municipality}
                      {departure.elevation_ft ? ` • ${departure.elevation_ft.toLocaleString()} ft` : ""}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectDeparture(null);
                  setDepQuery("");
                }}
                className="p-1 rounded-lg text-[#71717A] hover:text-[#FAFAFA] hover:bg-white/[0.08] transition-colors cursor-pointer ml-2 shrink-0"
                title="Change departure airport"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Search Input */
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-[#71717A] pointer-events-none" />
                <input
                  type="text"
                  value={depQuery}
                  onChange={(e) => {
                    setDepQuery(e.target.value);
                    setDepDropdownOpen(true);
                  }}
                  onFocus={() => setDepDropdownOpen(true)}
                  placeholder="Search departure (e.g. VNKT, KTM, Pokhara)..."
                  className="w-full bg-[#18181B] text-xs text-[#FAFAFA] placeholder-[#71717A] pl-9 pr-3 py-2.5 rounded-xl border border-white/[0.08] focus:border-[#108AEF] focus:outline-none transition-colors"
                />
              </div>

              {/* Dropdown Results */}
              {depDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-56 overflow-y-auto rounded-xl bg-[#18181B] border border-white/[0.12] shadow-2xl p-1 space-y-0.5">
                  {depFiltered.length > 0 ? (
                    depFiltered.map((apt) => (
                      <button
                        key={apt.ident}
                        type="button"
                        onClick={() => {
                          onSelectDeparture(apt);
                          setDepDropdownOpen(false);
                          setDepQuery("");
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors cursor-pointer group"
                      >
                        <div className="truncate">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-semibold text-[#FAFAFA] group-hover:text-[#108AEF] transition-colors">
                              {apt.ident}
                            </span>
                            {apt.iata_code && (
                              <span className="text-[10px] font-mono text-[#108AEF] bg-[#108AEF]/10 px-1 rounded">
                                {apt.iata_code}
                              </span>
                            )}
                            <span className="text-[11px] text-[#A1A1AA] truncate">
                              {apt.name}
                            </span>
                          </div>
                          {apt.municipality && (
                            <div className="text-[10px] text-[#71717A]">
                              {apt.municipality}
                              {apt.elevation_ft ? ` • ${apt.elevation_ft.toLocaleString()} ft` : ""}
                            </div>
                          )}
                        </div>
                        <Compass className="w-3.5 h-3.5 text-[#71717A] opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-[#71717A]">
                      No Nepal airports matched &ldquo;{depQuery}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Swap Airports Button */}
        <div className="flex justify-center md:pt-5">
          <button
            type="button"
            onClick={handleSwapClick}
            disabled={!departure && !destination}
            className={`w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-[#108AEF]/40 text-[#A1A1AA] hover:text-[#FAFAFA] flex items-center justify-center transition-all duration-200 active:scale-[0.92] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isSwapping ? "rotate-180 text-[#108AEF] border-[#108AEF]" : ""
            }`}
            title="Swap departure and destination"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Airport Block */}
        <div ref={destRef} className="relative w-full">
          <span className="block text-[11px] font-semibold uppercase text-[#71717A] tracking-wider mb-1.5">
            Destination
          </span>

          {destination ? (
            /* Selected Card */
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-[#FB7185]/30 hover:border-[#FB7185]/50 transition-colors">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#FB7185]/15 border border-[#FB7185]/25 flex items-center justify-center text-[#FB7185] font-mono font-bold text-xs shrink-0">
                  {destination.iata_code || destination.ident.slice(0, 3)}
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-[#FAFAFA] tracking-tight">
                      {destination.ident}
                    </span>
                    {destination.iata_code && (
                      <span className="text-[10px] font-mono text-[#FB7185] bg-[#FB7185]/10 px-1 rounded">
                        {destination.iata_code}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] truncate">
                    {destination.name}
                  </div>
                  {destination.municipality && (
                    <div className="text-[10px] text-[#71717A]">
                      {destination.municipality}
                      {destination.elevation_ft ? ` • ${destination.elevation_ft.toLocaleString()} ft` : ""}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectDestination(null);
                  setDestQuery("");
                }}
                className="p-1 rounded-lg text-[#71717A] hover:text-[#FAFAFA] hover:bg-white/[0.08] transition-colors cursor-pointer ml-2 shrink-0"
                title="Change destination airport"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Search Input */
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-[#71717A] pointer-events-none" />
                <input
                  type="text"
                  value={destQuery}
                  onChange={(e) => {
                    setDestQuery(e.target.value);
                    setDestDropdownOpen(true);
                  }}
                  onFocus={() => setDestDropdownOpen(true)}
                  placeholder="Search destination (e.g. VNPK, PKR, Lukla)..."
                  className="w-full bg-[#18181B] text-xs text-[#FAFAFA] placeholder-[#71717A] pl-9 pr-3 py-2.5 rounded-xl border border-white/[0.08] focus:border-[#FB7185] focus:outline-none transition-colors"
                />
              </div>

              {/* Dropdown Results */}
              {destDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-56 overflow-y-auto rounded-xl bg-[#18181B] border border-white/[0.12] shadow-2xl p-1 space-y-0.5">
                  {destFiltered.length > 0 ? (
                    destFiltered.map((apt) => (
                      <button
                        key={apt.ident}
                        type="button"
                        onClick={() => {
                          onSelectDestination(apt);
                          setDestDropdownOpen(false);
                          setDestQuery("");
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors cursor-pointer group"
                      >
                        <div className="truncate">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-semibold text-[#FAFAFA] group-hover:text-[#FB7185] transition-colors">
                              {apt.ident}
                            </span>
                            {apt.iata_code && (
                              <span className="text-[10px] font-mono text-[#FB7185] bg-[#FB7185]/10 px-1 rounded">
                                {apt.iata_code}
                              </span>
                            )}
                            <span className="text-[11px] text-[#A1A1AA] truncate">
                              {apt.name}
                            </span>
                          </div>
                          {apt.municipality && (
                            <div className="text-[10px] text-[#71717A]">
                              {apt.municipality}
                              {apt.elevation_ft ? ` • ${apt.elevation_ft.toLocaleString()} ft` : ""}
                            </div>
                          )}
                        </div>
                        <Compass className="w-3.5 h-3.5 text-[#71717A] opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-[#71717A]">
                      No Nepal airports matched &ldquo;{destQuery}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
