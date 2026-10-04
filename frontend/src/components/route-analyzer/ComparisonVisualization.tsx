"use client";

import React, { useState, useMemo } from "react";
import { AircraftAnalysisResult } from "@/types/routeAnalyzer";
import { ChevronDown, Check } from "lucide-react";
import { Tooltip, Dropdown } from "@heroui/react";
import { motion } from "framer-motion";

interface ComparisonVisualizationProps {
  results: AircraftAnalysisResult[];
  routeDistanceKm: number;
  departureRunwayM?: number | null;
  destinationRunwayM?: number | null;
  departureIdent?: string;
  destinationIdent?: string;
}

type MetricKey =
  | "flight_time"
  | "range_margin"
  | "takeoff_margin"
  | "landing_margin"
  | "cruise_speed"
  | "nominal_range";

interface MetricDefinition {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  better: "lower" | "higher";
  getValue: (r: AircraftAnalysisResult) => number | null;
  formatBarValue: (val: number | null) => string;
  formatDetailedValue: (val: number | null) => string;
  leaderTitle: string;
  avgTitle: string;
}

const METRICS: MetricDefinition[] = [
  {
    key: "flight_time",
    label: "Estimated Flight Time",
    shortLabel: "Flight Time",
    unit: "min",
    better: "lower",
    getValue: (r) => r.estimated_flight_time_min ?? null,
    formatBarValue: (v) => (v != null ? `${Math.round(v)} min` : "—"),
    formatDetailedValue: (v) => (v != null ? `${Math.round(v)} min` : "—"),
    leaderTitle: "Fastest Enroute Time",
    avgTitle: "Fleet Average Time",
  },
  {
    key: "range_margin",
    label: "Range Margin",
    shortLabel: "Range Margin",
    unit: "km",
    better: "higher",
    getValue: (r) => r.range_margin_km ?? null,
    formatBarValue: (v) => (v != null ? `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString()} km` : "—"),
    formatDetailedValue: (v) =>
      v != null
        ? `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString()} km (${Math.round(v * 0.539957).toLocaleString()} nm)`
        : "—",
    leaderTitle: "Largest Range Reserve",
    avgTitle: "Average Range Buffer",
  },
  {
    key: "takeoff_margin",
    label: "Takeoff Runway Margin",
    shortLabel: "Takeoff Margin",
    unit: "m",
    better: "higher",
    getValue: (r) => r.takeoff_runway_margin_m ?? null,
    formatBarValue: (v) => (v != null ? `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString()} m` : "—"),
    formatDetailedValue: (v) =>
      v != null
        ? `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString()} m (${Math.round(v * 3.28084).toLocaleString()} ft)`
        : "—",
    leaderTitle: "Max Takeoff Buffer",
    avgTitle: "Average Takeoff Buffer",
  },
  {
    key: "landing_margin",
    label: "Landing Runway Margin",
    shortLabel: "Landing Margin",
    unit: "m",
    better: "higher",
    getValue: (r) => r.landing_runway_margin_m ?? null,
    formatBarValue: (v) => (v != null ? `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString()} m` : "—"),
    formatDetailedValue: (v) =>
      v != null
        ? `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString()} m (${Math.round(v * 3.28084).toLocaleString()} ft)`
        : "—",
    leaderTitle: "Max Landing Buffer",
    avgTitle: "Average Landing Buffer",
  },
  {
    key: "cruise_speed",
    label: "Cruise Speed",
    shortLabel: "Cruise Speed",
    unit: "km/h",
    better: "higher",
    getValue: (r) => r.cruise_speed_kmh ?? null,
    formatBarValue: (v) => (v != null ? `${Math.round(v).toLocaleString()} km/h` : "—"),
    formatDetailedValue: (v) =>
      v != null
        ? `${Math.round(v).toLocaleString()} km/h (${Math.round(v * 0.539957)} kts)`
        : "—",
    leaderTitle: "Highest Cruise Speed",
    avgTitle: "Fleet Average Speed",
  },
  {
    key: "nominal_range",
    label: "Nominal Range",
    shortLabel: "Nominal Range",
    unit: "km",
    better: "higher",
    getValue: (r) => r.nominal_range_km ?? null,
    formatBarValue: (v) => (v != null ? `${Math.round(v).toLocaleString()} km` : "—"),
    formatDetailedValue: (v) =>
      v != null
        ? `${Math.round(v).toLocaleString()} km (${Math.round(v * 0.539957).toLocaleString()} nm)`
        : "—",
    leaderTitle: "Longest Operating Range",
    avgTitle: "Average Operating Range",
  },
];

export const ComparisonVisualization: React.FC<ComparisonVisualizationProps> = ({
  results,
  routeDistanceKm,
  departureRunwayM,
  destinationRunwayM,
  departureIdent = "DEP",
  destinationIdent = "DEST",
}) => {
  const [selectedMetricKey, setSelectedMetricKey] = useState<MetricKey>("flight_time");

  const currentMetric = useMemo(() => {
    return METRICS.find((m) => m.key === selectedMetricKey) || METRICS[0];
  }, [selectedMetricKey]);

  if (!results || results.length < 2) return null;

  // Extract all valid numeric values for the selected metric
  const itemsWithValues = useMemo(() => {
    return results.map((r) => ({
      result: r,
      value: currentMetric.getValue(r),
      isWithin: r.within_calculated_limits,
    }));
  }, [results, currentMetric]);

  const validValues = useMemo(() => {
    return itemsWithValues
      .map((item) => item.value)
      .filter((v): v is number => v !== null && !isNaN(v));
  }, [itemsWithValues]);

  // Determine top performer / leader based on metric direction
  const leaderItem = useMemo(() => {
    if (validValues.length === 0) return null;
    if (currentMetric.better === "lower") {
      const minVal = Math.min(...validValues);
      return itemsWithValues.find((item) => item.value === minVal) || null;
    } else {
      const maxVal = Math.max(...validValues);
      return itemsWithValues.find((item) => item.value === maxVal) || null;
    }
  }, [itemsWithValues, validValues, currentMetric.better]);

  // Compute fleet average
  const fleetAverage = useMemo(() => {
    if (validValues.length === 0) return null;
    const sum = validValues.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / validValues.length);
  }, [validValues]);

  // Count suitable aircraft within limits
  const suitableCount = useMemo(() => {
    return results.filter((r) => r.within_calculated_limits).length;
  }, [results]);

  // Compute nice Y-axis grid ticks and maximum scale (always using km for distance, never k)
  const { maxVal, yTicks } = useMemo(() => {
    if (validValues.length === 0) {
      return { maxVal: 100, yTicks: [100, 67, 33, 0] };
    }

    const rawMax = Math.max(...validValues.map((v) => Math.abs(v)));
    const ceilingMax = rawMax > 0 ? rawMax : 10;

    let step = 10;
    if (ceilingMax > 2000) step = 500;
    else if (ceilingMax > 1000) step = 250;
    else if (ceilingMax > 300) step = 100;
    else if (ceilingMax > 100) step = 50;
    else if (ceilingMax > 40) step = 20;
    else step = 10;

    const niceMax = Math.ceil(ceilingMax / step) * step;

    const ticks = [
      niceMax,
      Math.round(niceMax * 0.67),
      Math.round(niceMax * 0.33),
      0,
    ];

    return { maxVal: niceMax, yTicks: ticks };
  }, [validValues]);

  // Dynamically calculate horizontal panel width based on aircraft count
  const dynamicMaxWidth = useMemo(() => {
    const count = results.length;
    // Base width for Y-axis, padding, header titles, and 3 KPI columns: ~370px
    // Per-aircraft bar column allocation: ~65px
    // Sensible minimum: 500px (to comfortably accommodate header & 3 KPIs without wrapping)
    // Maximum: up to full workspace width (1280px)
    const computedWidth = 370 + count * 65;
    return Math.min(1280, Math.max(500, computedWidth));
  }, [results.length]);

  return (
    <div
      style={{ maxWidth: `min(100%, ${dynamicMaxWidth}px)` }}
      className="w-full rounded-2xl bg-[#111113] border border-white/[0.08] shadow-xl p-4 sm:p-5 space-y-4 font-sans transition-[max-width] duration-300 ease-out"
    >
      {/* Top Header Row (Matching Reference Card Header with compact scale) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.08] gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans">
            Fleet Performance
          </h2>
          <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5 font-sans">
            Comparative analysis of {results.length} aircraft on {departureIdent} → {destinationIdent} ({Math.round(routeDistanceKm)} km)
          </p>
        </div>

        {/* HeroUI Dropdown Selector Pill */}
        <div className="relative shrink-0">
          <Dropdown>
            <Dropdown.Trigger className="inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] hover:border-white/20 text-xs font-semibold text-neutral-200 hover:text-white transition-all duration-200 cursor-pointer font-sans shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006FEE]">
              <span className="truncate">{currentMetric.label} ({currentMetric.unit})</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200" />
            </Dropdown.Trigger>
            <Dropdown.Popover
              placement="bottom end"
              className="z-50 min-w-[220px] p-1.5 rounded-2xl bg-[#141416]/98 border border-white/12 shadow-2xl backdrop-blur-xl font-sans transition-all duration-300 ease-out data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[entering]:duration-300 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95 data-[exiting]:duration-200"
            >
              <Dropdown.Menu
                aria-label="Select comparison metric"
                selectionMode="single"
                selectedKeys={new Set([selectedMetricKey])}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0];
                  if (val) setSelectedMetricKey(val as MetricKey);
                }}
                className="outline-none space-y-0.5"
              >
                {METRICS.map((m) => {
                  const isSelected = selectedMetricKey === m.key;
                  return (
                    <Dropdown.Item
                      key={m.key}
                      id={m.key}
                      textValue={`${m.label} (${m.unit})`}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer outline-none transition-colors duration-150 data-[focused]:bg-white/[0.08] data-[focused]:text-white ${
                        isSelected
                          ? "bg-[#006FEE]/15 text-[#006FEE] font-semibold"
                          : "text-neutral-300 hover:text-white hover:bg-white/[0.08]"
                      }`}
                    >
                      <span className="truncate">{m.label} ({m.unit})</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#006FEE] shrink-0 ml-2" />
                      )}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>

      {/* 3 KPI Summary Columns (No green text, standard HeroUI font-sans numbers) */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 font-sans py-1">
        {/* Metric 1: Top Performer / Leader */}
        <div>
          <div className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">
            {leaderItem?.value != null ? currentMetric.formatBarValue(leaderItem.value) : "—"}
          </div>
          <span className="block text-xs text-neutral-400 mt-1 font-sans">
            {currentMetric.leaderTitle}
          </span>
        </div>

        {/* Metric 2: Fleet Average */}
        <div>
          <div className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">
            {fleetAverage != null ? currentMetric.formatBarValue(fleetAverage) : "—"}
          </div>
          <span className="block text-xs text-neutral-400 mt-1 font-sans">
            {currentMetric.avgTitle}
          </span>
        </div>

        {/* Metric 3: Fleet Route Suitability */}
        <div>
          <div className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">
            {suitableCount}
            <span className="text-sm font-normal text-neutral-400 ml-1">
              / {results.length}
            </span>
          </div>
          <span className="block text-xs text-neutral-400 mt-1 font-sans">
            Route Suitability
          </span>
        </div>
      </div>

      {/* Bar Chart Section (Bars starting from the left-most side, exact gap, solid blue) */}
      <div className="relative pt-2 pb-1">
        <div className="relative flex items-end">
          {/* Y-Axis Reference Ticks on the Left (Strictly numbers, HeroUI font-sans) */}
          <div className="w-10 sm:w-12 h-36 sm:h-40 flex flex-col justify-between items-end pr-2.5 select-none shrink-0 font-sans text-xs text-neutral-400">
            {yTicks.map((tick, i) => (
              <span key={`tick-${i}`} className="leading-none whitespace-nowrap">
                {tick.toLocaleString()}
              </span>
            ))}
          </div>

          {/* Chart Plot Area with Grid Lines */}
          <div className="relative flex-1 h-36 sm:h-40 border-l border-white/[0.08]">
            {/* Horizontal Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {yTicks.map((_, i) => (
                <div
                  key={`line-${i}`}
                  className="w-full border-b border-white/[0.06]"
                />
              ))}
            </div>

            {/* Bars Container: Starts from the left-most side, exact gap like reference image */}
            <div className="relative z-10 h-full flex items-end justify-start gap-3.5 sm:gap-4 pl-3 sm:pl-4 overflow-x-auto">
              {itemsWithValues.map((item, idx) => {
                const { result, value, isWithin } = item;
                const safeVal = value ?? 0;

                // Proportional height
                const heightPercent =
                  maxVal > 0 ? Math.min(100, Math.max(6, (Math.abs(safeVal) / maxVal) * 100)) : 6;

                // Solid blue (#006FEE) or solid rose (#F43F5E) - NO glow, NO blur, NO shadow
                const barColor = isWithin ? "bg-[#006FEE]" : "bg-[#F43F5E]";

                return (
                  <div
                    key={`bar-col-${result.aircraft_identifier || idx}`}
                    className="flex flex-col items-center justify-end h-full group relative cursor-pointer shrink-0 w-9 sm:w-10"
                  >
                    {/* Tooltip on Bar Hover (Clearly showing full aircraft model/name, smooth entrance) */}
                    <Tooltip delay={120} closeDelay={100}>
                      <Tooltip.Trigger className="w-full flex flex-col items-center justify-end h-full pb-0.5 outline-none cursor-pointer">
                        {/* Slim, Solid Bar (w-4 sm:w-4.5, rounded-full, solid #006FEE, no glow) */}
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPercent}%` }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className={`w-4 sm:w-4.5 rounded-full ${barColor} group-hover:brightness-110 transition-all`}
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Content
                        placement="top"
                        offset={10}
                        className="z-50 px-3 py-2 rounded-xl bg-[#141416]/98 border border-white/15 shadow-2xl backdrop-blur-md text-left font-sans transition-all duration-250 ease-out data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[entering]:duration-250"
                      >
                        <div className="space-y-1 font-sans min-w-[140px] max-w-[280px]">
                          <div className="text-xs font-bold text-white tracking-tight leading-snug">
                            {result.aircraft_name}
                          </div>
                          <div className="text-[11px] text-neutral-300 flex items-center justify-between gap-3 pt-0.5">
                            <span className="text-neutral-400">
                              {currentMetric.shortLabel || currentMetric.label}:
                            </span>
                            <span className="font-semibold text-white font-sans">
                              {currentMetric.formatDetailedValue(value)}
                            </span>
                          </div>
                        </div>
                      </Tooltip.Content>
                    </Tooltip>

                    {/* X-Axis Label Directly Below Bar (Matching '01', '02', '03' in reference) */}
                    <div className="w-full text-center mt-2.5 pt-0.5 select-none">
                      <span className="block text-xs font-semibold text-neutral-400 group-hover:text-white transition-colors truncate font-sans">
                        {result.aircraft_identifier}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend Row at the Bottom (All in standard HeroUI font-sans) */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-xs text-neutral-400 font-sans gap-2">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006FEE] inline-block" />
              <span className="text-xs text-neutral-300 font-sans">Within Limits (Suitable)</span>
            </div>
            {results.some((r) => !r.within_calculated_limits) && (
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E] inline-block" />
                <span className="text-xs text-neutral-300 font-sans">Outside Limits</span>
              </div>
            )}
          </div>

          <div className="text-xs text-neutral-400 font-sans">
            {currentMetric.label} • Units in {currentMetric.unit}
          </div>
        </div>
      </div>
    </div>
  );
};
