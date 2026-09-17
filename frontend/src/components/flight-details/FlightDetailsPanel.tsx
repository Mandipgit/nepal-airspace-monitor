"use client";

import React, { useState } from "react";
import { Button, Chip } from "@heroui/react";
import { NormalizedFlight } from "@/types/flight";
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
} from "lucide-react";

interface FlightDetailsPanelProps {
  flight: NormalizedFlight | null;
  onClose: () => void;
  onCenterFlight?: (flight: NormalizedFlight) => void;
}

export const FlightDetailsPanel: React.FC<FlightDetailsPanelProps> = ({
  flight,
  onClose,
  onCenterFlight,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!flight) return null;

  const { identification, position, route, aircraft_spec } = flight;
  const isNepal = identification.is_nepal_registered;
  const onGround = position.on_ground;

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
    aircraft_spec?.model || identification.aircraft_type_icao || "N/A";

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

  // Flight flight phase indicator
  const flightPhase = onGround
    ? "ON GROUND"
    : vertRateFpm !== null && vertRateFpm > 200
    ? `CLIMBING (+${vertRateFpm} FPM)`
    : vertRateFpm !== null && vertRateFpm < -200
    ? `DESCENDING (${vertRateFpm} FPM)`
    : altFt !== null
    ? `CRUISING • FL${Math.round(altFt / 100)}`
    : "AIRBORNE";

  // Format timestamp for header
  const timeUtc = new Date().toISOString().slice(11, 16) + " UTC";

  const handleCopyTelemetry = () => {
    const text = `${callsign} | Hex: ${icaoHex} | Reg: ${registration} | Type: ${aircraftType}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-80 md:w-[380px] h-full bg-[#11141b] border-r border-white/7 z-25 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300">
      {/* 1. Panel Header Inspired by Screenshot */}
      <div className="p-4 border-b border-white/7 bg-[#0d1017]">
        {/* Top Status Chip & Close */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-avionics font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-300">
              {onGround ? "ON GROUND" : "IN TRANSIT"} • {timeUtc}
            </span>
            {isNepal && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
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
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 p-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Flight Identifier & Copy Icon */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <h2 className="font-mono-avionics text-xl font-black text-slate-100 tracking-wider truncate">
              {callsign !== "N/A" ? callsign : icaoHex}
            </h2>
            {flightNum !== "N/A" && flightNum !== callsign && (
              <span className="text-xs font-mono-avionics text-slate-400 truncate">
                ({flightNum})
              </span>
            )}
          </div>

          <button
            onClick={handleCopyTelemetry}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
            title="Copy flight information"
            aria-label="Copy flight info"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Operator & Coordinates */}
        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
          <span className="truncate pr-2">{operatorName}</span>
          <span className="font-mono-avionics text-[11px] text-slate-500 shrink-0">
            {latStr} {lonStr}
          </span>
        </div>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 no-scrollbar">
        {/* Departure ─── ✈ ─── Arrival Card */}
        <div className="p-3.5 rounded-xl bg-[#181c26] border border-white/6">
          <div className="flex items-center justify-between">
            {/* Origin */}
            <div className="text-left flex-1 min-w-0 pr-2">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                Departure
              </span>
              <span className="font-mono-avionics text-xl font-black text-slate-100 tracking-wide block truncate mt-0.5">
                {originCode}
              </span>
              <span
                className="text-[11px] text-slate-300 font-medium truncate block mt-0.5"
                title={originName}
              >
                {originName}
              </span>
            </div>

            {/* Flight Path Indicator */}
            <div className="flex flex-col items-center px-2 shrink-0">
              <div className="flex items-center space-x-1.5 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <div className="w-10 h-[1px] bg-slate-600 relative">
                  <Plane className="w-3.5 h-3.5 text-sky-400 absolute -top-[6px] left-1/2 -translate-x-1/2 rotate-90" />
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              </div>
              <span className="text-[9px] font-mono-avionics text-slate-400 mt-2 font-medium tracking-tight">
                {flightPhase}
              </span>
            </div>

            {/* Destination */}
            <div className="text-right flex-1 min-w-0 pl-2">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                Arrival
              </span>
              <span className="font-mono-avionics text-xl font-black text-slate-100 tracking-wide block truncate mt-0.5">
                {destinationCode}
              </span>
              <span
                className="text-[11px] text-slate-300 font-medium truncate block mt-0.5"
                title={destinationName}
              >
                {destinationName}
              </span>
            </div>
          </div>

          {/* Nearest Airport if route airports missing or supplementary */}
          {flight.nearest_airport && (
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-avionics text-slate-400">
              <div className="flex items-center space-x-1 text-slate-300 truncate">
                <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
                <span className="truncate">{flight.nearest_airport}</span>
              </div>
              {flight.nearest_airport_distance_km !== null && (
                <span className="text-slate-300 font-semibold shrink-0">
                  {flight.nearest_airport_distance_km} km
                </span>
              )}
            </div>
          )}
        </div>

        {/* Kinematics Telemetry Grid */}
        <div>
          <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Gauge className="w-3 h-3 text-slate-400" />
            <span>Avionics & Kinematics</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Groundspeed */}
            <div className="p-2.5 rounded-lg bg-[#181c26] border border-white/6">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Groundspeed
              </span>
              <div className="text-sm font-bold font-mono-avionics text-slate-100 mt-0.5">
                {speedKts !== null ? `${speedKts} kts` : "N/A"}
              </div>
              {speedKmh !== null && (
                <span className="text-[10px] font-mono-avionics text-slate-500 block">
                  {speedKmh} km/h
                </span>
              )}
            </div>

            {/* Altitude */}
            <div className="p-2.5 rounded-lg bg-[#181c26] border border-white/6">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Altitude (Baro)
              </span>
              <div className="text-sm font-bold font-mono-avionics text-slate-100 mt-0.5">
                {onGround ? "ON GROUND" : altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}
              </div>
              {altM !== null && (
                <span className="text-[10px] font-mono-avionics text-slate-500 block">
                  {altM.toLocaleString()} m MSL
                </span>
              )}
            </div>

            {/* Heading */}
            <div className="p-2.5 rounded-lg bg-[#181c26] border border-white/6">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Heading / Track
              </span>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-sm font-bold font-mono-avionics text-slate-100">
                  {heading !== null ? `${heading}°` : "N/A"}
                </span>
                {heading !== null && (
                  <Compass
                    className="w-3.5 h-3.5 text-slate-400 shrink-0"
                    style={{ transform: `rotate(${heading}deg)` }}
                  />
                )}
              </div>
            </div>

            {/* Vertical Rate */}
            <div className="p-2.5 rounded-lg bg-[#181c26] border border-white/6">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Vertical Rate
              </span>
              <div className="flex items-center space-x-1 mt-0.5">
                {vertRateFpm !== null && vertRateFpm > 100 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                ) : vertRateFpm !== null && vertRateFpm < -100 ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
                ) : null}
                <span className="text-sm font-bold font-mono-avionics text-slate-100">
                  {vertRateFpm !== null ? `${vertRateFpm > 0 ? "+" : ""}${vertRateFpm} fpm` : "N/A"}
                </span>
              </div>
            </div>

            {/* Aircraft Model & Reg */}
            <div className="p-2.5 rounded-lg bg-[#181c26] border border-white/6 col-span-2">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Aircraft Model
              </span>
              <div className="text-xs font-semibold text-slate-100 font-mono-avionics mt-0.5 truncate">
                {aircraftType}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono-avionics">
                <span>Reg: <strong className="text-slate-200">{registration}</strong></span>
                <span>ICAO Hex: <strong className="text-slate-200">{icaoHex}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Transponder Telemetry */}
        <div>
          <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Radio className="w-3 h-3 text-slate-400" />
            <span>Transponder & Surveillance</span>
          </div>

          <div className="p-3 rounded-lg bg-[#181c26] border border-white/6 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Squawk</span>
                <span className="font-mono-avionics font-bold text-slate-200">
                  {squawk}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Country</span>
                <span className="text-slate-200 font-medium truncate block">
                  {originCountry}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Category</span>
                <span className="text-slate-200 font-medium truncate block">
                  {categoryName}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Surveillance</span>
                <span className="font-mono-avionics font-semibold text-slate-300">
                  {positionSource}
                </span>
              </div>
            </div>

            {flight.data_freshness_seconds !== null && flight.data_freshness_seconds !== undefined && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono-avionics text-slate-500">
                <span>Telemetry freshness</span>
                <span className="text-slate-300">{Math.round(flight.data_freshness_seconds)}s ago</span>
              </div>
            )}
          </div>
        </div>

        {/* Enriched Aircraft Specs (If available) */}
        {aircraft_spec && (
          <div>
            <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              <Layers className="w-3 h-3 text-slate-400" />
              <span>Fleet Specifications</span>
            </div>

            <div className="p-3 rounded-lg bg-[#181c26] border border-white/6 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                <span className="text-slate-400">Airframe:</span>
                <span className="font-bold text-slate-100 font-mono-avionics">{aircraft_spec.model}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Powerplant</span>
                  <span className="text-slate-200">
                    {aircraft_spec.engine_type || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Capacity</span>
                  <span className="font-mono-avionics text-slate-200">
                    {aircraft_spec.passenger_capacity ? `${aircraft_spec.passenger_capacity} seats` : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Action Footer */}
      <div className="p-3 border-t border-white/7 bg-[#0d1017] flex items-center gap-2">
        {onCenterFlight && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onCenterFlight(flight)}
            className="flex-1 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5 text-sky-400" />
            <span>Track on Map</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onPress={handleCopyTelemetry}
          className="py-1.5 px-3 rounded-lg border border-white/8 hover:border-slate-600 text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
};
