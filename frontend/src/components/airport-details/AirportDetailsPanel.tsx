"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button, Tooltip } from "@heroui/react";
import { AirportDetail, AirportSummary, Runway } from "@/types/airport";
import { fetchAirportDetail, fetchAirportRunways } from "@/lib/api";
import { getUserFriendlyErrorMessage } from "@/lib/errors";
import {
  X,
  MapPin,
  Compass,
  Layers,
  Crosshair,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Building2,
  Navigation,
  Sparkles,
} from "lucide-react";

export interface AirportDetailsPanelProps {
  airportIdent: string | null;
  onClose: () => void;
  onCenterAirport?: (airport: AirportDetail | AirportSummary) => void;
  isSidebarOpen?: boolean;
}

interface SpecExplanation {
  meaning: string;
  field: string;
  layman: string;
}

export const AIRPORT_SPEC_EXPLANATIONS: Record<string, SpecExplanation> = {
  ident: {
    meaning: "ICAO Aerodrome Designator",
    field: "ICAO IDENT",
    layman: "A 4-character alphanumeric code assigned by the International Civil Aviation Organization to uniquely identify the aerodrome worldwide for flight planning and air traffic control.",
  },
  iata: {
    meaning: "IATA Commercial Code",
    field: "IATA CODE",
    layman: "A 3-letter commercial identification code assigned by the International Air Transport Association, primarily used in airline timetables, passenger booking systems, and baggage handling.",
  },
  elevation: {
    meaning: "Aerodrome Elevation",
    field: "FIELD ELEVATION",
    layman: "The highest point of the aerodrome's usable landing area measured above Mean Sea Level (MSL), essential for calculating aircraft takeoff distance and mountain obstacle clearance.",
  },
  type: {
    meaning: "Aerodrome Classification",
    field: "CLASSIFICATION",
    layman: "Operational classification of the facility based on runway infrastructure, service capability, and air traffic handling (e.g., international hub, medium regional, or short takeoff STOL field).",
  },
  coordinates: {
    meaning: "Geographic Reference Coordinates",
    field: "COORDINATES",
    layman: "Exact geodetic latitude and longitude indicating the designated aerodrome reference point on aeronautical navigation charts.",
  },
  scheduled_service: {
    meaning: "Scheduled Commercial Service",
    field: "COMMERCIAL SERVICE",
    layman: "Specifies whether regular scheduled passenger airline flights operate at this airport, as opposed to solely charter, cargo, medical evacuation, or private flights.",
  },
  municipality: {
    meaning: "Municipality & District",
    field: "MUNICIPALITY",
    layman: "The official city, municipal division, or administrative region in Nepal where the airport grounds are located.",
  },
  gps_code: {
    meaning: "GPS Navigation Waypoint",
    field: "GPS CODE",
    layman: "Satellite navigation waypoint identifier programmed into aircraft Flight Management Systems (FMS) and onboard GNSS receivers.",
  },
};

export const RUNWAY_SPEC_EXPLANATIONS: Record<string, SpecExplanation> = {
  runway_overview: {
    meaning: "Runway Operational Characteristics",
    field: "RUNWAY",
    layman: "Physical and operational characteristics of the runway including designation, length, width, surface composition, lighting systems, and magnetic orientation for takeoffs and landings.",
  },
  dimensions: {
    meaning: "Runway Physical Dimensions",
    field: "LENGTH / WIDTH",
    layman: "The operational length and width of the paved runway surface available for aircraft takeoff acceleration and landing decelerations, provided in both feet and meters.",
  },
  surface: {
    meaning: "Surface Pavement Composition",
    field: "SURFACE TYPE",
    layman: "The structural material of the runway (e.g. ASP = Asphalt, CON = Concrete, GRASS/TURF = Natural unpaved). Determines permissible aircraft weight and all-weather operational capability.",
  },
  orientation: {
    meaning: "Magnetic Heading & Alignment",
    field: "HEADING (degT)",
    layman: "The magnetic direction of the runway relative to True North. Runway numbers (e.g. 02/20) correspond to the magnetic heading rounded to the nearest 10 degrees.",
  },
  elevation: {
    meaning: "Threshold Elevation",
    field: "THRESHOLD ELEV",
    layman: "The altitude of the runway threshold above Mean Sea Level (MSL), used by pilots to calibrate barometric altimeters on final approach and landing flare.",
  },
  lighting: {
    meaning: "Airfield Lighting System",
    field: "LIGHTING",
    layman: "Indicates whether the runway is equipped with edge, threshold, and approach lighting aids to facilitate night operations and low-visibility instrument approaches.",
  },
  displaced_threshold: {
    meaning: "Displaced Landing Threshold",
    field: "DISPLACED THRESHOLD",
    layman: "A portion of the runway located before the beginning of the landing zone. It may be used for takeoff roll and rollout from the opposite direction, but not for touch-down.",
  },
};

interface AirportDataCardProps {
  label: string;
  fieldKey?: string;
  explanationType?: "airport" | "runway";
  value: React.ReactNode;
  subValue?: React.ReactNode;
  className?: string;
}

const AirportDataCard: React.FC<AirportDataCardProps> = ({
  label,
  fieldKey,
  explanationType = "airport",
  value,
  subValue,
  className = "",
}) => {
  const dictionary =
    explanationType === "airport" ? AIRPORT_SPEC_EXPLANATIONS : RUNWAY_SPEC_EXPLANATIONS;
  const explanation = fieldKey ? dictionary[fieldKey] : undefined;

  return (
    <div
      className={`relative p-2.5 rounded-xl bg-[#141414] border border-white/6 flex flex-col justify-between group hover:border-white/15 transition-colors ${className}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span
          className="text-[10px] text-neutral-400 uppercase tracking-wider block font-sans font-medium truncate"
          title={label}
        >
          {label}
        </span>

        {explanation && (
          <div className="shrink-0">
            <Tooltip closeDelay={100}>
              <Tooltip.Trigger>
                <button
                  type="button"
                  aria-label={`Explanation for ${explanation.meaning}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-sans text-neutral-400 hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  i
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content
                placement="top"
                className="z-[9999] max-w-[280px] p-3 rounded-xl bg-[#18181b]/95 border border-white/20 shadow-2xl backdrop-blur-md text-left"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1.5 gap-2">
                  <span className="text-[11px] font-bold text-neutral-100 font-sans tracking-tight">
                    {explanation.meaning}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 font-semibold shrink-0">
                    {explanation.field}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-300 font-sans leading-relaxed">
                  {explanation.layman}
                </p>
              </Tooltip.Content>
            </Tooltip>
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-bold font-sans text-neutral-100 truncate">
          {value ?? "N/A"}
        </div>
        {subValue && (
          <div className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};

export const AirportDetailsPanel: React.FC<AirportDetailsPanelProps> = ({
  airportIdent,
  onClose,
  onCenterAirport,
  isSidebarOpen = false,
}) => {
  const [airport, setAirport] = useState<AirportDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isRunwaysExpanded, setIsRunwaysExpanded] = useState<boolean>(true);
  const [fetchingRunways, setFetchingRunways] = useState<boolean>(false);

  // Dynamic airport data loader from database via API
  useEffect(() => {
    if (!airportIdent) {
      setAirport(null);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadData() {
      try {
        const data = await fetchAirportDetail(airportIdent!);
        if (!isMounted) return;
        setAirport(data);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        const msg = getUserFriendlyErrorMessage(err, "airports");
        setError(msg);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [airportIdent]);

  // Load / reload runways if requested
  const handleToggleRunways = async () => {
    const nextState = !isRunwaysExpanded;
    setIsRunwaysExpanded(nextState);

    // If expanding and runways list was empty, try fetching specifically from runway endpoint
    if (nextState && airport && (!airport.runways || airport.runways.length === 0)) {
      try {
        setFetchingRunways(true);
        const runwaysData = await fetchAirportRunways(airport.ident);
        if (runwaysData && runwaysData.length > 0) {
          setAirport((prev) => (prev ? { ...prev, runways: runwaysData } : null));
        }
      } catch (err) {
        console.warn("Could not retrieve additional runways:", err);
      } finally {
        setFetchingRunways(false);
      }
    }
  };

  // Copy full airport specifications and runway data
  const handleCopyAirportInfo = useCallback(() => {
    if (!airport) return;
    const lines: string[] = [];
    lines.push("══════════════════════════════════════════════════");
    lines.push(`NEPAL AERODROME & RUNWAY SPECIFICATIONS`);
    lines.push(`Airport: ${airport.name}`);
    lines.push(`ICAO: ${airport.ident}${airport.iata_code ? ` | IATA: ${airport.iata_code}` : ""}`);
    lines.push("══════════════════════════════════════════════════");
    lines.push(`Municipality: ${airport.municipality || "N/A"}`);
    lines.push(`Region: ${airport.iso_region || "N/A"} (${airport.iso_country || "NP"})`);
    lines.push(`Coordinates: ${airport.latitude_deg.toFixed(4)}°N, ${airport.longitude_deg.toFixed(4)}°E`);
    lines.push(`Elevation: ${airport.elevation_ft ? `${airport.elevation_ft.toLocaleString()} ft (${Math.round(airport.elevation_ft * 0.3048)} m MSL)` : "N/A"}`);
    lines.push(`Aerodrome Type: ${airport.type ? airport.type.replace(/_/g, " ").toUpperCase() : "N/A"}`);
    lines.push(`Commercial Service: ${airport.scheduled_service ? "Active Scheduled Service" : "General / Charter"}`);
    if (airport.gps_code) lines.push(`GPS Waypoint: ${airport.gps_code}`);
    if (airport.local_code) lines.push(`Local Code: ${airport.local_code}`);

    const runways = airport.runways || [];
    lines.push("");
    lines.push(`── RUNWAY INFRASTRUCTURE (${runways.length} RECORD${runways.length === 1 ? "" : "S"}) ──`);
    if (runways.length === 0) {
      lines.push("No runway information is available for this airport.");
    } else {
      runways.forEach((r, idx) => {
        lines.push(`[Runway #${idx + 1}: ${r.le_ident || ""}${r.he_ident ? `/${r.he_ident}` : ""}]`);
        lines.push(`  Length × Width: ${r.length_ft ? `${r.length_ft.toLocaleString()} ft × ${r.width_ft || 0} ft` : "N/A"} (${r.length_m || 0} m × ${r.width_m || 0} m)`);
        lines.push(`  Surface: ${r.surface || "Natural / Turf"}`);
        lines.push(`  Status: ${r.closed ? "CLOSED" : "OPERATIONAL"} | Lighting: ${r.lighted ? "LIGHTED" : "UNLIGHTED"}`);
        if (r.le_heading_degt !== null && r.le_heading_degt !== undefined) {
          lines.push(`  Headings: LE ${r.le_heading_degt}° | HE ${r.he_heading_degt ?? "N/A"}°`);
        }
        if (r.le_elevation_ft !== null && r.le_elevation_ft !== undefined) {
          lines.push(`  Threshold Elev: LE ${r.le_elevation_ft} ft | HE ${r.he_elevation_ft ?? "N/A"} ft`);
        }
      });
    }

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [airport]);

  if (!airportIdent) return null;

  // Format aerodrome type label
  const formatAerodromeType = (type: string | null) => {
    if (!type) return "AERODROME";
    return type
      .replace(/_/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <aside
      className={`w-80 md:w-[380px] h-full bg-[#0a0a0a] ${
        isSidebarOpen
          ? "order-last border-l border-r-0 shadow-[-4px_0_24px_rgba(0,0,0,0.5)]"
          : "order-first border-r border-l-0 shadow-[4px_0_24px_rgba(0,0,0,0.3)]"
      } border-white/8 z-25 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300 ease-in-out font-sans`}
    >
      {/* 1. Airport Header */}
      <div className="p-4 border-b border-white/8 bg-[#0e0e0e] shrink-0">
        {/* Top Status Badges & Close Button */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-neutral-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{airport ? formatAerodromeType(airport.type) : "NEPAL AIRPORT"}</span>
            </span>

            {airport?.scheduled_service && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                COMMERCIAL
              </span>
            )}
          </div>

          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onClose}
            aria-label="Close airport details"
            className="w-7 h-7 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-white/5 p-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Airport Header: Large IATA Code / Ident + Full Airport Name Subtitle */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline space-x-2 min-w-0">
              <h2 className="font-sans text-2xl font-black text-neutral-100 tracking-tight truncate">
                {airport?.iata_code ? airport.iata_code : airport?.ident || airportIdent}
              </h2>
              {airport?.iata_code && airport.ident && (
                <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
                  {airport.ident}
                </span>
              )}
            </div>

            <p
              className="text-xs text-neutral-400 font-medium truncate block font-sans mt-0.5"
              title={airport?.name || "Loading airport name..."}
            >
              {airport?.name || "Loading aerodrome specifications..."}
            </p>
          </div>

          {airport && (
            <Tooltip closeDelay={100}>
              <Tooltip.Trigger>
                <button
                  type="button"
                  onClick={handleCopyAirportInfo}
                  className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center shrink-0 mt-0.5"
                  aria-label="Copy airport and runway specifications"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content
                placement="left"
                className="z-[9999] px-2.5 py-1 text-[11px] font-sans font-medium rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-200 shadow-xl"
              >
                {copied ? "All airport details copied!" : "Copy airport & runway specifications"}
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>

        {/* Municipality & Coordinates Sub-bar */}
        {airport && (
          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400 font-sans">
            <span className="truncate pr-2 font-medium flex items-center gap-1 text-neutral-300">
              <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="truncate">{airport.municipality || "Nepal"}</span>
            </span>
            <span className="font-mono text-[11px] text-neutral-500 shrink-0">
              {airport.latitude_deg.toFixed(3)}°N {airport.longitude_deg.toFixed(3)}°E
            </span>
          </div>
        )}
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-2.5 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              Retrieving aerodrome records...
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs">
            <span className="font-bold block mb-1">Aerodrome Notice</span>
            <span>{error}</span>
          </div>
        )}

        {!loading && airport && (
          <>
            {/* 2.1. Airport Project Image (Full Available Width, Visually Balanced 16:9 Aspect) */}
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-white/8 bg-[#141414] shadow-md group">
              <img
                src="/airport_image.jpg"
                alt="Nepal aerodrome facilities and flight operations"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white/95 drop-shadow-md">
                <span className="text-xs font-sans font-bold tracking-tight">
                  {airport.name}
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-emerald-400">
                  {airport.ident}
                </span>
              </div>
            </div>

            {/* 2.2. Airport Specifications Grid */}
            <div>
              <div className="flex items-center space-x-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-sans">
                <Building2 className="w-3 h-3 text-neutral-400" />
                <span>Aerodrome Specifications</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Elevation */}
                <AirportDataCard
                  label="Field Elevation"
                  fieldKey="elevation"
                  explanationType="airport"
                  value={
                    airport.elevation_ft !== null
                      ? `${airport.elevation_ft.toLocaleString()} ft`
                      : "N/A"
                  }
                  subValue={
                    airport.elevation_ft !== null
                      ? `${Math.round(airport.elevation_ft * 0.3048).toLocaleString()} m MSL`
                      : undefined
                  }
                />

                {/* Aerodrome Classification */}
                <AirportDataCard
                  label="Classification"
                  fieldKey="type"
                  explanationType="airport"
                  value={formatAerodromeType(airport.type)}
                  subValue={airport.iso_country ? `Country: ${airport.iso_country}` : undefined}
                />

                {/* Coordinates */}
                <AirportDataCard
                  label="Coordinates"
                  fieldKey="coordinates"
                  explanationType="airport"
                  value={`${airport.latitude_deg.toFixed(4)}°N`}
                  subValue={`${airport.longitude_deg.toFixed(4)}°E`}
                />

                {/* Commercial Service */}
                <AirportDataCard
                  label="Air Service"
                  fieldKey="scheduled_service"
                  explanationType="airport"
                  value={airport.scheduled_service ? "Commercial" : "Charter / STOL"}
                  subValue={airport.scheduled_service ? "Scheduled Flights" : "Unscheduled Operations"}
                />

                {/* Municipality */}
                <AirportDataCard
                  label="Municipality"
                  fieldKey="municipality"
                  explanationType="airport"
                  value={airport.municipality || "N/A"}
                  subValue={airport.iso_region || undefined}
                />

                {/* GPS Waypoint Code */}
                <AirportDataCard
                  label="GPS Waypoint"
                  fieldKey="gps_code"
                  explanationType="airport"
                  value={airport.gps_code || airport.ident}
                  subValue={airport.local_code ? `Local: ${airport.local_code}` : undefined}
                />
              </div>
            </div>

            {/* 2.3. Runway Information Section with Clear Action Button */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-sans">
                  <Navigation className="w-3 h-3 text-neutral-400" />
                  <span>Runway Infrastructure</span>
                </div>

                {/* Tooltip explanation for the entire runway section */}
                <Tooltip closeDelay={100}>
                  <Tooltip.Trigger>
                    <button
                      type="button"
                      aria-label="Explanation of runway characteristics"
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-sans text-neutral-400 hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      i
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content
                    placement="top"
                    className="z-[9999] max-w-[280px] p-3 rounded-xl bg-[#18181b]/95 border border-white/20 shadow-2xl backdrop-blur-md text-left"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1.5 gap-2">
                      <span className="text-[11px] font-bold text-neutral-100 font-sans tracking-tight">
                        {RUNWAY_SPEC_EXPLANATIONS.runway_overview.meaning}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 font-semibold shrink-0">
                        {RUNWAY_SPEC_EXPLANATIONS.runway_overview.field}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-300 font-sans leading-relaxed">
                      {RUNWAY_SPEC_EXPLANATIONS.runway_overview.layman}
                    </p>
                  </Tooltip.Content>
                </Tooltip>
              </div>

              {/* Action Button to View Runway Details */}
              <Button
                size="sm"
                variant="ghost"
                onPress={handleToggleRunways}
                className="w-full py-2.5 px-3 rounded-xl bg-[#141414] hover:bg-[#1a1a1a] border border-white/8 text-xs font-semibold text-neutral-200 flex items-center justify-between transition-all cursor-pointer font-sans group"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-bold text-neutral-100">
                    {isRunwaysExpanded ? "Hide Runway Details" : "View Runway Details"}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 group-hover:text-neutral-200">
                    {airport.runways?.length || 0} {airport.runways?.length === 1 ? "runway" : "runways"}
                  </span>
                </div>

                <div className="flex items-center space-x-1 text-neutral-400">
                  {fetchingRunways && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
                  {isRunwaysExpanded ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 transition-transform" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 transition-transform" />
                  )}
                </div>
              </Button>

              {/* Collapsible Runway Information List */}
              {isRunwaysExpanded && (
                <div className="mt-3 space-y-3">
                  {(!airport.runways || airport.runways.length === 0) ? (
                    <div className="p-4 rounded-xl bg-[#141414] border border-white/6 text-center">
                      <p className="text-xs text-neutral-400 font-sans">
                        No runway information is available for this airport.
                      </p>
                    </div>
                  ) : (
                    airport.runways.map((runway: Runway, idx: number) => {
                      const designation =
                        runway.le_ident || runway.he_ident
                          ? `${runway.le_ident || ""}${runway.he_ident ? ` / ${runway.he_ident}` : ""}`
                          : `Runway #${idx + 1}`;

                      const lengthM =
                        runway.length_m ||
                        (runway.length_ft ? Math.round(runway.length_ft * 0.3048) : null);
                      const widthM =
                        runway.width_m ||
                        (runway.width_ft ? Math.round(runway.width_ft * 0.3048) : null);

                      return (
                        <div
                          key={runway.id || idx}
                          className="p-3.5 rounded-xl bg-[#141414] border border-white/8 shadow-md space-y-3"
                        >
                          {/* Runway Card Header */}
                          <div className="flex items-center justify-between border-b border-white/6 pb-2.5">
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xs font-mono font-black text-emerald-400">
                                {runway.le_ident || `${idx + 1}`}
                              </span>
                              <div>
                                <h3 className="text-sm font-bold font-sans text-neutral-100">
                                  Runway {designation}
                                </h3>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {airport.ident} Physical Corridor
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              {runway.closed ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                                  CLOSED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  ACTIVE
                                </span>
                              )}

                              {runway.lighted && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  LIGHTED
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Runway Metrics Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {/* Physical Dimensions */}
                            <AirportDataCard
                              label="Dimensions"
                              fieldKey="dimensions"
                              explanationType="runway"
                              value={
                                runway.length_ft && runway.width_ft
                                  ? `${runway.length_ft.toLocaleString()} × ${runway.width_ft} ft`
                                  : runway.length_ft
                                  ? `${runway.length_ft.toLocaleString()} ft`
                                  : "N/A"
                              }
                              subValue={
                                lengthM && widthM
                                  ? `${lengthM.toLocaleString()} × ${widthM} m`
                                  : lengthM
                                  ? `${lengthM.toLocaleString()} m`
                                  : undefined
                              }
                            />

                            {/* Surface Type */}
                            <AirportDataCard
                              label="Surface Type"
                              fieldKey="surface"
                              explanationType="runway"
                              value={
                                runway.surface
                                  ? runway.surface === "ASP"
                                    ? "Asphalt (ASP)"
                                    : runway.surface === "CON"
                                    ? "Concrete (CON)"
                                    : runway.surface
                                  : "Natural / Turf"
                              }
                              subValue={runway.lighted ? "Edge Lighting" : "Daylight VFR Only"}
                            />

                            {/* Magnetic Orientation */}
                            <AirportDataCard
                              label="Magnetic Heading"
                              fieldKey="orientation"
                              explanationType="runway"
                              value={
                                runway.le_heading_degt !== null &&
                                runway.le_heading_degt !== undefined
                                  ? `${runway.le_heading_degt}°`
                                  : "N/A"
                              }
                              subValue={
                                runway.he_heading_degt !== null &&
                                runway.he_heading_degt !== undefined
                                  ? `Reciprocal: ${runway.he_heading_degt}°`
                                  : undefined
                              }
                            />

                            {/* Threshold Elevation */}
                            <AirportDataCard
                              label="Threshold Elev"
                              fieldKey="elevation"
                              explanationType="runway"
                              value={
                                runway.le_elevation_ft !== null &&
                                runway.le_elevation_ft !== undefined
                                  ? `${runway.le_elevation_ft.toLocaleString()} ft`
                                  : airport.elevation_ft !== null
                                  ? `${airport.elevation_ft.toLocaleString()} ft`
                                  : "N/A"
                              }
                              subValue={
                                runway.he_elevation_ft !== null &&
                                runway.he_elevation_ft !== undefined
                                  ? `HE: ${runway.he_elevation_ft.toLocaleString()} ft`
                                  : undefined
                              }
                            />

                            {/* Displaced Thresholds if available */}
                            {(runway.le_displaced_threshold_ft ||
                              runway.he_displaced_threshold_ft) && (
                              <AirportDataCard
                                label="Disp Threshold"
                                fieldKey="displaced_threshold"
                                explanationType="runway"
                                className="col-span-2"
                                value={
                                  runway.le_displaced_threshold_ft
                                    ? `LE: ${runway.le_displaced_threshold_ft} ft`
                                    : "None on LE"
                                }
                                subValue={
                                  runway.he_displaced_threshold_ft
                                    ? `HE: ${runway.he_displaced_threshold_ft} ft`
                                    : undefined
                                }
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 3. Action Footer (Center on Map) */}
      {airport && onCenterAirport && (
        <div className="p-3 border-t border-white/8 bg-[#0a0a0a] flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onCenterAirport(airport)}
            className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-xs font-semibold text-neutral-200 flex items-center justify-center space-x-1.5 transition-all cursor-pointer font-sans"
          >
            <Crosshair className="w-3.5 h-3.5 text-white" />
            <span>Focus on Map</span>
          </Button>
        </div>
      )}
    </aside>
  );
};

export default AirportDetailsPanel;
