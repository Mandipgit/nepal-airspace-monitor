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
  Layers,
  Copy,
  Check,
  Crosshair,
  Shield,
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
  const latStr = position.latitude !== null && position.latitude !== undefined ? `${position.latitude.toFixed(4)}°` : "N/A";
  const lonStr = position.longitude !== null && position.longitude !== undefined ? `${position.longitude.toFixed(4)}°` : "N/A";

  // Flight flight phase indicator
  const flightPhase = onGround
    ? "On Ground"
    : vertRateFpm !== null && vertRateFpm > 150
    ? `Climbing (+${vertRateFpm} fpm)`
    : vertRateFpm !== null && vertRateFpm < -150
    ? `Descending (${vertRateFpm} fpm)`
    : altFt !== null
    ? `Cruising • FL${Math.round(altFt / 100)}`
    : "Airborne";

  const handleCopyTelemetry = () => {
    const text = `${callsign} | Hex: ${icaoHex} | Reg: ${registration} | Type: ${aircraftType}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-80 md:w-96 h-full glass-panel z-20 flex flex-col shrink-0 select-none overflow-hidden border-r border-white/8 transition-all duration-300 animate-in fade-in slide-in-from-left-4">
      {/* Panel Header */}
      <div className="p-4 border-b border-white/8 bg-slate-950/40">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 pr-2">
            {/* Top identifier bar with amber highlight */}
            <div className="flex items-center space-x-2">
              <span className="w-1 h-5 rounded-full bg-amber-400 shrink-0" />
              <span className="font-mono-avionics text-lg font-extrabold text-slate-100 tracking-wider truncate">
                {callsign !== "N/A" ? callsign : icaoHex}
              </span>
              {flightNum !== "N/A" && flightNum !== callsign && (
                <span className="text-xs font-mono-avionics text-slate-400">
                  ({flightNum})
                </span>
              )}
            </div>

            <div className="text-xs font-medium text-slate-300 truncate">
              {operatorName}
            </div>

            {/* Badges row */}
            <div className="flex items-center flex-wrap gap-1.5 pt-1">
              {isNepal && (
                <Chip
                  size="sm"
                  variant="soft"
                  color="success"
                  className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5"
                >
                  NEPAL 9N
                </Chip>
              )}
              <Chip
                size="sm"
                variant="soft"
                className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono-avionics font-bold px-1.5 py-0.5"
              >
                {positionSource}
              </Chip>
              {squawk !== "N/A" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-avionics bg-slate-800 text-slate-300 border border-slate-700">
                  SQ {squawk}
                </span>
              )}
            </div>
          </div>

          {/* Close button */}
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onClose}
            aria-label="Close flight details"
            className="text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg p-1 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable Flight Information Dossier */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {/* Dynamic Departure -> Arrival Visual Card */}
        <div className="p-4 rounded-2xl glass-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            {/* Origin */}
            <div className="text-left flex-1 min-w-0 pr-2">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                Origin
              </span>
              <span className="font-mono-avionics text-2xl font-black text-cyan-400 tracking-wide block truncate">
                {originCode}
              </span>
              <span
                className="text-xs text-slate-300 font-medium truncate block mt-0.5"
                title={originName}
              >
                {originName}
              </span>
            </div>

            {/* Flight Path Visualization */}
            <div className="flex flex-col items-center px-3 shrink-0">
              <div className="flex items-center space-x-1.5 text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                <div className="w-12 h-[2px] bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 relative">
                  <Plane
                    className="w-3.5 h-3.5 text-sky-200 absolute -top-[6px] left-1/2 -translate-x-1/2 transform rotate-90 drop-shadow"
                  />
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              </div>
              <span className="text-[9px] font-mono-avionics text-slate-400 mt-2 uppercase font-semibold text-center">
                {flightPhase}
              </span>
            </div>

            {/* Destination */}
            <div className="text-right flex-1 min-w-0 pl-2">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                Destination
              </span>
              <span className="font-mono-avionics text-2xl font-black text-emerald-400 tracking-wide block truncate">
                {destinationCode}
              </span>
              <span
                className="text-xs text-slate-300 font-medium truncate block mt-0.5"
                title={destinationName}
              >
                {destinationName}
              </span>
            </div>
          </div>

          {/* Proximity / Nearest Airport Badge if provided */}
          {flight.nearest_airport && (
            <div className="mt-3 pt-3 border-t border-white/6 flex items-center justify-between text-[11px] font-mono-avionics text-slate-400">
              <div className="flex items-center space-x-1 text-slate-300 truncate">
                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">{flight.nearest_airport}</span>
              </div>
              {flight.nearest_airport_distance_km !== null && (
                <span className="text-cyan-300 font-semibold shrink-0">
                  {flight.nearest_airport_distance_km} km
                </span>
              )}
            </div>
          )}
        </div>

        {/* Flight Information Grid */}
        <div>
          <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Flight Kinematics</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Speed */}
            <div className="p-3 rounded-xl glass-card">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Groundspeed
              </span>
              <div className="text-base font-bold font-mono-avionics text-slate-100 mt-0.5">
                {speedKts !== null ? `${speedKts} kts` : "N/A"}
              </div>
              {speedKmh !== null && (
                <span className="text-[10px] font-mono-avionics text-slate-400 block">
                  {speedKmh} km/h
                </span>
              )}
            </div>

            {/* Altitude */}
            <div className="p-3 rounded-xl glass-card">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Altitude (Baro)
              </span>
              <div className="text-base font-bold font-mono-avionics text-cyan-300 mt-0.5">
                {onGround ? "ON GROUND" : altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}
              </div>
              {altM !== null && (
                <span className="text-[10px] font-mono-avionics text-slate-400 block">
                  {altM.toLocaleString()} m MSL
                </span>
              )}
            </div>

            {/* Aircraft Model */}
            <div className="p-3 rounded-xl glass-card col-span-2">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Aircraft Model
              </span>
              <div className="text-sm font-semibold text-slate-100 font-mono-avionics mt-0.5 truncate">
                {aircraftType}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono-avionics">
                <span>Registration: <strong className="text-slate-200">{registration}</strong></span>
                <span>ICAO Hex: <strong className="text-cyan-300">{icaoHex}</strong></span>
              </div>
            </div>

            {/* Track Heading */}
            <div className="p-3 rounded-xl glass-card">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Heading / Track
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-base font-bold font-mono-avionics text-slate-100">
                  {heading !== null ? `${heading}°` : "N/A"}
                </span>
                {heading !== null && (
                  <Compass
                    className="w-4 h-4 text-cyan-400 shrink-0"
                    style={{ transform: `rotate(${heading}deg)` }}
                  />
                )}
              </div>
            </div>

            {/* Vertical Rate */}
            <div className="p-3 rounded-xl glass-card">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Vertical Rate
              </span>
              <div className="flex items-center space-x-1.5 mt-0.5">
                {vertRateFpm !== null && vertRateFpm > 100 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : vertRateFpm !== null && vertRateFpm < -100 ? (
                  <ArrowDownRight className="w-4 h-4 text-amber-400" />
                ) : null}
                <span className="text-base font-bold font-mono-avionics text-slate-100">
                  {vertRateFpm !== null ? `${vertRateFpm > 0 ? "+" : ""}${vertRateFpm} fpm` : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Transponder Telemetry */}
        <div>
          <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Transponder Telemetry</span>
          </div>

          <div className="p-3.5 rounded-xl glass-card space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Squawk Code</span>
                <span className="font-mono-avionics font-bold text-cyan-300">
                  {squawk}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Country</span>
                <span className="text-slate-200 font-medium truncate block">
                  {originCountry}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Category</span>
                <span className="text-slate-200 font-medium truncate block">
                  {categoryName}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase">SPI / IDENT</span>
                <span className={`font-mono-avionics font-semibold ${identification.spi ? "text-emerald-400" : "text-slate-400"}`}>
                  {identification.spi ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/6 flex items-center justify-between text-[11px] font-mono-avionics text-slate-400">
              <div>
                LAT / LON: <span className="text-slate-200">{latStr}, {lonStr}</span>
              </div>
              {flight.data_freshness_seconds !== null && flight.data_freshness_seconds !== undefined && (
                <div>
                  Signal: <span className="text-emerald-400">{Math.round(flight.data_freshness_seconds)}s ago</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enriched Aircraft Specifications (If available) */}
        {aircraft_spec && (
          <div>
            <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Fleet Specifications</span>
            </div>

            <div className="p-3.5 rounded-xl glass-card space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-white/6 pb-2">
                <span className="text-slate-400">Airframe:</span>
                <span className="font-bold text-slate-100 font-mono-avionics">{aircraft_spec.model}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Powerplant</span>
                  <span className="text-slate-200 font-medium">
                    {aircraft_spec.engine_type || "N/A"} ({aircraft_spec.number_of_engines || "2"}x)
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Passenger Seats</span>
                  <span className="font-mono-avionics font-bold text-emerald-400">
                    {aircraft_spec.passenger_capacity ? `${aircraft_spec.passenger_capacity} seats` : "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Max Takeoff Wt</span>
                  <span className="font-mono-avionics text-slate-200">
                    {aircraft_spec.mtow_kg ? `${Math.round(aircraft_spec.mtow_kg).toLocaleString()} kg` : "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Cruise Speed</span>
                  <span className="font-mono-avionics text-slate-200">
                    {aircraft_spec.cruise_speed_kts ? `${aircraft_spec.cruise_speed_kts} kts` : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-3 border-t border-white/8 bg-slate-950/50 flex items-center justify-between gap-2">
        {onCenterFlight && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onCenterFlight(flight)}
            className="flex-1 py-1.5 px-3 rounded-xl border border-white/8 hover:border-cyan-500/40 text-xs font-semibold text-slate-300 hover:text-cyan-300 flex items-center justify-center space-x-1.5 transition-all"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>Track on Map</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onPress={handleCopyTelemetry}
          className="py-1.5 px-3 rounded-xl border border-white/8 hover:border-slate-600 text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-all"
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
    </div>
  );
};
