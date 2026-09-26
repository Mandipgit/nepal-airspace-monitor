"use client";

import React, { useState, useEffect } from "react";
import { Button, Tooltip } from "@heroui/react";
import { NormalizedFlight, AircraftSpec } from "@/types/flight";
import { fetchAircraftSpec } from "@/lib/api";
import {
  X,
  Plane,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  Radio,
  MapPin,
  Copy,
  Check,
  Crosshair,
  Layers,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { SPEC_EXPLANATIONS } from "@/lib/aircraftSpecs";

interface FlightDetailsPanelProps {
  flight: NormalizedFlight | null;
  onClose: () => void;
  onCenterFlight?: (flight: NormalizedFlight) => void;
  isSidebarOpen?: boolean;
}

interface AircraftDataCardProps {
  label: string;
  fieldKey?: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  className?: string;
  activeTooltip?: string | null;
  setActiveTooltip?: (key: string | null) => void;
  tooltipAlign?: "top" | "bottom";
}

const AircraftDataCard: React.FC<AircraftDataCardProps> = ({
  label,
  fieldKey,
  value,
  subValue,
  className = "",
  activeTooltip,
  setActiveTooltip,
  tooltipAlign,
}) => {
  const explanation = fieldKey ? SPEC_EXPLANATIONS[fieldKey] : undefined;

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

export const FlightDetailsPanel: React.FC<FlightDetailsPanelProps> = ({
  flight,
  onClose,
  onCenterFlight,
  isSidebarOpen = false,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);
  const [detailedSpec, setDetailedSpec] = useState<AircraftSpec | null>(null);
  const [loadingSpec, setLoadingSpec] = useState<boolean>(false);

  useEffect(() => {
    setDetailedSpec(flight?.aircraft_spec || null);
  }, [flight?.identification.icao24, flight?.aircraft_spec]);

  if (!flight) return null;

  const { identification, position, route, aircraft_spec, nepal_aircraft } = flight;
  const nepalAircraft = nepal_aircraft || null;
  const isNepal = identification.is_nepal_registered;
  const onGround = position.on_ground;

  const effectiveSpec = detailedSpec || aircraft_spec;

  const handleToggleDetails = async () => {
    const nextExpanded = !isDetailsExpanded;
    setIsDetailsExpanded(nextExpanded);

    if (nextExpanded && !effectiveSpec) {
      const identifier =
        flight.aircraft_spec?.icao_type ||
        flight.identification.aircraft_type_icao ||
        flight.aircraft_spec?.model ||
        flight.identification.registration ||
        flight.identification.icao24;

      if (identifier) {
        try {
          setLoadingSpec(true);
          const data = await fetchAircraftSpec(identifier);
          if (data) {
            setDetailedSpec(data);
          }
        } catch (err) {
          console.warn("Could not fetch aircraft spec from database table:", err);
        } finally {
          setLoadingSpec(false);
        }
      }
    }
  };

  // Dynamic values & conversions - strictly fallback to N/A when null or undefined
  const altFt =
    position.altitude_baro_ft ??
    (position.altitude_baro_m !== null && position.altitude_baro_m !== undefined
      ? Math.round(position.altitude_baro_m * 3.28084)
      : null);
  const altM =
    position.altitude_baro_m !== null && position.altitude_baro_m !== undefined
      ? Math.round(position.altitude_baro_m)
      : null;

  const speedKts =
    position.groundspeed_kts ??
    (position.groundspeed_mps !== null && position.groundspeed_mps !== undefined
      ? Math.round(position.groundspeed_mps * 1.94384)
      : null);
  const speedKmh =
    position.groundspeed_mps !== null && position.groundspeed_mps !== undefined
      ? Math.round(position.groundspeed_mps * 3.6)
      : null;

  const heading =
    position.heading_deg !== null && position.heading_deg !== undefined
      ? Math.round(position.heading_deg)
      : null;

  const vertRateFpm =
    position.vertical_rate_fpm ??
    (position.vertical_rate_mps !== null && position.vertical_rate_mps !== undefined
      ? Math.round(position.vertical_rate_mps * 196.85)
      : null);

  const callsign = identification.callsign || "N/A";
  const icaoHex = identification.icao24 ? identification.icao24.toUpperCase() : "N/A";
  const flightNum = identification.flight_number || "N/A";
  const registration = identification.registration || "N/A";
  const operatorName = identification.operator_name || "N/A";
  const aircraftType =
    effectiveSpec?.model || identification.aircraft_type_icao || "N/A";

  const originCode = route?.origin_iata || route?.origin_icao || "N/A";
  const originName = route?.origin_name || "N/A";
  const destinationCode = route?.destination_iata || route?.destination_icao || "N/A";
  const destinationName = route?.destination_name || "N/A";

  const squawk = identification.squawk || "N/A";
  const positionSource = identification.position_source || "ADS-B";
  const categoryName = identification.category_name || "N/A";
  const originCountry = identification.origin_country || "N/A";

  // Coordinates
  const latStr =
    position.latitude !== null && position.latitude !== undefined
      ? `${Math.abs(position.latitude).toFixed(4)}°${position.latitude >= 0 ? "N" : "S"}`
      : "N/A";
  const lonStr =
    position.longitude !== null && position.longitude !== undefined
      ? `${Math.abs(position.longitude).toFixed(4)}°${position.longitude >= 0 ? "E" : "W"}`
      : "N/A";

  // Flight phase indicator
  const flightStatusText = onGround
    ? "Ground Operations"
    : vertRateFpm !== null && vertRateFpm > 250
    ? "Climbing"
    : vertRateFpm !== null && vertRateFpm < -250
    ? "Descending"
    : "Cruising / Level";

  const timeUtc = position.timestamp
    ? new Date(position.timestamp).toISOString().substring(11, 19) + " UTC"
    : new Date().toISOString().substring(11, 19) + " UTC";

  // Copy all information of this aircraft displayed in the screen
  const handleCopyAllInformation = () => {
    const lines: string[] = [];

    // Header & Identification
    lines.push("══════════════════════════════════════════════════");
    lines.push(`FLIGHT TELEMETRY & AIRCRAFT SPECIFICATIONS`);
    lines.push(`Flight: ${callsign}${flightNum !== "N/A" && flightNum !== callsign ? ` (${flightNum})` : ""}`);
    lines.push("══════════════════════════════════════════════════");
    lines.push(`Operator: ${operatorName}`);
    lines.push(`Status: ${onGround ? "ON GROUND" : "IN TRANSIT"} (${flightStatusText})`);
    lines.push(`Timestamp: ${timeUtc}`);
    lines.push(`ICAO24 (Hex): ${icaoHex}`);
    lines.push(`Registration: ${registration}`);
    lines.push(`Origin Country: ${originCountry}`);
    lines.push(`Category: ${categoryName}`);
    lines.push(`Surveillance Source: ${positionSource}`);
    lines.push(`Transponder Squawk: ${squawk}`);
    if (flight.data_freshness_seconds !== null && flight.data_freshness_seconds !== undefined) {
      lines.push(`Telemetry Freshness: ${Math.round(flight.data_freshness_seconds)}s ago`);
    }

    // Route
    lines.push("");
    lines.push("── ROUTE ─────────────────────────────────────────");
    lines.push(`Origin: ${originCode} - ${originName}`);
    lines.push(`Destination: ${destinationCode} - ${destinationName}`);

    // Kinematics
    lines.push("");
    lines.push("── FLIGHT KINEMATICS ─────────────────────────────");
    lines.push(`Coordinates: ${latStr}, ${lonStr}`);
    lines.push(`Barometric Altitude: ${altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}${altM !== null ? ` (${altM.toLocaleString()} m MSL)` : ""}`);
    lines.push(`Groundspeed: ${speedKts !== null ? `${speedKts} kts` : "N/A"}${speedKmh !== null ? ` (${speedKmh} km/h)` : ""}`);
    lines.push(`Track Heading: ${heading !== null ? `${heading}°` : "N/A"}`);
    lines.push(`Vertical Rate: ${vertRateFpm !== null ? `${vertRateFpm > 0 ? "+" : ""}${vertRateFpm} fpm` : "N/A"}`);

    // Airspace Proximity
    if (flight.nearest_airport) {
      lines.push("");
      lines.push("── AIRSPACE PROXIMITY ────────────────────────────");
      lines.push(`Nearest Airport: ${flight.nearest_airport}`);
      if (flight.nearest_airport_distance_km !== null && flight.nearest_airport_distance_km !== undefined) {
        lines.push(`Proximity: ${flight.nearest_airport_distance_km} km (${(flight.nearest_airport_distance_km * 0.539957).toFixed(1)} NM)`);
      }
    }

    // Civil Aviation Authority of Nepal (CAAN) Registry (for 9N aircraft)
    if (nepalAircraft) {
      lines.push("");
      lines.push("── CIVIL AVIATION REGISTRY (CAAN 9N) ───────────");
      if (nepalAircraft.registration) lines.push(`Registration: ${nepalAircraft.registration}`);
      if (nepalAircraft.owner) lines.push(`Registered Owner: ${nepalAircraft.owner}`);
      if (nepalAircraft.serial_number) lines.push(`Serial Number (MSN): ${nepalAircraft.serial_number}`);
      if (nepalAircraft.built_year) lines.push(`Year Built: ${nepalAircraft.built_year}`);
      if (nepalAircraft.registered_date) lines.push(`Registration Date: ${nepalAircraft.registered_date}`);
      if (nepalAircraft.reg_until) lines.push(`Certificate Expiry: ${nepalAircraft.reg_until}`);
      if (nepalAircraft.status) lines.push(`Airworthiness Status: ${nepalAircraft.status}`);
      if (nepalAircraft.icao_aircraft_class) lines.push(`ICAO Aircraft Class: ${nepalAircraft.icao_aircraft_class}`);
      if (nepalAircraft.engines) lines.push(`Powerplant Configuration: ${nepalAircraft.engines}`);
      if (nepalAircraft.sel_cal) lines.push(`SELCAL Code: ${nepalAircraft.sel_cal}`);
    }

    // Aircraft Specifications
    lines.push("");
    lines.push("── AIRCRAFT SPECIFICATIONS ───────────────────────");
    lines.push(`Airframe Model: ${effectiveSpec?.model || aircraftType}`);
    lines.push(`ICAO Type Designator: ${effectiveSpec?.icao_type || identification.aircraft_type_icao || "N/A"}`);
    lines.push(`Category: ${effectiveSpec?.category ? effectiveSpec.category.replace(/_/g, " ") : categoryName}`);

    if (effectiveSpec) {
      lines.push(`Engine Type: ${effectiveSpec.engine_type || "N/A"}`);
      lines.push(`Engine Model: ${effectiveSpec.engine_model || "N/A"}`);
      lines.push(`Number of Engines: ${effectiveSpec.number_of_engines ?? "N/A"}`);
      if (effectiveSpec.engine_position) lines.push(`Engine Position: ${effectiveSpec.engine_position}`);
      if (effectiveSpec.engine_y_arm !== undefined && effectiveSpec.engine_y_arm !== null) lines.push(`Engine Lateral Arm (Y-Arm): ${effectiveSpec.engine_y_arm} m`);
      if (effectiveSpec.thruster_type) lines.push(`Thruster Type: ${effectiveSpec.thruster_type}`);
      if (effectiveSpec.bpr !== undefined && effectiveSpec.bpr !== null) lines.push(`Bypass Ratio (BPR): ${effectiveSpec.bpr}`);
      if (effectiveSpec.energy_type) lines.push(`Energy / Fuel Type: ${effectiveSpec.energy_type}`);
      if (effectiveSpec.rotor_diameter !== undefined && effectiveSpec.rotor_diameter !== null) lines.push(`Prop / Rotor Diameter: ${effectiveSpec.rotor_diameter} m`);
      if (effectiveSpec.max_thrust !== undefined && effectiveSpec.max_thrust !== null) lines.push(`Max Takeoff Thrust: ${Math.round(effectiveSpec.max_thrust).toLocaleString()} N (${(effectiveSpec.max_thrust / 1000).toFixed(1)} kN, ${Math.round(effectiveSpec.max_thrust * 0.224809).toLocaleString()} lbf)`);
      if (effectiveSpec.max_power !== undefined && effectiveSpec.max_power !== null) lines.push(`Max Engine Power: ${Math.round(effectiveSpec.max_power).toLocaleString()} kW (${Math.round(effectiveSpec.max_power * 1.34102).toLocaleString()} hp)`);

      // Weights
      lines.push("");
      lines.push("── WEIGHT LIMITATIONS ────────────────────────────");
      if (effectiveSpec.oew_kg) lines.push(`Operating Empty Weight (OEW): ${Math.round(effectiveSpec.oew_kg).toLocaleString()} kg`);
      if (effectiveSpec.mtow_kg) lines.push(`Maximum Takeoff Weight (MTOW): ${Math.round(effectiveSpec.mtow_kg).toLocaleString()} kg`);
      if (effectiveSpec.mlw_kg) lines.push(`Maximum Landing Weight (MLW): ${Math.round(effectiveSpec.mlw_kg).toLocaleString()} kg`);
      if (effectiveSpec.fuel_capacity_liters) lines.push(`Fuel Capacity: ${Math.round(effectiveSpec.fuel_capacity_liters).toLocaleString()} L`);
      if (effectiveSpec.max_fuel) lines.push(`Max Fuel Mass: ${Math.round(effectiveSpec.max_fuel).toLocaleString()} kg`);

      // Performance & Airfield
      lines.push("");
      lines.push("── PERFORMANCE & AIRFIELD ────────────────────────");
      if (effectiveSpec.passenger_capacity) lines.push(`Passenger Capacity: ${effectiveSpec.passenger_capacity} seats`);
      if (effectiveSpec.nominal_range_nm) lines.push(`Nominal Range: ${Math.round(effectiveSpec.nominal_range_nm).toLocaleString()} NM (${Math.round(effectiveSpec.nominal_range_nm * 1.852).toLocaleString()} km)`);
      if (effectiveSpec.approach_speed_kts) lines.push(`Approach Speed: ${effectiveSpec.approach_speed_kts} kts`);
      if (effectiveSpec.cruise_speed_kts) lines.push(`Cruise Speed: ${effectiveSpec.cruise_speed_kts} kts (${Math.round(effectiveSpec.cruise_speed_kts * 1.852)} km/h)`);
      if (effectiveSpec.max_speed_kts) lines.push(`Maximum Speed: ${effectiveSpec.max_speed_kts} kts (${Math.round(effectiveSpec.max_speed_kts * 1.852)} km/h)`);
      if (effectiveSpec.takeoff_field_length_m) lines.push(`Takeoff Field Length (TOFL): ${Math.round(effectiveSpec.takeoff_field_length_m).toLocaleString()} m (${Math.round(effectiveSpec.takeoff_field_length_m * 3.28084).toLocaleString()} ft)`);
      if (effectiveSpec.landing_field_length_m) lines.push(`Landing Field Length (LFL): ${Math.round(effectiveSpec.landing_field_length_m).toLocaleString()} m (${Math.round(effectiveSpec.landing_field_length_m * 3.28084).toLocaleString()} ft)`);

      // Dimensions
      lines.push("");
      lines.push("── AIRFRAME DIMENSIONS & AERODYNAMICS ───────────");
      if (effectiveSpec.wing_span !== undefined && effectiveSpec.wing_span !== null) lines.push(`Wing Span: ${effectiveSpec.wing_span} m (${(effectiveSpec.wing_span * 3.28084).toFixed(1)} ft)`);
      if (effectiveSpec.fuselage_width !== undefined && effectiveSpec.fuselage_width !== null) lines.push(`Fuselage Width: ${effectiveSpec.fuselage_width} m (${(effectiveSpec.fuselage_width * 3.28084).toFixed(1)} ft)`);
      if (effectiveSpec.total_length !== undefined && effectiveSpec.total_length !== null) lines.push(`Total Length: ${effectiveSpec.total_length} m (${(effectiveSpec.total_length * 3.28084).toFixed(1)} ft)`);
      if (effectiveSpec.total_height !== undefined && effectiveSpec.total_height !== null) lines.push(`Total Height: ${effectiveSpec.total_height} m (${(effectiveSpec.total_height * 3.28084).toFixed(1)} ft)`);
      if (effectiveSpec.wing_area !== undefined && effectiveSpec.wing_area !== null) lines.push(`Wing Area: ${effectiveSpec.wing_area} m² (${(effectiveSpec.wing_area * 10.7639).toFixed(1)} ft²)`);
      if (effectiveSpec.wing_sweep25 !== undefined && effectiveSpec.wing_sweep25 !== null) lines.push(`Wing Sweep (25% chord): ${effectiveSpec.wing_sweep25}°`);
      if (effectiveSpec.wing_position) lines.push(`Wing Position: ${effectiveSpec.wing_position}`);
      if (effectiveSpec.htp_area !== undefined && effectiveSpec.htp_area !== null) lines.push(`Horizontal Tail Area (HTP): ${effectiveSpec.htp_area} m²`);
      if (effectiveSpec.vtp_area !== undefined && effectiveSpec.vtp_area !== null) lines.push(`Vertical Tail Area (VTP): ${effectiveSpec.vtp_area} m²`);
    }

    const fullSummary = lines.join("\n");
    navigator.clipboard.writeText(fullSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside
      className={`${
        isDetailsExpanded ? "w-96 md:w-[540px]" : "w-80 md:w-[380px]"
      } h-full bg-[#0a0a0a] ${
        isSidebarOpen
          ? "order-last border-l border-r-0 shadow-[-4px_0_24px_rgba(0,0,0,0.5)]"
          : "order-first border-r border-l-0 shadow-[4px_0_24px_rgba(0,0,0,0.3)]"
      } border-white/8 z-25 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300 ease-in-out font-sans`}
    >
      {/* 1. Panel Header */}
      <div className="p-4 border-b border-white/8 bg-[#0e0e0e] shrink-0">
        {/* Top Status Chip & Close */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-neutral-300">
              {onGround ? "ON GROUND" : "IN TRANSIT"} • {timeUtc}
            </span>
            {isNepal && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                9N
              </span>
            )}
          </div>

          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onClose}
            aria-label="Close details"
            className="w-7 h-7 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-white/5 p-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Flight Identifier & Enhanced Copy Icon */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <h2 className="font-sans text-xl font-black text-neutral-100 tracking-tight truncate">
              {callsign !== "N/A" ? callsign : icaoHex}
            </h2>
            {flightNum !== "N/A" && flightNum !== callsign && (
              <span className="text-xs font-mono text-neutral-400 truncate">
                ({flightNum})
              </span>
            )}
          </div>

          <Tooltip closeDelay={100}>
            <Tooltip.Trigger>
              <button
                type="button"
                onClick={handleCopyAllInformation}
                className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                aria-label="Copy all flight and aircraft information"
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
              {copied ? "All details copied!" : "Copy all aircraft & flight details"}
            </Tooltip.Content>
          </Tooltip>
        </div>

        {/* Operator & Coordinates */}
        <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
          <span className="truncate pr-2 font-medium font-sans">{operatorName}</span>
          <span className="font-mono text-[11px] text-neutral-500 shrink-0">
            {latStr} {lonStr}
          </span>
        </div>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Route Card */}
        <div className="p-3.5 rounded-xl bg-[#141414] border border-white/8 shadow-md">
          <div className="flex items-center justify-between">
            {/* Origin */}
            <div className="text-left flex-1 min-w-0 pr-2">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider font-sans">
                Origin
              </span>
              <span className="text-xl font-black font-sans text-neutral-100 tracking-tight block">
                {originCode}
              </span>
              <span className="text-xs text-neutral-400 font-medium truncate block font-sans" title={originName}>
                {originName}
              </span>
            </div>

            {/* Flight Path Graphic */}
            <div className="flex flex-col items-center px-2 shrink-0">
              <div className="flex items-center space-x-1.5 text-neutral-400">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                <div className="w-14 h-[2px] bg-gradient-to-r from-neutral-600 via-neutral-300 to-emerald-400 relative">
                  <Plane className="w-3.5 h-3.5 text-white absolute -top-[6px] left-1/2 -translate-x-1/2 transform rotate-90" />
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>
              <span className="text-[9px] font-sans text-neutral-400 mt-1 uppercase font-bold tracking-wider">
                {flightStatusText}
              </span>
            </div>

            {/* Destination */}
            <div className="text-right flex-1 min-w-0 pl-2">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider font-sans">
                Destination
              </span>
              <span className="text-xl font-black font-sans text-emerald-400 tracking-tight block">
                {destinationCode}
              </span>
              <span className="text-xs text-neutral-400 font-medium truncate block font-sans" title={destinationName}>
                {destinationName}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Flight Kinematics Grid */}
        <div>
          <div className="flex items-center space-x-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-sans">
            <Gauge className="w-3 h-3 text-neutral-400" />
            <span>Flight Kinematics</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Altitude */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/6">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block font-sans">
                Baro Altitude
              </span>
              <div className="text-sm font-bold font-mono text-neutral-100 mt-0.5">
                {onGround ? "ON GROUND" : altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}
              </div>
              {altM !== null && !onGround && (
                <div className="text-[10px] text-neutral-400 font-mono">
                  {altM.toLocaleString()} m MSL
                </div>
              )}
            </div>

            {/* Groundspeed */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/6">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block font-sans">
                Groundspeed
              </span>
              <div className="text-sm font-bold font-mono text-neutral-100 mt-0.5">
                {speedKts !== null ? `${speedKts} kts` : "N/A"}
              </div>
              {speedKmh !== null && (
                <div className="text-[10px] text-neutral-400 font-mono">
                  {speedKmh} km/h
                </div>
              )}
            </div>

            {/* Track / Heading */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/6">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block font-sans">
                Track Heading
              </span>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-sm font-bold font-mono text-neutral-100">
                  {heading !== null ? `${heading}°` : "N/A"}
                </span>
                {heading !== null && (
                  <Compass
                    className="w-3.5 h-3.5 text-neutral-300"
                    style={{ transform: `rotate(${heading}deg)` }}
                  />
                )}
              </div>
            </div>

            {/* Vertical Rate */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/6">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block font-sans">
                Vertical Rate
              </span>
              <div className="flex items-center space-x-1 mt-0.5">
                {vertRateFpm !== null && vertRateFpm > 100 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                ) : vertRateFpm !== null && vertRateFpm < -100 ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
                ) : null}
                <span className="text-sm font-bold font-mono text-neutral-100">
                  {vertRateFpm !== null ? `${vertRateFpm > 0 ? "+" : ""}${vertRateFpm} fpm` : "N/A"}
                </span>
              </div>
            </div>

            {/* Aircraft Model & Reg */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/6 col-span-2">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block font-sans">
                Aircraft Model
              </span>
              <div className="text-xs font-bold text-neutral-100 font-sans mt-0.5 truncate">
                {aircraftType}
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1 font-mono">
                <span>Reg: <strong className="text-neutral-200">{registration}</strong></span>
                <span>ICAO Hex: <strong className="text-neutral-200">{icaoHex}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Transponder Telemetry */}
        <div>
          <div className="flex items-center space-x-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-sans">
            <Radio className="w-3 h-3 text-neutral-400" />
            <span>Transponder & Surveillance</span>
          </div>

          <div className="p-3 rounded-xl bg-[#141414] border border-white/6 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase font-sans">Squawk</span>
                <span className="font-mono font-bold text-neutral-200 text-xs">
                  {squawk}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block text-[10px] uppercase font-sans">Country</span>
                <span className="text-neutral-200 font-medium truncate block font-sans">
                  {originCountry}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block text-[10px] uppercase font-sans">Category</span>
                <span className="text-neutral-200 font-medium truncate block font-sans">
                  {categoryName}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block text-[10px] uppercase font-sans">Surveillance</span>
                <span className="font-mono font-semibold text-neutral-300 text-xs">
                  {positionSource}
                </span>
              </div>
            </div>

            {flight.data_freshness_seconds !== null && flight.data_freshness_seconds !== undefined && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                <span>Telemetry freshness</span>
                <span className="text-neutral-300">{Math.round(flight.data_freshness_seconds)}s ago</span>
              </div>
            )}
          </div>
        </div>

        {/* Spatial / Airspace Proximity */}
        {flight.nearest_airport && (
          <div>
            <div className="flex items-center space-x-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-sans">
              <MapPin className="w-3 h-3 text-neutral-400" />
              <span>Airspace Proximity</span>
            </div>

            <div className="p-3 rounded-xl bg-[#141414] border border-white/6 text-xs">
              <div className="text-neutral-200 font-semibold font-sans">{flight.nearest_airport}</div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                Proximity: {flight.nearest_airport_distance_km} km (
                {((flight.nearest_airport_distance_km || 0) * 0.539957).toFixed(1)} NM)
              </div>
            </div>
          </div>
        )}

        {/* Aircraft Specifications from Database Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-sans">
              <Plane className="w-3 h-3 text-neutral-300" />
              <span>Aircraft Specifications</span>
            </div>

            {(effectiveSpec || identification.aircraft_type_icao || nepalAircraft) && (
              <button
                type="button"
                onClick={handleToggleDetails}
                disabled={loadingSpec}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 font-sans"
              >
                {loadingSpec ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    <span>Loading DB...</span>
                  </>
                ) : isDetailsExpanded ? (
                  <>
                    <span>Less Details</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>More Details</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>

          {(effectiveSpec || nepalAircraft) ? (
            isDetailsExpanded ? (
              /* Extended Database Profile View: Displays ALL 25+ database fields */
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* Airframe & Classification Card */}
                {effectiveSpec ? (
                  <div className="p-3 rounded-xl bg-[#141414] border border-white/8 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-white/6 pb-2">
                      <div>
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-sans">
                          Commercial Model
                        </span>
                        <span className="font-bold text-neutral-100 font-sans text-sm">
                          {effectiveSpec.model}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-sans">
                          ICAO Type
                        </span>
                        <span className="font-bold text-emerald-400 font-mono text-sm">
                          {effectiveSpec.icao_type}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <AircraftDataCard
                        label="Category"
                        fieldKey="category"
                        value={
                          effectiveSpec.category
                            ? effectiveSpec.category.replace(/_/g, " ")
                            : "Commercial"
                        }
                      />
                      <AircraftDataCard
                        label="Engine Type"
                        fieldKey="engine_type"
                        value={effectiveSpec.engine_type || "Turbofan"}
                      />
                      <AircraftDataCard
                        label="Engine Model"
                        fieldKey="engine_model"
                        value={effectiveSpec.engine_model || "Not specified"}
                      />
                      <AircraftDataCard
                        label="Number of Engines"
                        fieldKey="number_of_engines"
                        value={
                          effectiveSpec.number_of_engines !== undefined &&
                          effectiveSpec.number_of_engines !== null
                            ? `${effectiveSpec.number_of_engines}x installed`
                            : "2x"
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#141414] border border-white/8 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-white/6 pb-2">
                      <div>
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-sans">
                          Commercial Model
                        </span>
                        <span className="font-bold text-neutral-100 font-sans text-sm">
                          {nepalAircraft?.model || nepalAircraft?.aircraft_type || identification.aircraft_type_icao || "Aircraft"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-sans">
                          Registration
                        </span>
                        <span className="font-bold text-emerald-400 font-mono text-sm">
                          {nepalAircraft?.registration || flight.identification.registration || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Civil Aviation Authority of Nepal (CAAN) Registry Card */}
                {nepalAircraft && (
                  <div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 px-0.5 font-sans flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold">Civil Aviation Registry (CAAN)</span>
                      <span className="text-[10px] font-mono text-neutral-500">9N Airframe Registry</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {nepalAircraft.owner && (
                        <AircraftDataCard
                          label="Registered Owner"
                          fieldKey="owner"
                          value={nepalAircraft.owner}
                          className="col-span-2"
                        />
                      )}
                      {nepalAircraft.serial_number && (
                        <AircraftDataCard
                          label="Serial Number (MSN)"
                          fieldKey="serial_number"
                          value={nepalAircraft.serial_number}
                        />
                      )}
                      {nepalAircraft.built_year && (
                        <AircraftDataCard
                          label="Year Built"
                          fieldKey="built_year"
                          value={nepalAircraft.built_year}
                        />
                      )}
                      {nepalAircraft.status && (
                        <AircraftDataCard
                          label="Airworthiness Status"
                          fieldKey="status"
                          value={nepalAircraft.status}
                        />
                      )}
                      {nepalAircraft.icao_aircraft_class && (
                        <AircraftDataCard
                          label="ICAO Aircraft Class"
                          fieldKey="icao_aircraft_class"
                          value={nepalAircraft.icao_aircraft_class}
                        />
                      )}
                      {nepalAircraft.registered_date && (
                        <AircraftDataCard
                          label="Registration Date"
                          fieldKey="registered_date"
                          value={nepalAircraft.registered_date}
                        />
                      )}
                      {nepalAircraft.reg_until && (
                        <AircraftDataCard
                          label="Certificate Validity"
                          fieldKey="reg_until"
                          value={nepalAircraft.reg_until}
                        />
                      )}
                      {nepalAircraft.engines && (
                        <AircraftDataCard
                          label="Powerplant Config"
                          fieldKey="engines_desc"
                          value={nepalAircraft.engines}
                          className="col-span-2"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Weight Limitations Card */}
                {effectiveSpec && (
                  <>
                    <div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 px-0.5 font-sans">
                        Weight Limitations
                      </div>
                  <div className="grid grid-cols-2 gap-2">
                    <AircraftDataCard
                      label="Operating Empty (OEW)"
                      fieldKey="oew_kg"
                      value={
                        effectiveSpec.oew_kg
                          ? `${Math.round(effectiveSpec.oew_kg).toLocaleString()} kg`
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Max Takeoff (MTOW)"
                      fieldKey="mtow_kg"
                      value={
                        effectiveSpec.mtow_kg
                          ? `${Math.round(effectiveSpec.mtow_kg).toLocaleString()} kg`
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Max Landing (MLW)"
                      fieldKey="mlw_kg"
                      value={
                        effectiveSpec.mlw_kg
                          ? `${Math.round(effectiveSpec.mlw_kg).toLocaleString()} kg`
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Fuel Capacity"
                      fieldKey="fuel_capacity_liters"
                      value={
                        effectiveSpec.fuel_capacity_liters
                          ? `${Math.round(effectiveSpec.fuel_capacity_liters).toLocaleString()} L`
                          : "N/A"
                      }
                    />
                  </div>
                </div>

                {/* Capacity & Range Card */}
                <div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 px-0.5 font-sans">
                    Capacity & Range
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <AircraftDataCard
                      label="Passenger Capacity"
                      fieldKey="passenger_capacity"
                      value={
                        effectiveSpec.passenger_capacity
                          ? `${effectiveSpec.passenger_capacity} seats`
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Nominal Range"
                      fieldKey="nominal_range_nm"
                      value={
                        effectiveSpec.nominal_range_nm
                          ? `${Math.round(effectiveSpec.nominal_range_nm).toLocaleString()} NM`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.nominal_range_nm
                          ? `${Math.round(effectiveSpec.nominal_range_nm * 1.852).toLocaleString()} km`
                          : undefined
                      }
                    />
                  </div>
                </div>

                {/* Speed Profiles Card */}
                <div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 px-0.5 font-sans">
                    Speed Profiles
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <AircraftDataCard
                      label="Approach"
                      fieldKey="approach_speed_kts"
                      value={
                        effectiveSpec.approach_speed_kts
                          ? `${effectiveSpec.approach_speed_kts} kts`
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Cruise"
                      fieldKey="cruise_speed_kts"
                      value={
                        effectiveSpec.cruise_speed_kts
                          ? `${effectiveSpec.cruise_speed_kts} kts`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.cruise_speed_kts
                          ? `${Math.round(effectiveSpec.cruise_speed_kts * 1.852)} km/h`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Maximum"
                      fieldKey="max_speed_kts"
                      value={
                        effectiveSpec.max_speed_kts
                          ? `${effectiveSpec.max_speed_kts} kts`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.max_speed_kts
                          ? `${Math.round(effectiveSpec.max_speed_kts * 1.852)} km/h`
                          : undefined
                      }
                    />
                  </div>
                </div>

                {/* Runway Requirements Card */}
                <div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 px-0.5 font-sans">
                    Runway Requirements
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <AircraftDataCard
                      label="Takeoff Field (TOFL)"
                      fieldKey="takeoff_field_length_m"
                      value={
                        effectiveSpec.takeoff_field_length_m
                          ? `${Math.round(effectiveSpec.takeoff_field_length_m).toLocaleString()} m`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.takeoff_field_length_m
                          ? `${Math.round(effectiveSpec.takeoff_field_length_m * 3.28084).toLocaleString()} ft`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Landing Field (LFL)"
                      fieldKey="landing_field_length_m"
                      value={
                        effectiveSpec.landing_field_length_m
                          ? `${Math.round(effectiveSpec.landing_field_length_m).toLocaleString()} m`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.landing_field_length_m
                          ? `${Math.round(effectiveSpec.landing_field_length_m * 3.28084).toLocaleString()} ft`
                          : undefined
                      }
                    />
                  </div>
                </div>

                {/* Airframe Dimensions & Aerodynamics Card */}
                <div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 px-0.5 font-sans">
                    Airframe Dimensions & Aerodynamics
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <AircraftDataCard
                      label="Wing Span"
                      fieldKey="wing_span"
                      value={
                        effectiveSpec.wing_span !== undefined && effectiveSpec.wing_span !== null
                          ? `${effectiveSpec.wing_span} m`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.wing_span
                          ? `${(effectiveSpec.wing_span * 3.28084).toFixed(1)} ft`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Fuselage Width"
                      fieldKey="fuselage_width"
                      value={
                        effectiveSpec.fuselage_width !== undefined && effectiveSpec.fuselage_width !== null
                          ? `${effectiveSpec.fuselage_width} m`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.fuselage_width
                          ? `${(effectiveSpec.fuselage_width * 3.28084).toFixed(1)} ft`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Total Length"
                      fieldKey="total_length"
                      value={
                        effectiveSpec.total_length !== undefined && effectiveSpec.total_length !== null
                          ? `${effectiveSpec.total_length} m`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.total_length
                          ? `${(effectiveSpec.total_length * 3.28084).toFixed(1)} ft`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Total Height"
                      fieldKey="total_height"
                      value={
                        effectiveSpec.total_height !== undefined && effectiveSpec.total_height !== null
                          ? `${effectiveSpec.total_height} m`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.total_height
                          ? `${(effectiveSpec.total_height * 3.28084).toFixed(1)} ft`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Wing Area"
                      fieldKey="wing_area"
                      value={
                        effectiveSpec.wing_area !== undefined && effectiveSpec.wing_area !== null
                          ? `${effectiveSpec.wing_area} m²`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.wing_area
                          ? `${(effectiveSpec.wing_area * 10.7639).toFixed(1)} ft²`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Wing Sweep (25%)"
                      fieldKey="wing_sweep25"
                      value={
                        effectiveSpec.wing_sweep25 !== undefined && effectiveSpec.wing_sweep25 !== null
                          ? `${effectiveSpec.wing_sweep25}°`
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Wing Position"
                      fieldKey="wing_position"
                      value={
                        effectiveSpec.wing_position
                          ? effectiveSpec.wing_position.toUpperCase()
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Tail Areas (HTP / VTP)"
                      fieldKey="htp_area"
                      value={
                        effectiveSpec.htp_area || effectiveSpec.vtp_area
                          ? `${effectiveSpec.htp_area ?? "—"} / ${effectiveSpec.vtp_area ?? "—"} m²`
                          : "N/A"
                      }
                    />
                  </div>
                </div>

                {/* Propulsion & Thrust Dynamics Card */}
                <div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 px-0.5 font-sans">
                    Propulsion & Thrust Dynamics
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <AircraftDataCard
                      label="Max Takeoff Thrust"
                      fieldKey="max_thrust"
                      value={
                        effectiveSpec.max_thrust !== undefined && effectiveSpec.max_thrust !== null
                          ? `${Math.round(effectiveSpec.max_thrust).toLocaleString()} N`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.max_thrust
                          ? `${(effectiveSpec.max_thrust / 1000).toFixed(1)} kN (${Math.round(effectiveSpec.max_thrust * 0.224809).toLocaleString()} lbf)`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Max Engine Power"
                      fieldKey="max_power"
                      value={
                        effectiveSpec.max_power !== undefined && effectiveSpec.max_power !== null
                          ? `${Math.round(effectiveSpec.max_power).toLocaleString()} kW`
                          : "N/A"
                      }
                      subValue={
                        effectiveSpec.max_power
                          ? `${Math.round(effectiveSpec.max_power * 1.34102).toLocaleString()} hp`
                          : undefined
                      }
                    />
                    <AircraftDataCard
                      label="Thruster Type"
                      fieldKey="thruster_type"
                      value={effectiveSpec.thruster_type ? effectiveSpec.thruster_type.toUpperCase() : "N/A"}
                    />
                    <AircraftDataCard
                      label="Bypass Ratio (BPR)"
                      fieldKey="bpr"
                      value={
                        effectiveSpec.bpr !== undefined && effectiveSpec.bpr !== null
                          ? `${effectiveSpec.bpr}`
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Energy / Fuel"
                      fieldKey="energy_type"
                      value={effectiveSpec.energy_type ? effectiveSpec.energy_type.toUpperCase() : "N/A"}
                    />
                    <AircraftDataCard
                      label="Engine Position"
                      fieldKey="engine_position"
                      value={effectiveSpec.engine_position ? effectiveSpec.engine_position.toUpperCase() : "N/A"}
                    />
                    <AircraftDataCard
                      label="Lateral Arm (Y-Arm)"
                      fieldKey="engine_y_arm"
                      value={
                        effectiveSpec.engine_y_arm !== undefined && effectiveSpec.engine_y_arm !== null
                          ? `${effectiveSpec.engine_y_arm} m`
                          : "N/A"
                      }
                    />
                    <AircraftDataCard
                      label="Prop / Rotor Diameter"
                      fieldKey="rotor_diameter"
                      value={
                        effectiveSpec.rotor_diameter !== undefined && effectiveSpec.rotor_diameter !== null
                          ? `${effectiveSpec.rotor_diameter} m`
                          : "N/A"
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Compact Summary View */
          <div className="p-3 rounded-xl bg-[#141414] border border-white/6 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="text-neutral-400 font-sans">Airframe:</span>
              <span className="font-bold text-neutral-100 font-sans">
                {effectiveSpec?.model || nepalAircraft?.model || nepalAircraft?.aircraft_type || identification.aircraft_type_icao || "Aircraft"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {nepalAircraft?.owner && (
                <AircraftDataCard
                  label="Registered Owner"
                  fieldKey="owner"
                  value={nepalAircraft.owner}
                  className="col-span-2"
                />
              )}

              {effectiveSpec ? (
                <>
                  <AircraftDataCard
                    label="ICAO Type"
                    fieldKey="icao_type"
                    value={effectiveSpec.icao_type}
                  />

                  <AircraftDataCard
                    label="Category"
                    fieldKey="category"
                    value={
                      effectiveSpec.category
                        ? effectiveSpec.category.replace(/_/g, " ")
                        : "Commercial"
                    }
                  />

                  <AircraftDataCard
                    label="Powerplant"
                    fieldKey="engine_type"
                    value={effectiveSpec.engine_type || "Turbofan"}
                  />

                  <AircraftDataCard
                    label="Engines Count"
                    fieldKey="number_of_engines"
                    value={
                      effectiveSpec.number_of_engines !== undefined &&
                      effectiveSpec.number_of_engines !== null
                        ? `${effectiveSpec.number_of_engines}x`
                        : "2x"
                    }
                  />

                  {effectiveSpec.engine_model && (
                    <AircraftDataCard
                      label="Engine Model"
                      fieldKey="engine_model"
                      value={effectiveSpec.engine_model}
                      className="col-span-2"
                    />
                  )}

                  <AircraftDataCard
                    label="Capacity"
                    fieldKey="passenger_capacity"
                    value={
                      effectiveSpec.passenger_capacity
                        ? `${effectiveSpec.passenger_capacity} seats`
                        : "N/A"
                    }
                  />

                  {effectiveSpec.mtow_kg && (
                    <AircraftDataCard
                      label="Max Takeoff"
                      fieldKey="mtow_kg"
                      value={`${Math.round(effectiveSpec.mtow_kg).toLocaleString()} kg`}
                    />
                  )}

                  {effectiveSpec.cruise_speed_kts && (
                    <AircraftDataCard
                      label="Cruise Speed"
                      fieldKey="cruise_speed_kts"
                      value={`${effectiveSpec.cruise_speed_kts} kts`}
                    />
                  )}

                  {effectiveSpec.oew_kg && (
                    <AircraftDataCard
                      label="Operating Empty"
                      fieldKey="oew_kg"
                      value={`${Math.round(effectiveSpec.oew_kg).toLocaleString()} kg`}
                    />
                  )}
                </>
              ) : nepalAircraft ? (
                <>
                  <AircraftDataCard
                    label="Registration"
                    fieldKey="registration"
                    value={nepalAircraft.registration || flight.identification.registration || "N/A"}
                  />
                  {nepalAircraft.status && (
                    <AircraftDataCard
                      label="Airworthiness Status"
                      fieldKey="status"
                      value={nepalAircraft.status}
                    />
                  )}
                </>
              ) : null}

              {nepalAircraft?.serial_number && (
                <AircraftDataCard
                  label="Serial Number (MSN)"
                  fieldKey="serial_number"
                  value={nepalAircraft.serial_number}
                />
              )}

              {nepalAircraft?.built_year && (
                <AircraftDataCard
                  label="Year Built"
                  fieldKey="built_year"
                  value={nepalAircraft.built_year}
                />
              )}
            </div>
          </div>
        )
      ) : null}
        </div>
      </div>

      {/* 3. Action Footer (Bottom copy text button removed as requested) */}
      {onCenterFlight && (
        <div className="p-3 border-t border-white/8 bg-[#0a0a0a] flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onCenterFlight(flight)}
            className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-xs font-semibold text-neutral-200 flex items-center justify-center space-x-1.5 transition-all cursor-pointer font-sans"
          >
            <Crosshair className="w-3.5 h-3.5 text-white" />
            <span>Track on Map</span>
          </Button>
        </div>
      )}
    </aside>
  );
};
