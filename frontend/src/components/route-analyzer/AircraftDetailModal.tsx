"use client";

import React, { useState } from "react";
import { Tooltip } from "@heroui/react";
import { AircraftAnalysisResult } from "@/types/routeAnalyzer";
import { AircraftSpec } from "@/types/flight";
import { fetchAircraftSpec } from "@/lib/api";
import {
  X,
  Plane,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

interface AircraftDetailModalProps {
  result: AircraftAnalysisResult | null;
  onClose: () => void;
  routeDistanceKm?: number;
}

import { SPEC_EXPLANATIONS, SpecExplanation } from "@/lib/aircraftSpecs";

interface UpperMetricCardProps {
  label: string;
  tooltipTitle: string;
  tooltipBadge: string;
  tooltipDesc: string;
  value: React.ReactNode;
  valueClassName?: string;
  subValue?: React.ReactNode;
}

const UpperMetricCard: React.FC<UpperMetricCardProps> = ({
  label,
  tooltipTitle,
  tooltipBadge,
  tooltipDesc,
  value,
  valueClassName = "text-white",
  subValue,
}) => (
  <div className="relative p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between group hover:border-white/15 transition-colors font-sans">
    <div className="flex items-start justify-between gap-1 mb-1">
      <span
        className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-sans truncate font-medium"
        title={label}
      >
        {label}
      </span>
      <div className="shrink-0">
        <Tooltip closeDelay={100}>
          <Tooltip.Trigger>
            <button
              type="button"
              aria-label={`Explanation for ${tooltipTitle}`}
              className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-sans text-[#A1A1AA] hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
            >
              i
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content
            placement="top"
            className="z-[9999] max-w-[280px] p-3 rounded-xl bg-[#1c1c1f]/95 border border-white/20 shadow-2xl backdrop-blur-md text-left"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1.5 gap-2">
              <span className="text-[11px] font-bold text-neutral-100 font-sans tracking-tight">
                {tooltipTitle}
              </span>
              <span className="text-[9px] font-mono text-emerald-400 font-semibold shrink-0">
                {tooltipBadge}
              </span>
            </div>
            <p className="text-[10px] text-neutral-300 font-sans leading-relaxed">
              {tooltipDesc}
            </p>
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>

    <div>
      <div className={`text-base font-bold font-mono truncate ${valueClassName}`}>
        {value ?? "—"}
      </div>
      {subValue && (
        <div className="text-[10px] text-neutral-400 font-sans mt-0.5 truncate">
          {subValue}
        </div>
      )}
    </div>
  </div>
);

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
  activeTooltip,
  setActiveTooltip,
  tooltipAlign,
}) => {
  const explanation = fieldKey ? SPEC_EXPLANATIONS[fieldKey] : undefined;

  return (
    <div className="relative p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between group hover:border-white/15 transition-colors">
      <div className="flex items-start justify-between gap-1 mb-1">
        <span
          className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-sans truncate"
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
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-sans text-[#A1A1AA] hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  i
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content
                placement="top"
                className="z-[9999] max-w-[280px] p-3 rounded-xl bg-[#1c1c1f]/95 border border-white/20 shadow-2xl backdrop-blur-md text-left"
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
          {value ?? "—"}
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

export const AircraftDetailModal: React.FC<AircraftDetailModalProps> = ({
  result,
  onClose,
  routeDistanceKm,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);
  const [spec, setSpec] = useState<AircraftSpec | null>(null);
  const [loadingSpec, setLoadingSpec] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  if (!result) return null;

  const isWithin = result.within_calculated_limits;

  const handleToggleDetails = async () => {
    const next = !isDetailsExpanded;
    setIsDetailsExpanded(next);

    if (next && !spec) {
      try {
        setLoadingSpec(true);
        const data = await fetchAircraftSpec(result.aircraft_identifier);
        if (data) {
          setSpec(data);
        }
      } catch (err) {
        console.warn("Could not load aircraft spec from database:", err);
      } finally {
        setLoadingSpec(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full ${
          isDetailsExpanded ? "max-w-2xl" : "max-w-lg"
        } rounded-2xl bg-[#111113] border border-white/[0.12] shadow-2xl p-5 md:p-6 space-y-5 text-[#FAFAFA] font-sans relative my-auto transition-all duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/[0.08]">
          <div>
            <h3 className="text-base md:text-lg font-bold text-white tracking-tight font-sans">
              {result.aircraft_name}
            </h3>
            <div className="flex items-center space-x-2 text-xs text-[#A1A1AA] font-mono mt-0.5">
              <span>Model ID: {result.aircraft_identifier}</span>
              {result.passenger_capacity && (
                <>
                  <span>•</span>
                  <span>{result.passenger_capacity} Passengers</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#71717A] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Remark Text (No colored background, badge, tick icon, or decoration) */}
        <div className="text-xs sm:text-sm font-sans">
          <span className="text-neutral-400">Remark: </span>
          <span className={isWithin ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
            {isWithin ? "Within Calculated Limit" : "Outside Calculated Limit"}
          </span>
        </div>

        {/* Detailed Route Comparison Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <UpperMetricCard
            label="Est. Flight Time"
            tooltipTitle="Estimated Flight Time"
            tooltipBadge="MINUTES"
            tooltipDesc="Modeled block flight time including cruise at ground speed and descent at approach speed."
            value={
              typeof result.estimated_flight_time_min === "number"
                ? `${Math.round(result.estimated_flight_time_min)} min`
                : "—"
            }
            subValue="Cruise + descent modeling"
          />

          <UpperMetricCard
            label="Cruise Speed"
            tooltipTitle="Cruise True Airspeed"
            tooltipBadge="KM/H (TAS)"
            tooltipDesc="Design cruising true airspeed in kilometers per hour based on aircraft specification data."
            value={
              typeof result.cruise_speed_kmh === "number"
                ? `${Math.round(result.cruise_speed_kmh)} km/h`
                : "—"
            }
            subValue="True Airspeed (TAS)"
          />

          <UpperMetricCard
            label="Nominal Range"
            tooltipTitle="Nominal Operating Range"
            tooltipBadge="KM"
            tooltipDesc="Manufacturer standard operational range under standard atmospheric conditions."
            value={
              typeof result.nominal_range_km === "number"
                ? `${Math.round(result.nominal_range_km).toLocaleString()} km`
                : "—"
            }
            subValue={
              typeof routeDistanceKm === "number"
                ? `Route: ${Math.round(routeDistanceKm)} km`
                : "—"
            }
          />

          <UpperMetricCard
            label="Range Margin"
            tooltipTitle="Route Range Margin"
            tooltipBadge="KM"
            tooltipDesc="Remaining operational range buffer above the great-circle route distance."
            value={
              typeof result.range_margin_km === "number"
                ? `${result.range_margin_km >= 0 ? "+" : ""}${Math.round(result.range_margin_km).toLocaleString()} km`
                : "—"
            }
            valueClassName={
              typeof result.range_margin_km === "number" && result.range_margin_km >= 0
                ? "text-emerald-400"
                : "text-rose-400"
            }
            subValue="Excess capability above route"
          />

          <UpperMetricCard
            label="Takeoff Margin (TOFL)"
            tooltipTitle="Takeoff Runway Margin"
            tooltipBadge="METERS"
            tooltipDesc="Departure airport longest active runway length minus the aircraft's required Takeoff Field Length (TOFL)."
            value={
              typeof result.takeoff_runway_margin_m === "number"
                ? `${result.takeoff_runway_margin_m >= 0 ? "+" : ""}${Math.round(result.takeoff_runway_margin_m)} m`
                : "—"
            }
            valueClassName={
              typeof result.takeoff_runway_margin_m === "number" && result.takeoff_runway_margin_m >= 0
                ? "text-emerald-400"
                : "text-rose-400"
            }
            subValue="Departure runway minus TOFL"
          />

          <UpperMetricCard
            label="Landing Margin (LFL)"
            tooltipTitle="Landing Runway Margin"
            tooltipBadge="METERS"
            tooltipDesc="Destination airport longest active runway length minus the aircraft's required Landing Field Length (LFL)."
            value={
              typeof result.landing_runway_margin_m === "number"
                ? `${result.landing_runway_margin_m >= 0 ? "+" : ""}${Math.round(result.landing_runway_margin_m)} m`
                : "—"
            }
            valueClassName={
              typeof result.landing_runway_margin_m === "number" && result.landing_runway_margin_m >= 0
                ? "text-emerald-400"
                : "text-rose-400"
            }
            subValue="Destination runway minus LFL"
          />
        </div>

        {/* Database Aircraft Specification Section with Toggle */}
        <div className="pt-2 border-t border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
              <Plane className="w-3.5 h-3.5 text-[#108AEF]" />
              <span>Aircraft Specifications (Database)</span>
            </div>

            <button
              type="button"
              onClick={handleToggleDetails}
              disabled={loadingSpec}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingSpec ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
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
          </div>

          {/* Extended Aircraft Specifications View */}
          {isDetailsExpanded && spec && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Weight Limitations */}
              <div>
                <div className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1.5">
                  Weight Limitations
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <AircraftDataCard
                    label="Operating Empty (OEW)"
                    fieldKey="oew_kg"
                    value={
                      spec.oew_kg
                        ? `${Math.round(spec.oew_kg).toLocaleString()} kg`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
                  />
                  <AircraftDataCard
                    label="Max Takeoff (MTOW)"
                    fieldKey="mtow_kg"
                    value={
                      spec.mtow_kg
                        ? `${Math.round(spec.mtow_kg).toLocaleString()} kg`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
                  />
                  <AircraftDataCard
                    label="Max Landing (MLW)"
                    fieldKey="mlw_kg"
                    value={
                      spec.mlw_kg
                        ? `${Math.round(spec.mlw_kg).toLocaleString()} kg`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
                  />
                  <AircraftDataCard
                    label="Fuel Capacity"
                    fieldKey="fuel_capacity_liters"
                    value={
                      spec.fuel_capacity_liters
                        ? `${Math.round(spec.fuel_capacity_liters).toLocaleString()} L`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="bottom"
                  />
                </div>
              </div>

              {/* Capacities & Speed */}
              <div>
                <div className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1.5">
                  Performance & Aerodynamics
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <AircraftDataCard
                    label="Approach Speed"
                    fieldKey="approach_speed_kts"
                    value={
                      spec.approach_speed_kts
                        ? `${spec.approach_speed_kts} kts`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Cruise Speed"
                    fieldKey="cruise_speed_kts"
                    value={
                      spec.cruise_speed_kts
                        ? `${spec.cruise_speed_kts} kts`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Maximum Speed"
                    fieldKey="max_speed_kts"
                    value={
                      spec.max_speed_kts
                        ? `${spec.max_speed_kts} kts`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                </div>
              </div>

              {/* Field Length Requirements & Range */}
              <div>
                <div className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1.5">
                  Field Lengths & Range
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <AircraftDataCard
                    label="Takeoff Field (TOFL)"
                    fieldKey="takeoff_field_length_m"
                    value={
                      spec.takeoff_field_length_m
                        ? `${Math.round(spec.takeoff_field_length_m).toLocaleString()} m`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Landing Field (LFL)"
                    fieldKey="landing_field_length_m"
                    value={
                      spec.landing_field_length_m
                        ? `${Math.round(spec.landing_field_length_m).toLocaleString()} m`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Nominal Range"
                    fieldKey="nominal_range_nm"
                    value={
                      spec.nominal_range_nm
                        ? `${Math.round(spec.nominal_range_nm).toLocaleString()} NM`
                        : "—"
                    }
                    subValue={
                      spec.nominal_range_nm
                        ? `${Math.round(spec.nominal_range_nm * 1.852).toLocaleString()} km`
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
                <div className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1.5">
                  Airframe Dimensions & Aerodynamics
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <AircraftDataCard
                    label="Wing Span"
                    fieldKey="wing_span"
                    value={
                      spec.wing_span !== undefined && spec.wing_span !== null
                        ? `${spec.wing_span} m`
                        : "—"
                    }
                    subValue={
                      spec.wing_span
                        ? `${(spec.wing_span * 3.28084).toFixed(1)} ft`
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
                      spec.fuselage_width !== undefined && spec.fuselage_width !== null
                        ? `${spec.fuselage_width} m`
                        : "—"
                    }
                    subValue={
                      spec.fuselage_width
                        ? `${(spec.fuselage_width * 3.28084).toFixed(1)} ft`
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
                      spec.total_length !== undefined && spec.total_length !== null
                        ? `${spec.total_length} m`
                        : "—"
                    }
                    subValue={
                      spec.total_length
                        ? `${(spec.total_length * 3.28084).toFixed(1)} ft`
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
                      spec.total_height !== undefined && spec.total_height !== null
                        ? `${spec.total_height} m`
                        : "—"
                    }
                    subValue={
                      spec.total_height
                        ? `${(spec.total_height * 3.28084).toFixed(1)} ft`
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
                      spec.wing_area !== undefined && spec.wing_area !== null
                        ? `${spec.wing_area} m²`
                        : "—"
                    }
                    subValue={
                      spec.wing_area
                        ? `${(spec.wing_area * 10.7639).toFixed(1)} ft²`
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
                      spec.wing_sweep25 !== undefined && spec.wing_sweep25 !== null
                        ? `${spec.wing_sweep25}°`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Wing Position"
                    fieldKey="wing_position"
                    value={spec.wing_position ? spec.wing_position.toUpperCase() : "—"}
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Tail Areas (HTP / VTP)"
                    fieldKey="htp_area"
                    value={
                      spec.htp_area || spec.vtp_area
                        ? `${spec.htp_area ?? "—"} / ${spec.vtp_area ?? "—"} m²`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                </div>
              </div>

              {/* Propulsion & Thrust Dynamics */}
              <div>
                <div className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1.5">
                  Propulsion & Thrust Dynamics
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <AircraftDataCard
                    label="Max Takeoff Thrust"
                    fieldKey="max_thrust"
                    value={
                      spec.max_thrust !== undefined && spec.max_thrust !== null
                        ? `${Math.round(spec.max_thrust).toLocaleString()} N`
                        : "—"
                    }
                    subValue={
                      spec.max_thrust
                        ? `${(spec.max_thrust / 1000).toFixed(1)} kN (${Math.round(spec.max_thrust * 0.224809).toLocaleString()} lbf)`
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
                      spec.max_power !== undefined && spec.max_power !== null
                        ? `${Math.round(spec.max_power).toLocaleString()} kW`
                        : "—"
                    }
                    subValue={
                      spec.max_power
                        ? `${Math.round(spec.max_power * 1.34102).toLocaleString()} hp`
                        : undefined
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Thruster Type"
                    fieldKey="thruster_type"
                    value={spec.thruster_type ? spec.thruster_type.toUpperCase() : "—"}
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Bypass Ratio (BPR)"
                    fieldKey="bpr"
                    value={
                      spec.bpr !== undefined && spec.bpr !== null
                        ? `${spec.bpr}`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Energy / Fuel"
                    fieldKey="energy_type"
                    value={spec.energy_type ? spec.energy_type.toUpperCase() : "—"}
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Engine Position"
                    fieldKey="engine_position"
                    value={spec.engine_position ? spec.engine_position.toUpperCase() : "—"}
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Lateral Arm (Y-Arm)"
                    fieldKey="engine_y_arm"
                    value={
                      spec.engine_y_arm !== undefined && spec.engine_y_arm !== null
                        ? `${spec.engine_y_arm} m`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                  <AircraftDataCard
                    label="Prop / Rotor Diameter"
                    fieldKey="rotor_diameter"
                    value={
                      spec.rotor_diameter !== undefined && spec.rotor_diameter !== null
                        ? `${spec.rotor_diameter} m`
                        : "—"
                    }
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                    tooltipAlign="top"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
