"use client";

import React, { useState, useEffect } from "react";
import { Tooltip } from "@heroui/react";
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
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { NormalizedFlight, AircraftSpec } from "@/types/flight";
import { fetchAircraftSpec } from "@/lib/api";
import { SPEC_EXPLANATIONS, SpecExplanation } from "@/lib/aircraftSpecs";

interface FlightDetailsDrawerProps {
  flight: NormalizedFlight | null;
  onClose: () => void;
}

interface AircraftDataCardProps {
  label: string;
  fieldKey: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  activeTooltip?: string | null;
  setActiveTooltip?: (key: string | null) => void;
  tooltipAlign?: "top" | "bottom";
  className?: string;
}

const AircraftDataCard: React.FC<AircraftDataCardProps> = ({
  label,
  fieldKey,
  value,
  subValue,
  className = "",
}) => {
  const explanation = SPEC_EXPLANATIONS[fieldKey];

  return (
    <div
      className={`relative p-2.5 rounded-xl bg-[#141414] border border-white/8 flex flex-col justify-between group hover:border-white/15 transition-colors ${className}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span
          className="text-[10px] text-neutral-400 uppercase tracking-wider block font-sans truncate"
          title={label}
        >
          {label}
        </span>

        {explanation && (
          <div className="shrink-0">
            <Tooltip closeDelay={100} placement="top">
              <Tooltip.Trigger>
                <button
                  type="button"
                  aria-label={`Explanation for ${explanation.meaning}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-sans text-neutral-400 hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  i
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content className="z-[9999] max-w-[280px] p-3 rounded-xl bg-[#18181b]/95 border border-white/20 shadow-2xl backdrop-blur-md text-left">
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

export const FlightDetailsDrawer: React.FC<FlightDetailsDrawerProps> = ({
  flight,
  onClose,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [detailedSpec, setDetailedSpec] = useState<AircraftSpec | null>(null);
  const [loadingSpec, setLoadingSpec] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  useEffect(() => {
    setDetailedSpec(flight?.aircraft_spec || null);
    setActiveTooltip(null);
  }, [flight?.identification.icao24, flight?.aircraft_spec]);

  if (!flight) return null;

  const { identification, position, aircraft_spec } = flight;
  const isNepal = identification.is_nepal_registered;
  const onGround = position.on_ground;

  const effectiveSpec = detailedSpec || aircraft_spec;

  const handleToggleDetails = async () => {
    const nextExpanded = !isDetailsExpanded;
    setIsDetailsExpanded(nextExpanded);

    if (nextExpanded) {
      const identifier =
        flight.aircraft_spec?.icao_type ||
        flight.identification.aircraft_type_icao ||
        flight.aircraft_spec?.model;

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
    <div
      className={`absolute right-4 top-20 bottom-4 ${
        isDetailsExpanded ? "w-96 md:w-[540px]" : "w-84 md:w-96"
      } glass-panel rounded-2xl z-30 flex flex-col overflow-hidden transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-right-4 bg-[#0a0a0a] border border-white/8 shadow-2xl`}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/8 bg-[#0e0e0e] flex items-start justify-between shrink-0">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-mono-avionics text-xl font-extrabold text-neutral-100 tracking-wider">
              {identification.callsign || identification.icao24.toUpperCase()}
            </span>
            {isNepal && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                NEPAL (9N)
              </span>
            )}
            {identification.squawk && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-avionics font-bold bg-neutral-900 text-neutral-300 border border-neutral-700">
                SQ {identification.squawk}
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-300 font-medium">
            {identification.operator_name ||
              identification.operator_icao ||
              (isNepal ? "Nepalese Registered Aircraft" : "Unknown Operator")}
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono-avionics text-neutral-400">
            <span>
              ICAO HEX: <strong className="text-neutral-200">{identification.icao24}</strong>
            </span>
            {identification.origin_country && (
              <>
                <span>•</span>
                <span className="text-neutral-300 font-sans">{identification.origin_country}</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-neutral-800/60 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Dossier Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Flight Route / Itinerary Card */}
        <div className="p-3.5 rounded-xl bg-[#141414] border border-white/8 shadow-md">
          <div className="flex items-center justify-between">
            {/* Origin Airport */}
            <div className="text-left flex-1 min-w-0 pr-2">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                Departure
              </span>
              <span className="font-mono-avionics text-xl font-extrabold text-neutral-100 tracking-wide block">
                {flight.route?.origin_iata || flight.route?.origin_icao || "N/A"}
              </span>
              <span
                className="text-xs text-neutral-400 font-medium truncate block"
                title={flight.route?.origin_name || "Departure Airport Unknown"}
              >
                {flight.route?.origin_name || "Unknown Departure"}
              </span>
            </div>

            {/* Flight Path Graphic */}
            <div className="flex flex-col items-center px-2 shrink-0">
              <div className="flex items-center space-x-1.5 text-neutral-300">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                <div className="w-14 h-[2px] bg-gradient-to-r from-neutral-600 via-neutral-300 to-emerald-400 relative">
                  <Plane className="w-3.5 h-3.5 text-white absolute -top-[6px] left-1/2 -translate-x-1/2 transform rotate-90" />
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>
              <span className="text-[9px] font-mono-avionics text-neutral-400 mt-1 uppercase font-semibold">
                {onGround
                  ? "On Ground"
                  : altFt !== null
                  ? `En Route • FL${Math.round(altFt / 100)}`
                  : "En Route"}
              </span>
            </div>

            {/* Destination Airport */}
            <div className="text-right flex-1 min-w-0 pl-2">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                Arrival
              </span>
              <span className="font-mono-avionics text-xl font-extrabold text-emerald-400 tracking-wide block">
                {flight.route?.destination_iata || flight.route?.destination_icao || "N/A"}
              </span>
              <span
                className="text-xs text-neutral-400 font-medium truncate block"
                title={flight.route?.destination_name || "Destination Airport Unknown"}
              >
                {flight.route?.destination_name || "Unknown Destination"}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Avionics Grid */}
        <div>
          <h3 className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase mb-2 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-white" />
            <span>Flight Kinematics</span>
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {/* Altitude */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/8">
              <span className="text-[10px] text-neutral-400 uppercase block font-sans">Altitude (Baro)</span>
              <span className="text-base font-bold font-mono-avionics text-neutral-100">
                {onGround ? "ON GROUND" : altFt !== null ? `${altFt.toLocaleString()} ft` : "N/A"}
              </span>
              {position.altitude_baro_m && (
                <span className="text-[10px] text-neutral-400 block font-mono-avionics">
                  {Math.round(position.altitude_baro_m).toLocaleString()} m MSL
                </span>
              )}
            </div>

            {/* Groundspeed */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/8">
              <span className="text-[10px] text-neutral-400 uppercase block font-sans">Groundspeed</span>
              <span className="text-base font-bold font-mono-avionics text-neutral-200">
                {speedKts !== null ? `${speedKts} kts` : "N/A"}
              </span>
              {speedKmh && (
                <span className="text-[10px] text-neutral-400 block font-mono-avionics">
                  {speedKmh} km/h
                </span>
              )}
            </div>

            {/* Heading & Track */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/8">
              <span className="text-[10px] text-neutral-400 uppercase block font-sans">Track Heading</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-bold font-mono-avionics text-neutral-200">
                  {heading !== null ? `${heading}°` : "N/A"}
                </span>
                {heading !== null && (
                  <Compass
                    className="w-4 h-4 text-neutral-300 inline-block"
                    style={{ transform: `rotate(${heading}deg)` }}
                  />
                )}
              </div>
            </div>

            {/* Vertical Rate */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-white/8">
              <span className="text-[10px] text-neutral-400 uppercase block font-sans">Vertical Speed</span>
              <div className="flex items-center space-x-1">
                {vertRateFpm && vertRateFpm > 100 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : vertRateFpm && vertRateFpm < -100 ? (
                  <ArrowDownRight className="w-4 h-4 text-amber-400" />
                ) : null}
                <span className="text-base font-bold font-mono-avionics text-neutral-200">
                  {vertRateFpm !== null
                    ? `${vertRateFpm > 0 ? "+" : ""}${vertRateFpm} fpm`
                    : "Level (0 fpm)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* OpenSky Raw Telemetry Attributes */}
        <div>
          <h3 className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase mb-2 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>OpenSky Transponder Telemetry</span>
          </h3>

          <div className="p-3 rounded-xl bg-[#141414] border border-white/8 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-neutral-400 block text-[10px] font-sans">Squawk Code</span>
                <span className="font-mono-avionics font-bold text-neutral-200">
                  {identification.squawk || "Not Transmitted"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] font-sans">Surveillance Source</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      identification.position_source?.includes("MLAT")
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : identification.position_source?.includes("UAT")
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : identification.position_source?.includes("FLARM")
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-neutral-800 text-neutral-300 border-neutral-700"
                    }`}
                  >
                    {identification.position_source || "ADS-B"}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] font-sans">Country of Registration</span>
                <span className="text-neutral-200 font-medium">
                  {identification.origin_country || "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] font-sans">Emitter Category</span>
                <span className="text-neutral-200 font-medium truncate block">
                  {identification.category_name || "General Aviation"}
                </span>
              </div>
              {altGeoFt !== null && (
                <div>
                  <span className="text-neutral-400 block text-[10px] font-sans">Geometric Altitude</span>
                  <span className="font-mono-avionics text-neutral-300">
                    {altGeoFt.toLocaleString()} ft ({Math.round(position.altitude_geo_m || 0)} m)
                  </span>
                </div>
              )}
              <div>
                <span className="text-neutral-400 block text-[10px] font-sans">IDENT (SPI)</span>
                <span
                  className={`font-mono-avionics font-semibold ${
                    identification.spi ? "text-emerald-400" : "text-neutral-400"
                  }`}
                >
                  {identification.spi ? "ACTIVE (Squawking Ident)" : "INACTIVE"}
                </span>
              </div>
            </div>

            {/* GPS Coordinates & Last Contact */}
            <div className="pt-2 border-t border-white/6 flex items-center justify-between text-[11px] font-mono-avionics text-neutral-400">
              <div>
                LAT/LON:{" "}
                <span className="text-neutral-300">
                  {position.latitude?.toFixed(4)}°, {position.longitude?.toFixed(4)}°
                </span>
              </div>
              {flight.data_freshness_seconds !== null && (
                <div>
                  Signal:{" "}
                  <span className="text-emerald-400">
                    {Math.round(flight.data_freshness_seconds || 0)}s ago
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Spatial / Airspace Proximity */}
        {flight.nearest_airport && (
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-white" />
              <span>Airspace Proximity</span>
            </h3>

            <div className="p-3 rounded-xl bg-[#141414] border border-white/8 text-xs">
              <div className="text-neutral-200 font-semibold">{flight.nearest_airport}</div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono-avionics">
                Proximity: {flight.nearest_airport_distance_km} km (
                {((flight.nearest_airport_distance_km || 0) * 0.539957).toFixed(1)} NM)
              </div>
            </div>
          </div>
        )}

        {/* Aircraft Specifications from Database Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-neutral-300" />
              <span>Aircraft Specifications</span>
            </h3>

            {(effectiveSpec || identification.aircraft_type_icao) && (
              <button
                type="button"
                onClick={handleToggleDetails}
                disabled={loadingSpec}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
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

          {effectiveSpec ? (
            isDetailsExpanded ? (
              /* Extended Database Profile View */
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* Identification / Model Header Card */}
                <div className="p-3 rounded-xl bg-[#141414] border border-white/8 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-white/6 pb-2">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-sans">
                        Commercial Model
                      </span>
                      <span className="font-bold text-neutral-100 font-mono-avionics text-sm">
                        {effectiveSpec.model}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-sans">
                        ICAO Type
                      </span>
                      <span className="font-bold text-emerald-400 font-mono-avionics text-sm">
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                    <AircraftDataCard
                      label="Engine Type"
                      fieldKey="engine_type"
                      value={effectiveSpec.engine_type || "Turbofan"}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                    <AircraftDataCard
                      label="Engine Model"
                      fieldKey="engine_model"
                      value={effectiveSpec.engine_model || "Not specified"}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                  </div>
                </div>

                {/* Weight Limitations */}
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                    <AircraftDataCard
                      label="Max Takeoff (MTOW)"
                      fieldKey="mtow_kg"
                      value={
                        effectiveSpec.mtow_kg
                          ? `${Math.round(effectiveSpec.mtow_kg).toLocaleString()} kg`
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                    <AircraftDataCard
                      label="Max Landing (MLW)"
                      fieldKey="mlw_kg"
                      value={
                        effectiveSpec.mlw_kg
                          ? `${Math.round(effectiveSpec.mlw_kg).toLocaleString()} kg`
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                    <AircraftDataCard
                      label="Fuel Capacity"
                      fieldKey="fuel_capacity_liters"
                      value={
                        effectiveSpec.fuel_capacity_liters
                          ? `${Math.round(effectiveSpec.fuel_capacity_liters).toLocaleString()} L`
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                  </div>
                </div>

                {/* Capacity & Range */}
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                  </div>
                </div>

                {/* Speed Profiles */}
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                  </div>
                </div>

                {/* Runway Requirements */}
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                  </div>
                </div>

                {/* Airframe Dimensions & Aerodynamics */}
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Wing Sweep (25%)"
                      fieldKey="wing_sweep25"
                      value={
                        effectiveSpec.wing_sweep25 !== undefined && effectiveSpec.wing_sweep25 !== null
                          ? `${effectiveSpec.wing_sweep25}°`
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Wing Position"
                      fieldKey="wing_position"
                      value={
                        effectiveSpec.wing_position
                          ? effectiveSpec.wing_position.toUpperCase()
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Tail Areas (HTP / VTP)"
                      fieldKey="htp_area"
                      value={
                        effectiveSpec.htp_area || effectiveSpec.vtp_area
                          ? `${effectiveSpec.htp_area ?? "—"} / ${effectiveSpec.vtp_area ?? "—"} m²`
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                  </div>
                </div>

                {/* Propulsion & Thrust Dynamics */}
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
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
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Thruster Type"
                      fieldKey="thruster_type"
                      value={effectiveSpec.thruster_type ? effectiveSpec.thruster_type.toUpperCase() : "N/A"}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Bypass Ratio (BPR)"
                      fieldKey="bpr"
                      value={
                        effectiveSpec.bpr !== undefined && effectiveSpec.bpr !== null
                          ? `${effectiveSpec.bpr}`
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Energy / Fuel"
                      fieldKey="energy_type"
                      value={effectiveSpec.energy_type ? effectiveSpec.energy_type.toUpperCase() : "N/A"}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Engine Position"
                      fieldKey="engine_position"
                      value={effectiveSpec.engine_position ? effectiveSpec.engine_position.toUpperCase() : "N/A"}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Lateral Arm (Y-Arm)"
                      fieldKey="engine_y_arm"
                      value={
                        effectiveSpec.engine_y_arm !== undefined && effectiveSpec.engine_y_arm !== null
                          ? `${effectiveSpec.engine_y_arm} m`
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                    <AircraftDataCard
                      label="Prop / Rotor Diameter"
                      fieldKey="rotor_diameter"
                      value={
                        effectiveSpec.rotor_diameter !== undefined && effectiveSpec.rotor_diameter !== null
                          ? `${effectiveSpec.rotor_diameter} m`
                          : "N/A"
                      }
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="top"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Compact Summary View */
              <div className="p-3 rounded-xl bg-[#141414] border border-white/8 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-white/6 pb-2">
                  <span className="text-neutral-400 font-medium font-sans">Model:</span>
                  <span className="font-bold text-neutral-100 font-mono-avionics">
                    {effectiveSpec.model}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <AircraftDataCard
                    label="ICAO Type"
                    fieldKey="icao_type"
                    value={effectiveSpec.icao_type}
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
                  />

                  <AircraftDataCard
                    label="Category"
                    fieldKey="category"
                    value={
                      effectiveSpec.category
                        ? effectiveSpec.category.replace(/_/g, " ")
                        : "Commercial"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
                  />

                  <AircraftDataCard
                    label="Powerplant"
                    fieldKey="engine_type"
                    value={effectiveSpec.engine_type || "Turbofan"}
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
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
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
                  />

                  {effectiveSpec.engine_model && (
                    <AircraftDataCard
                      label="Engine Model"
                      fieldKey="engine_model"
                      value={effectiveSpec.engine_model}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                      className="col-span-2"
                    />
                  )}

                  <AircraftDataCard
                    label="Passenger Capacity"
                    fieldKey="passenger_capacity"
                    value={
                      effectiveSpec.passenger_capacity
                        ? `${effectiveSpec.passenger_capacity} seats`
                        : "N/A"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
                  />

                  {effectiveSpec.mtow_kg && (
                    <AircraftDataCard
                      label="Max Takeoff (MTOW)"
                      fieldKey="mtow_kg"
                      value={`${Math.round(effectiveSpec.mtow_kg).toLocaleString()} kg`}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                  )}

                  {effectiveSpec.cruise_speed_kts && (
                    <AircraftDataCard
                      label="Cruise Speed"
                      fieldKey="cruise_speed_kts"
                      value={`${effectiveSpec.cruise_speed_kts} kts`}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                  )}

                  {effectiveSpec.oew_kg && (
                    <AircraftDataCard
                      label="Operating Empty (OEW)"
                      fieldKey="oew_kg"
                      value={`${Math.round(effectiveSpec.oew_kg).toLocaleString()} kg`}
                      activeTooltip={activeTooltip}
                      setActiveTooltip={setActiveTooltip}
                      tooltipAlign="bottom"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-[#141414] border border-white/8 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <Layers className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>
                  Type Code:{" "}
                  <strong className="font-mono-avionics text-neutral-100">
                    {identification.aircraft_type_icao || "Unknown"}
                  </strong>
                </span>
              </div>
              {identification.aircraft_type_icao && (
                <button
                  type="button"
                  onClick={handleToggleDetails}
                  disabled={loadingSpec}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {loadingSpec ? (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  <span>More Details</span>
                </button>
              )}
            </div>
            {!identification.aircraft_type_icao && (
              <p className="text-[11px] text-neutral-500">
                Detailed specifications unavailable for this unverified aircraft.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
