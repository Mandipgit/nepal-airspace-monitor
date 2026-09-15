"use client";

import React from "react";
import {
  X,
  Plane,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Gauge,
  Layers,
  Radio,
  Globe,
  Hash,
  Activity,
  Cpu,
} from "lucide-react";
import { NormalizedFlight } from "@/types/flight";

interface FlightDetailsDrawerProps {
  flight: NormalizedFlight | null;
  onClose: () => void;
}

export const FlightDetailsDrawer: React.FC<FlightDetailsDrawerProps> = ({
  flight,
  onClose,
}) => {
  if (!flight) return null;

  const { identification, position, aircraft_spec } = flight;
  const isNepal = identification.is_nepal_registered;
  const onGround = position.on_ground;

  // Conversions
  const altFt =
    position.altitude_baro_ft ??
    (position.altitude_baro_m ? Math.round(position.altitude_baro_m * 3.28084) : null);
  const altGeoFt = position.altitude_geo_m ? Math.round(position.altitude_geo_m * 3.28084) : null;
  const speedKts =
    position.groundspeed_kts ??
    (position.groundspeed_mps ? Math.round(position.groundspeed_mps * 1.94384) : null);
  const speedKmh = position.groundspeed_mps ? Math.round(position.groundspeed_mps * 3.6) : null;
  const vertRateFpm =
    position.vertical_rate_fpm ??
    (position.vertical_rate_mps ? Math.round(position.vertical_rate_mps * 196.85) : null);
  const heading = position.heading_deg ? Math.round(position.heading_deg) : null;

  return (
    <div className="absolute right-4 top-20 bottom-4 w-84 md:w-96 glass-panel rounded-2xl z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/70 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-mono-avionics text-xl font-extrabold text-slate-100 tracking-wider">
              {identification.callsign || identification.icao24.toUpperCase()}
            </span>
            {isNepal && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                NEPAL (9N)
              </span>
            )}
            {identification.squawk && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-avionics font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-700/60">
                SQ {identification.squawk}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-300 font-medium">
            {identification.operator_name || (isNepal ? "Domestic Nepal Carrier" : "International / Regional Carrier")}
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono-avionics text-slate-400">
            <span>ICAO HEX: <strong className="text-slate-200">{identification.icao24}</strong></span>
            {identification.origin_country && (
              <>
                <span>•</span>
                <span className="text-slate-300 font-sans">{identification.origin_country}</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Dossier Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Flight Route / Itinerary Card */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            {/* Origin Airport */}
            <div className="text-left flex-1 min-w-0 pr-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Departure
              </span>
              <span className="font-mono-avionics text-xl font-extrabold text-cyan-400 tracking-wide block">
                {flight.route?.origin_iata || flight.route?.origin_icao || (isNepal ? "KTM" : "DEP")}
              </span>
              <span
                className="text-xs text-slate-200 font-medium truncate block"
                title={flight.route?.origin_name || (isNepal ? "Kathmandu (Tribhuvan)" : "Departure Airport")}
              >
                {flight.route?.origin_name || (isNepal ? "Kathmandu" : "Origin Airport")}
              </span>
            </div>

            {/* Flight Path Graphic */}
            <div className="flex flex-col items-center px-2 shrink-0">
              <div className="flex items-center space-x-1.5 text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <div className="w-14 h-[2px] bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 relative">
                  <Plane className="w-3.5 h-3.5 text-sky-200 absolute -top-[6px] left-1/2 -translate-x-1/2 transform rotate-90" />
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>
              <span className="text-[9px] font-mono-avionics text-slate-400 mt-1 uppercase font-semibold">
                {onGround ? "On Ground" : altFt !== null ? `En Route • FL${Math.round(altFt / 100)}` : "En Route"}
              </span>
            </div>

            {/* Destination Airport */}
            <div className="text-right flex-1 min-w-0 pl-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Arrival
              </span>
              <span className="font-mono-avionics text-xl font-extrabold text-emerald-400 tracking-wide block">
                {flight.route?.destination_iata || flight.route?.destination_icao || (isNepal ? "PKR" : "ARR")}
              </span>
              <span
                className="text-xs text-slate-200 font-medium truncate block"
                title={flight.route?.destination_name || (isNepal ? "Pokhara International" : "Destination Airport")}
              >
                {flight.route?.destination_name || (isNepal ? "Pokhara" : "Destination Airport")}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Avionics Grid */}
        <div>
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Flight Kinematics</span>
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {/* Altitude */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Altitude (Baro)</span>
              <span className="text-base font-bold font-mono-avionics text-cyan-300">
                {onGround ? "ON GROUND" : altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}
              </span>
              {position.altitude_baro_m && (
                <span className="text-[10px] text-slate-400 block font-mono-avionics">
                  {Math.round(position.altitude_baro_m).toLocaleString()} m MSL
                </span>
              )}
            </div>

            {/* Groundspeed */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Groundspeed</span>
              <span className="text-base font-bold font-mono-avionics text-slate-200">
                {speedKts !== null ? `${speedKts} kts` : "N/A"}
              </span>
              {speedKmh && (
                <span className="text-[10px] text-slate-400 block font-mono-avionics">
                  {speedKmh} km/h
                </span>
              )}
            </div>

            {/* Heading & Track */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Track Heading</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-bold font-mono-avionics text-slate-200">
                  {heading !== null ? `${heading}°` : "N/A"}
                </span>
                {heading !== null && (
                  <Compass
                    className="w-4 h-4 text-cyan-400 inline-block"
                    style={{ transform: `rotate(${heading}deg)` }}
                  />
                )}
              </div>
            </div>

            {/* Vertical Rate */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Vertical Speed</span>
              <div className="flex items-center space-x-1">
                {vertRateFpm && vertRateFpm > 100 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : vertRateFpm && vertRateFpm < -100 ? (
                  <ArrowDownRight className="w-4 h-4 text-amber-400" />
                ) : null}
                <span className="text-base font-bold font-mono-avionics text-slate-200">
                  {vertRateFpm !== null ? `${vertRateFpm > 0 ? "+" : ""}${vertRateFpm} fpm` : "Level (0 fpm)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* OpenSky Raw Telemetry Attributes */}
        <div>
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>OpenSky Transponder Telemetry</span>
          </h3>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Squawk Code</span>
                <span className="font-mono-avionics font-bold text-cyan-300">
                  {identification.squawk || "Not Transmitted"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Surveillance Source</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    identification.position_source?.includes("MLAT")
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : identification.position_source?.includes("UAT")
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                      : identification.position_source?.includes("FLARM")
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                  }`}>
                    {identification.position_source || "ADS-B"}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Country of Registration</span>
                <span className="text-slate-200 font-medium">
                  {identification.origin_country || "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Emitter Category</span>
                <span className="text-slate-200 font-medium truncate block">
                  {identification.category_name || "General Aviation"}
                </span>
              </div>
              {altGeoFt !== null && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Geometric Altitude</span>
                  <span className="font-mono-avionics text-slate-300">
                    {altGeoFt.toLocaleString()} ft ({Math.round(position.altitude_geo_m || 0)} m)
                  </span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block text-[10px]">IDENT (SPI)</span>
                <span className={`font-mono-avionics font-semibold ${identification.spi ? "text-emerald-400" : "text-slate-400"}`}>
                  {identification.spi ? "ACTIVE (Squawking Ident)" : "INACTIVE"}
                </span>
              </div>
            </div>

            {/* GPS Coordinates & Last Contact */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono-avionics text-slate-400">
              <div>
                LAT/LON: <span className="text-slate-300">{position.latitude?.toFixed(4)}°, {position.longitude?.toFixed(4)}°</span>
              </div>
              {flight.data_freshness_seconds !== null && (
                <div>
                  Signal: <span className="text-emerald-400">{Math.round(flight.data_freshness_seconds || 0)}s ago</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Spatial / Airspace Proximity */}
        {flight.nearest_airport && (
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Airspace Proximity</span>
            </h3>

            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs">
              <div className="text-cyan-300 font-semibold">
                {flight.nearest_airport}
              </div>
              <div className="text-[11px] text-cyan-400/80 mt-1 font-mono-avionics">
                Proximity: {flight.nearest_airport_distance_km} km ({((flight.nearest_airport_distance_km || 0) * 0.539957).toFixed(1)} NM)
              </div>
            </div>
          </div>
        )}

        {/* Enriched Aircraft Specifications */}
        {aircraft_spec ? (
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2 flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-purple-400" />
              <span>Aircraft Specifications</span>
            </h3>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-medium">Model:</span>
                <span className="font-bold text-slate-100 font-mono-avionics">{aircraft_spec.model}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">ICAO Type</span>
                  <span className="font-mono-avionics font-bold text-slate-200">
                    {aircraft_spec.icao_type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Category</span>
                  <span className="text-slate-200 capitalize">
                    {aircraft_spec.category || "Commercial"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Engine</span>
                  <span className="text-slate-200 capitalize">
                    {aircraft_spec.engine_type || "Turbofan"} ({aircraft_spec.number_of_engines || 2}x)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Passenger Capacity</span>
                  <span className="font-mono-avionics font-bold text-emerald-400">
                    {aircraft_spec.passenger_capacity ? `${aircraft_spec.passenger_capacity} seats` : "N/A"}
                  </span>
                </div>
                {aircraft_spec.mtow_kg && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Max Takeoff Weight</span>
                    <span className="font-mono-avionics text-slate-200">
                      {Math.round(aircraft_spec.mtow_kg).toLocaleString()} kg
                    </span>
                  </div>
                )}
                {aircraft_spec.cruise_speed_kts && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Cruise Speed</span>
                    <span className="font-mono-avionics text-slate-200">
                      {aircraft_spec.cruise_speed_kts} kts
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Standard specifications active for {identification.aircraft_type_icao || identification.category_name || "General Aviation"}.</span>
          </div>
        )}
      </div>
    </div>
  );
};
