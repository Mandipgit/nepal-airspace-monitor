"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { NormalizedFlight, NepalAircraft, createNormalizedFlightFromNepalAircraft } from "@/types/flight";
import { AirportSummary } from "@/types/airport";
import { fetchNepalAircraftFleet } from "@/lib/api";

export interface GlobalSearchProps {
  flights: NormalizedFlight[];
  airports: AirportSummary[];
  onSelectFlight: (flight: NormalizedFlight) => void;
  onSelectAirport: (ident: string) => void;
  onCenterFlight?: (flight: NormalizedFlight) => void;
  onCenterAirport?: (lat: number, lon: number) => void;
  className?: string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  flights,
  airports,
  onSelectFlight,
  onSelectAirport,
  onCenterFlight,
  onCenterAirport,
  className = "",
}) => {
  const [query, setQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [nepalDbResults, setNepalDbResults] = useState<NepalAircraft[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global Ctrl+K / Cmd+K shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. Live Flights Search (matches model, ICAO/hex, callsign, registration, operator)
  const matchedFlights = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    return flights
      .filter((f) => {
        const callsign = (f.identification.callsign || "").toLowerCase();
        const flightNum = (f.identification.flight_number || "").toLowerCase();
        const reg = (f.identification.registration || "").toLowerCase();
        const icaoHex = (f.identification.icao24 || "").toLowerCase();
        const typecode = (f.identification.aircraft_type_icao || "").toLowerCase();
        const model = (f.aircraft_spec?.model || "").toLowerCase();
        const operator = (f.identification.operator_name || "").toLowerCase();

        return (
          callsign.includes(q) ||
          flightNum.includes(q) ||
          reg.includes(q) ||
          icaoHex.includes(q) ||
          typecode.includes(q) ||
          model.includes(q) ||
          operator.includes(q)
        );
      })
      .slice(0, 5);
  }, [flights, query]);

  // 2. Nepal Airports Search (matches ICAO, IATA, airport name, municipality)
  const matchedAirports = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    return airports
      .filter((a) => {
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
      .slice(0, 5);
  }, [airports, query]);

  // 3. Nepal Aircraft Database Search (operator, registration/callsign, model, hex)
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setNepalDbResults([]);
      setIsLoadingDb(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsLoadingDb(true);
      try {
        const res = await fetchNepalAircraftFleet({ query: q, limit: 6 });
        setNepalDbResults(res.aircraft || []);
      } catch (err) {
        console.warn("Could not fetch matching Nepal aircraft:", err);
        setNepalDbResults([]);
      } finally {
        setIsLoadingDb(false);
      }
    }, 220);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // Combined flat list for keyboard arrow navigation
  const allResults = useMemo(() => {
    const list: Array<{
      type: "flight" | "airport" | "nepal_aircraft";
      data: NormalizedFlight | AirportSummary | NepalAircraft;
    }> = [];

    matchedFlights.forEach((f) => list.push({ type: "flight", data: f }));
    matchedAirports.forEach((a) => list.push({ type: "airport", data: a }));
    nepalDbResults.forEach((ac) => list.push({ type: "nepal_aircraft", data: ac }));

    return list;
  }, [matchedFlights, matchedAirports, nepalDbResults]);

  const handleSelectResult = useCallback(
    (item: { type: "flight" | "airport" | "nepal_aircraft"; data: any }) => {
      if (item.type === "flight") {
        const flight = item.data as NormalizedFlight;
        onSelectFlight(flight);
        if (onCenterFlight) {
          onCenterFlight(flight);
        }
      } else if (item.type === "airport") {
        const airport = item.data as AirportSummary;
        onSelectAirport(airport.ident);
        if (onCenterAirport && airport.latitude_deg && airport.longitude_deg) {
          onCenterAirport(airport.latitude_deg, airport.longitude_deg);
        }
      } else if (item.type === "nepal_aircraft") {
        const nepalAc = item.data as NepalAircraft;
        // Check if aircraft is currently active in live tracked airspace
        const activeFlight = flights.find(
          (f) =>
            (f.identification.icao24 &&
              f.identification.icao24.toLowerCase() === (nepalAc.icao24 || "").toLowerCase()) ||
            (f.identification.registration &&
              f.identification.registration.toUpperCase() === (nepalAc.registration || "").toUpperCase())
        );

        if (activeFlight) {
          onSelectFlight(activeFlight);
          if (onCenterFlight) {
            onCenterFlight(activeFlight);
          }
        } else {
          // Construct normalized flight from DB record
          const flightObj = createNormalizedFlightFromNepalAircraft(nepalAc);
          onSelectFlight(flightObj);
        }
      }

      setIsOpen(false);
      setQuery("");
      inputRef.current?.blur();
    },
    [flights, onSelectFlight, onSelectAirport, onCenterFlight, onCenterAirport]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || allResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allResults.length) {
        handleSelectResult(allResults[selectedIndex]);
      } else if (allResults.length > 0) {
        handleSelectResult(allResults[0]);
      }
    }
  };

  const hasAnyResults = allResults.length > 0;
  const isQueryActive = query.trim().length > 0;

  return (
    <div ref={containerRef} className={`relative select-none font-sans ${className}`}>
      {/* Search Input Container - Clean HeroUI-style pill without rightmost icon */}
      <div className="relative flex items-center">
        <div className="relative w-56 sm:w-64 md:w-72 transition-all duration-300">
          <div className="relative flex items-center w-full h-8 bg-white/[0.05] hover:bg-white/[0.09] focus-within:bg-[#141416] border border-white/[0.08] focus-within:border-white/25 rounded-full px-3 shadow-inner transition-all">
            <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0 select-none pointer-events-none mr-2" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search flights, airports, 9N fleet..."
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(-1);
                if (!isOpen) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-xs font-sans text-neutral-100 placeholder:text-neutral-500 font-normal focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Elevated Dropdown Panel */}
      {isOpen && isQueryActive && (
        <div className="absolute top-10 right-0 w-80 sm:w-96 md:w-[420px] max-h-[460px] overflow-y-auto bg-[#111113]/98 border border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.65)] rounded-2xl backdrop-blur-xl p-2 z-50 font-sans">
          {!hasAnyResults && !isLoadingDb && (
            <div className="py-8 px-4 text-center">
              <Search className="w-6 h-6 text-neutral-600 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-semibold text-neutral-300">No aviation matches found</p>
              <p className="text-[11px] text-neutral-500 mt-1">
                Try searching by aircraft model, 9N registration, operator (e.g. Buddha Air), or airport code (e.g. VNKT / KTM).
              </p>
            </div>
          )}

          {/* Section 1: Live Airspace Traffic (No green blinking dot) */}
          {matchedFlights.length > 0 && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-sans border-b border-white/5 mb-1">
                <span>Live Airspace Traffic</span>
                <span className="font-mono text-[9px] text-neutral-500">
                  {matchedFlights.length} ACTIVE
                </span>
              </div>

              <div className="space-y-0.5">
                {matchedFlights.map((f, idx) => {
                  const globalIdx = idx;
                  const isHighlighted = selectedIndex === globalIdx;
                  const callsign = f.identification.callsign || f.identification.icao24;
                  const flightNum = f.identification.flight_number;
                  const operator = f.identification.operator_name || "Commercial Flight";
                  const model = f.aircraft_spec?.model || f.identification.aircraft_type_icao || "Aircraft";
                  const reg = f.identification.registration;
                  const altFt = f.position.altitude_baro_ft;
                  const speedKts = f.position.groundspeed_kts;

                  const callsignUpper = (f.identification.callsign || "").trim().toUpperCase();
                  const regUpper = (f.identification.registration || "").trim().toUpperCase();
                  const opUpper = (f.identification.operator_icao || "").trim().toUpperCase();
                  const originLower = (f.identification.origin_country || "").trim().toLowerCase();

                  const isNepalFlight =
                    Boolean(f.identification.is_nepal_registered) ||
                    originLower === "nepal" ||
                    callsignUpper.startsWith("9N") ||
                    callsignUpper.startsWith("9-N") ||
                    regUpper.startsWith("9N") ||
                    regUpper.startsWith("9-N") ||
                    ["BHA", "NYT", "SHA", "RNA", "HRA", "TRA", "SMT", "GKR", "HIM", "GBL"].includes(opUpper) ||
                    ["BHA", "NYT", "SHA", "RNA", "HRA", "TRA", "SMT", "GKR", "HIM", "GBL"].some((prefix) =>
                      callsignUpper.startsWith(prefix)
                    );

                  const flightNoColor = isNepalFlight ? "text-emerald-400" : "text-yellow-400";

                  return (
                    <div
                      key={`flight-${f.id}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectResult({ type: "flight", data: f })}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left cursor-pointer transition-colors ${
                        isHighlighted
                          ? "bg-white/10 text-white"
                          : "hover:bg-white/[0.06] text-neutral-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-xs font-bold font-sans truncate ${flightNoColor}`}>
                            {callsign}
                          </span>
                          {flightNum && flightNum !== callsign && (
                            <span className={`text-[10px] font-mono ${flightNoColor} opacity-90`}>
                              ({flightNum})
                            </span>
                          )}
                          {isNepalFlight && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              9N
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-sans truncate mt-0.5">
                          {operator} • {model} {reg && `• ${reg}`}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {f.position.on_ground ? (
                          <span className="text-[10px] font-mono text-neutral-400">On Ground</span>
                        ) : (
                          <div className="text-[10px] font-mono text-neutral-300">
                            <div>{altFt ? `${altFt.toLocaleString()} ft` : "Airborne"}</div>
                            {speedKts && <div className="text-neutral-500">{speedKts} kts</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Nepal Airports (No icons beside title or items) */}
          {matchedAirports.length > 0 && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-sans border-b border-white/5 mb-1">
                <span>NEPAL AIRPORTS</span>
                <span className="font-mono text-[9px] text-neutral-500">
                  {matchedAirports.length} MATCH{matchedAirports.length === 1 ? "" : "ES"}
                </span>
              </div>

              <div className="space-y-0.5">
                {matchedAirports.map((a, idx) => {
                  const globalIdx = matchedFlights.length + idx;
                  const isHighlighted = selectedIndex === globalIdx;

                  return (
                    <div
                      key={`airport-${a.ident}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectResult({ type: "airport", data: a })}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left cursor-pointer transition-colors ${
                        isHighlighted
                          ? "bg-white/10 text-white"
                          : "hover:bg-white/[0.06] text-neutral-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold font-sans text-neutral-100 truncate">
                            {a.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-400 font-sans truncate mt-0.5">
                          {a.municipality || "Nepal"} • {a.type?.replace(/_/g, " ") || "Aerodrome"}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0 font-mono">
                        {a.iata_code && (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white/10 border border-white/15 text-neutral-200">
                            {a.iata_code}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white/5 border border-white/10 text-neutral-300">
                          {a.ident}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Nepal Fleet (CAAN REGISTRY) (No icons, existing typography) */}
          {nepalDbResults.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-sans border-b border-white/5 mb-1">
                <span>Nepal Fleet (CAAN REGISTRY)</span>
                <span className="font-mono text-[9px] text-neutral-500">
                  {nepalDbResults.length} FLEET
                </span>
              </div>

              <div className="space-y-0.5">
                {nepalDbResults.map((ac, idx) => {
                  const globalIdx = matchedFlights.length + matchedAirports.length + idx;
                  const isHighlighted = selectedIndex === globalIdx;

                  // Check if live
                  const isLiveInAirspace = flights.some(
                    (f) =>
                      (f.identification.icao24 &&
                        f.identification.icao24.toLowerCase() === (ac.icao24 || "").toLowerCase()) ||
                      (f.identification.registration &&
                        f.identification.registration.toUpperCase() === (ac.registration || "").toUpperCase())
                  );

                  return (
                    <div
                      key={`nepal-ac-${ac.registration || ac.icao24}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectResult({ type: "nepal_aircraft", data: ac })}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left cursor-pointer transition-colors ${
                        isHighlighted
                          ? "bg-white/10 text-white"
                          : "hover:bg-white/[0.06] text-neutral-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold font-sans text-neutral-100 truncate">
                            {ac.registration || ac.icao24}
                          </span>
                          <span className="text-xs font-normal font-sans text-neutral-300 truncate">
                            {ac.operator || "Nepal Airline"}
                          </span>
                          {isLiveInAirspace && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-white/10 text-neutral-300 border border-white/15">
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-sans truncate mt-0.5">
                          {ac.model || ac.typecode || "Airframe"} • MSN {ac.serial_number || "N/A"}{" "}
                          {ac.built_year && `• Built ${ac.built_year}`}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-neutral-400 block uppercase">
                          {ac.typecode || "CAAN"}
                        </span>
                        <span className="text-[9px] text-neutral-500 font-sans block">
                          View Specs
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Footer Keyboard Navigation Guide */}
          <div className="mt-2 pt-2 border-t border-white/5 px-2 flex items-center justify-between text-[10px] text-neutral-500 font-sans">
            <span>
              Use <kbd className="font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded">↑</kbd>{" "}
              <kbd className="font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded">↓</kbd> to navigate
            </span>
            <span className="flex items-center space-x-1">
              <span>Select</span>
              <CornerDownLeft className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
