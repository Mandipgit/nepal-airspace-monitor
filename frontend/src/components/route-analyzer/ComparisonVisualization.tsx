"use client";

import React, { useState, useMemo } from "react";
import { AircraftAnalysisResult } from "@/types/routeAnalyzer";
import {
  Compass,
  Maximize2,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ComparisonVisualizationProps {
  results: AircraftAnalysisResult[];
  routeDistanceKm: number;
  departureRunwayM?: number | null;
  destinationRunwayM?: number | null;
  departureIdent?: string;
  destinationIdent?: string;
}

const PALETTE = [
  { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.22)", dot: "#38bdf8" },
  { stroke: "#34d399", fill: "rgba(52, 211, 153, 0.22)", dot: "#34d399" },
  { stroke: "#fbbf24", fill: "rgba(251, 191, 36, 0.22)", dot: "#fbbf24" },
  { stroke: "#c084fc", fill: "rgba(192, 132, 252, 0.22)", dot: "#c084fc" },
  { stroke: "#f43f5e", fill: "rgba(244, 63, 94, 0.22)", dot: "#f43f5e" },
  { stroke: "#22d3ee", fill: "rgba(34, 211, 238, 0.22)", dot: "#22d3ee" },
];

const TABS = [
  { id: "envelopes" as const, label: "Runway Fit", icon: Maximize2 },
  { id: "radar" as const, label: "Overall Comparison", icon: Compass },
  { id: "dials" as const, label: "Resource Usage", icon: Gauge },
];

export const ComparisonVisualization: React.FC<ComparisonVisualizationProps> = ({
  results,
  routeDistanceKm,
  departureRunwayM,
  destinationRunwayM,
  departureIdent = "DEP",
  destinationIdent = "DEST",
}) => {
  const [activeTab, setActiveTab] = useState<"envelopes" | "radar" | "dials">("envelopes");
  const [selectedAircraftIdents, setSelectedAircraftIdents] = useState<Set<string>>(
    () => new Set(results.map((r) => r.aircraft_identifier))
  );

  // Sync selected aircraft if fleet changes
  useMemo(() => {
    setSelectedAircraftIdents(new Set(results.map((r) => r.aircraft_identifier)));
  }, [results]);

  const toggleAircraft = (ident: string) => {
    setSelectedAircraftIdents((prev) => {
      const next = new Set(prev);
      if (next.has(ident)) {
        if (next.size > 1) next.delete(ident);
      } else {
        next.add(ident);
      }
      return next;
    });
  };

  if (!results || results.length < 2) return null;

  // Normalized physical runway lengths
  const depRunwayLen = departureRunwayM && departureRunwayM > 0 ? departureRunwayM : 1500;
  const destRunwayLen = destinationRunwayM && destinationRunwayM > 0 ? destinationRunwayM : 3000;

  // Fleet performance leaders
  const validTimes = results.filter((r) => r.estimated_flight_time_min != null);
  const minTime = validTimes.length > 0
    ? Math.min(...validTimes.map((r) => r.estimated_flight_time_min as number))
    : null;
  const fastestAircraft = results.find((r) => r.estimated_flight_time_min === minTime);

  const maxSpeed = Math.max(...results.map((r) => r.cruise_speed_kmh ?? 1), 1);
  const maxRange = Math.max(...results.map((r) => r.nominal_range_km ?? 1), 1);

  // Radar chart constants
  const RADAR_CX = 160;
  const RADAR_CY = 160;
  const RADAR_R = 105;
  const AXES = [
    { label: "Flight Speed", angle: -Math.PI / 2 },
    { label: "Flight Range", angle: -Math.PI / 2 + (2 * Math.PI) / 5 },
    { label: "Takeoff Space", angle: -Math.PI / 2 + (4 * Math.PI) / 5 },
    { label: "Landing Space", angle: -Math.PI / 2 + (6 * Math.PI) / 5 },
    { label: "Fast Trip", angle: -Math.PI / 2 + (8 * Math.PI) / 5 },
  ];

  // Radar points computation
  const getRadarPolygon = (item: AircraftAnalysisResult) => {
    const speedScore = item.cruise_speed_kmh ? Math.min(1, Math.max(0.15, item.cruise_speed_kmh / maxSpeed)) : 0.2;
    const rangeScore = item.nominal_range_km ? Math.min(1, Math.max(0.15, item.nominal_range_km / maxRange)) : 0.2;
    const toflScore = item.takeoff_runway_margin_m != null
      ? Math.min(1, Math.max(0.1, (item.takeoff_runway_margin_m + 300) / (depRunwayLen * 0.8)))
      : 0.2;
    const lflScore = item.landing_runway_margin_m != null
      ? Math.min(1, Math.max(0.1, (item.landing_runway_margin_m + 300) / (destRunwayLen * 0.8)))
      : 0.2;
    const timeScore = item.estimated_flight_time_min && minTime
      ? Math.min(1, Math.max(0.2, (minTime / item.estimated_flight_time_min) * 0.95))
      : 0.2;

    const scores = [speedScore, rangeScore, toflScore, lflScore, timeScore];

    const points = scores.map((val, idx) => {
      const angle = AXES[idx].angle;
      const r = val * RADAR_R;
      const x = RADAR_CX + r * Math.cos(angle);
      const y = RADAR_CY + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return points.join(" ");
  };

  return (
    <div className="rounded-2xl bg-[#111113] border border-white/[0.08] p-4 md:p-6 shadow-2xl space-y-5 font-sans">
      {/* Analytics Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
        <div className="flex items-center space-x-2.5">
          <h3 className="text-sm font-bold text-[#FAFAFA] tracking-tight font-sans">
            Analytics
          </h3>
          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#A1A1AA]">
            {results.length} Aircraft
          </span>
        </div>

        {/* View Switcher: Runway Fit | Overall Comparison | Resource Usage */}
        <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] self-start sm:self-auto relative">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors duration-200 z-10 font-sans ${
                  isActive ? "text-white" : "text-[#A1A1AA] hover:text-[#FAFAFA]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeAnalyticsTabPill"
                    className="absolute inset-0 bg-[#108AEF] rounded-lg shadow-sm -z-10"
                    transition={{
                      type: "spring",
                      stiffness: 160,
                      damping: 22,
                      mass: 1.0,
                    }}
                  />
                )}
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animated Tab Content Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* VIEW 1: Runway Fit */}
          {activeTab === "envelopes" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#A1A1AA] pb-1 gap-1">
                <span className="font-sans">
                  Runway space needed for takeoff and landing compared to total runway length
                </span>
                <span className="font-sans text-[11px] text-[#71717A]">
                  Blue = Space needed • Green = Extra space remaining • Red = Not enough runway
                </span>
              </div>

              <div className={`grid grid-cols-1 ${results.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-2 xl:grid-cols-3"} gap-4`}>
                {results.map((item) => {
                  const toflMargin = item.takeoff_runway_margin_m ?? 0;
                  const lflMargin = item.landing_runway_margin_m ?? 0;
                  const isToflSafe = toflMargin >= 0;
                  const isLflSafe = lflMargin >= 0;

                  // Calculated field lengths
                  const requiredTOFL = Math.max(100, depRunwayLen - toflMargin);
                  const requiredLFL = Math.max(100, destRunwayLen - lflMargin);

                  // Proportional utilization percentages
                  const toflPct = Math.min(100, Math.round((requiredTOFL / depRunwayLen) * 100));
                  const lflPct = Math.min(100, Math.round((requiredLFL / destRunwayLen) * 100));

                  return (
                    <div
                      key={item.aircraft_identifier}
                      className="rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] p-4 space-y-4 transition-all duration-150"
                    >
                      {/* Aircraft Title Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 truncate">
                          <span className="text-sm font-bold text-white truncate font-sans">
                            {item.aircraft_name}
                          </span>
                          <span className="font-mono text-[10px] text-[#108AEF] bg-[#108AEF]/15 border border-[#108AEF]/25 px-1.5 py-0.5 rounded shrink-0">
                            {item.aircraft_identifier}
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 font-sans ${
                            item.within_calculated_limits
                              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                              : "bg-rose-500/10 border border-rose-500/25 text-rose-400"
                          }`}
                        >
                          {item.within_calculated_limits ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Within Limits</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3" />
                              <span>Limits Exceeded</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* 1. Departure Runway Strip */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-sans">
                          <span className="font-semibold text-[#D4D4D8] flex items-center space-x-1">
                            <span>Departure ({departureIdent})</span>
                            <span className="text-[#71717A] font-mono text-[10px]">• {depRunwayLen.toLocaleString()} m total</span>
                          </span>
                          <span
                            className={`font-mono font-bold text-xs ${
                              isToflSafe ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isToflSafe ? `+${Math.round(toflMargin)} m extra space` : `${Math.round(toflMargin)} m short`}
                          </span>
                        </div>

                        {/* Runway Strip Canvas Representation */}
                        <div className="h-8 rounded-lg bg-[#0c0d12] border border-white/[0.12] relative overflow-hidden flex items-center shadow-inner">
                          {/* Threshold markings */}
                          <div className="absolute left-1 top-1 bottom-1 w-2 border-r-2 border-dashed border-white/40 z-10" />
                          {/* Runway centerline */}
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-white/20" />
                          {/* Right threshold */}
                          <div className="absolute right-1 top-1 bottom-1 w-2 border-l-2 border-dashed border-white/40 z-10" />

                          {/* Required Ground Roll Zone */}
                          <div
                            className={`h-full relative flex items-center px-2 z-10 transition-all duration-500 ${
                              isToflSafe
                                ? "bg-gradient-to-r from-sky-600/70 via-sky-500/80 to-[#108AEF]/90"
                                : "bg-gradient-to-r from-rose-600/80 to-rose-500/90"
                            }`}
                            style={{ width: `${Math.min(100, toflPct)}%` }}
                          >
                            <span className="text-[10px] font-mono font-bold text-white whitespace-nowrap drop-shadow">
                              Takeoff: {Math.round(requiredTOFL)} m ({toflPct}%)
                            </span>
                          </div>

                          {/* Overrun Warning if Exceeded */}
                          {!isToflSafe && (
                            <div className="absolute right-0 top-0 bottom-0 left-[80%] bg-stripes-rose flex items-center justify-center z-20">
                              <span className="text-[9px] font-sans font-bold text-rose-200 uppercase tracking-tight">
                                Not enough runway
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Destination Runway Strip */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-sans">
                          <span className="font-semibold text-[#D4D4D8] flex items-center space-x-1">
                            <span>Destination ({destinationIdent})</span>
                            <span className="text-[#71717A] font-mono text-[10px]">• {destRunwayLen.toLocaleString()} m total</span>
                          </span>
                          <span
                            className={`font-mono font-bold text-xs ${
                              isLflSafe ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isLflSafe ? `+${Math.round(lflMargin)} m extra space` : `${Math.round(lflMargin)} m short`}
                          </span>
                        </div>

                        {/* Runway Strip Canvas Representation */}
                        <div className="h-8 rounded-lg bg-[#0c0d12] border border-white/[0.12] relative overflow-hidden flex items-center shadow-inner">
                          {/* Threshold markings */}
                          <div className="absolute left-1 top-1 bottom-1 w-2 border-r-2 border-dashed border-white/40 z-10" />
                          {/* Runway centerline */}
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-white/20" />
                          {/* Right threshold */}
                          <div className="absolute right-1 top-1 bottom-1 w-2 border-l-2 border-dashed border-white/40 z-10" />

                          {/* Required Ground Roll Zone */}
                          <div
                            className={`h-full relative flex items-center px-2 z-10 transition-all duration-500 ${
                              isLflSafe
                                ? "bg-gradient-to-r from-emerald-600/70 via-emerald-500/80 to-teal-500/90"
                                : "bg-gradient-to-r from-rose-600/80 to-rose-500/90"
                            }`}
                            style={{ width: `${Math.min(100, lflPct)}%` }}
                          >
                            <span className="text-[10px] font-mono font-bold text-white whitespace-nowrap drop-shadow">
                              Landing: {Math.round(requiredLFL)} m ({lflPct}%)
                            </span>
                          </div>

                          {/* Overrun Warning if Exceeded */}
                          {!isLflSafe && (
                            <div className="absolute right-0 top-0 bottom-0 left-[80%] bg-stripes-rose flex items-center justify-center z-20">
                              <span className="text-[9px] font-sans font-bold text-rose-200 uppercase tracking-tight">
                                Not enough runway
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary Footer */}
                      <div className="pt-1 flex items-center justify-between text-[11px] text-[#A1A1AA] border-t border-white/[0.05] font-sans">
                        <span>Trip time:</span>
                        <span className="font-mono font-bold text-white">
                          {item.estimated_flight_time_min ? `${Math.round(item.estimated_flight_time_min)} min` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: Overall Comparison */}
          {activeTab === "radar" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left: SVG Spider / Radar Chart (7 cols) */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center p-2 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <svg viewBox="0 0 320 320" className="w-full max-w-[340px] aspect-square overflow-visible">
                  {/* Concentric Pentagonal Web Rings */}
                  {[0.25, 0.5, 0.75, 1.0].map((scale) => {
                    const ringPoints = AXES.map((axis) => {
                      const x = RADAR_CX + RADAR_R * scale * Math.cos(axis.angle);
                      const y = RADAR_CY + RADAR_R * scale * Math.sin(axis.angle);
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    }).join(" ");

                    return (
                      <polygon
                        key={scale}
                        points={ringPoints}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeWidth="1"
                        strokeDasharray={scale < 1.0 ? "2,2" : undefined}
                      />
                    );
                  })}

                  {/* Axis Spokes & Labels */}
                  {AXES.map((axis, i) => {
                    const x2 = RADAR_CX + RADAR_R * Math.cos(axis.angle);
                    const y2 = RADAR_CY + RADAR_R * Math.sin(axis.angle);

                    // Label positions offset outward
                    const labelR = RADAR_R + 24;
                    const lx = RADAR_CX + labelR * Math.cos(axis.angle);
                    const ly = RADAR_CY + labelR * Math.sin(axis.angle);

                    return (
                      <g key={i}>
                        <line
                          x1={RADAR_CX}
                          y1={RADAR_CY}
                          x2={x2}
                          y2={y2}
                          stroke="rgba(255, 255, 255, 0.12)"
                          strokeWidth="1"
                        />
                        <text
                          x={lx}
                          y={ly + 3}
                          textAnchor="middle"
                          fill="#A1A1AA"
                          className="font-sans font-semibold text-[10px] select-none"
                        >
                          {axis.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Polygons for Selected Aircraft */}
                  {results.map((item, idx) => {
                    if (!selectedAircraftIdents.has(item.aircraft_identifier)) return null;
                    const color = PALETTE[idx % PALETTE.length];
                    const polygonPoints = getRadarPolygon(item);

                    return (
                      <g key={item.aircraft_identifier} className="transition-all duration-300">
                        <polygon
                          points={polygonPoints}
                          fill={color.fill}
                          stroke={color.stroke}
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Right: Interactive Legend & Direct Benchmark Comparison (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] font-sans">
                    Aircraft Comparison (Click to hide/show)
                  </h4>
                  <p className="text-[11px] text-[#71717A] font-sans">
                    Select aircraft to compare how they perform against each other.
                  </p>
                </div>

                {/* Aircraft Legend Toggles */}
                <div className="space-y-2">
                  {results.map((item, idx) => {
                    const color = PALETTE[idx % PALETTE.length];
                    const isSelected = selectedAircraftIdents.has(item.aircraft_identifier);

                    return (
                      <button
                        key={item.aircraft_identifier}
                        type="button"
                        onClick={() => toggleAircraft(item.aircraft_identifier)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                          isSelected
                            ? "bg-white/[0.05] border-white/[0.15] text-white shadow-sm"
                            : "bg-white/[0.01] border-white/[0.04] text-[#71717A] opacity-50"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: color.stroke }}
                          />
                          <span className="text-xs font-semibold truncate font-sans">
                            {item.aircraft_name}
                          </span>
                          <span className="font-mono text-[10px] text-[#A1A1AA]">
                            ({item.aircraft_identifier})
                          </span>
                        </div>

                        <span className="font-mono text-xs font-bold text-white shrink-0 ml-2">
                          {item.estimated_flight_time_min ? `${Math.round(item.estimated_flight_time_min)}m` : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Fastest Aircraft Card */}
                {fastestAircraft && (
                  <div className="p-3.5 rounded-xl bg-[#108AEF]/10 border border-[#108AEF]/25 text-xs text-[#FAFAFA] space-y-1 font-sans">
                    <div className="flex items-center space-x-1.5 font-bold text-[#38bdf8]">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Fastest Aircraft</span>
                    </div>
                    <p className="text-[11px] text-[#D4D4D8] leading-relaxed">
                      <strong className="text-white">{fastestAircraft.aircraft_name}</strong> completes the flight in the shortest time at{" "}
                      <strong className="text-white font-mono">{Math.round(minTime ?? 0)} min</strong> ({fastestAircraft.cruise_speed_kmh} km/h).
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: Resource Usage */}
          {activeTab === "dials" && (
            <div className="space-y-4">
              <p className="text-xs text-[#A1A1AA] font-sans">
                How much of each plane&apos;s capacity is used for this specific flight
              </p>

              <div className={`grid grid-cols-1 ${results.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"} gap-4`}>
                {results.map((item) => {
                  // 1. Range Consumed %
                  const rangePct = item.nominal_range_km
                    ? Math.min(100, Math.round((routeDistanceKm / item.nominal_range_km) * 100))
                    : 50;

                  // 2. Departure Runway Consumed %
                  const toflMargin = item.takeoff_runway_margin_m ?? 0;
                  const reqTOFL = Math.max(100, depRunwayLen - toflMargin);
                  const depPct = Math.min(100, Math.round((reqTOFL / depRunwayLen) * 100));

                  // 3. Destination Runway Consumed %
                  const lflMargin = item.landing_runway_margin_m ?? 0;
                  const reqLFL = Math.max(100, destRunwayLen - lflMargin);
                  const destPct = Math.min(100, Math.round((reqLFL / destRunwayLen) * 100));

                  // Circular progress SVG metrics (r = 26, circumference = 163.36)
                  const circleR = 26;
                  const circumference = 2 * Math.PI * circleR;

                  return (
                    <div
                      key={item.aircraft_identifier}
                      className="rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] p-4 space-y-4 transition-all"
                    >
                      {/* Card Title */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white truncate font-sans">
                            {item.aircraft_name}
                          </div>
                          <span className="font-mono text-[10px] text-[#108AEF]">
                            {item.aircraft_identifier}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-white block">
                            {item.estimated_flight_time_min ? `${Math.round(item.estimated_flight_time_min)} min` : "—"}
                          </span>
                          <span className="text-[10px] text-[#71717A] block font-mono">
                            {item.cruise_speed_kmh ? `${Math.round(item.cruise_speed_kmh)} km/h` : ""}
                          </span>
                        </div>
                      </div>

                      {/* 3 Proportional Circular Dials */}
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        {/* Dial 1: Range Consumed */}
                        <div className="flex flex-col items-center space-y-1">
                          <div className="relative w-16 h-16 flex items-center justify-center">
                            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                              <circle
                                cx="32"
                                cy="32"
                                r={circleR}
                                className="stroke-white/[0.08]"
                                strokeWidth="5"
                                fill="none"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r={circleR}
                                stroke={rangePct > 80 ? "#f43f5e" : rangePct > 50 ? "#fbbf24" : "#108AEF"}
                                strokeWidth="5"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference * (1 - rangePct / 100)}
                                strokeLinecap="round"
                                fill="none"
                                className="transition-all duration-700 ease-out"
                              />
                            </svg>
                            <span className="absolute font-mono text-[11px] font-bold text-white">
                              {rangePct}%
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-tight font-sans">
                            Range Used
                          </span>
                          <span className="font-mono text-[9px] text-[#71717A]">
                            {item.range_margin_km ? `+${Math.round(item.range_margin_km)} km extra space` : ""}
                          </span>
                        </div>

                        {/* Dial 2: Departure Runway Consumed */}
                        <div className="flex flex-col items-center space-y-1">
                          <div className="relative w-16 h-16 flex items-center justify-center">
                            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                              <circle
                                cx="32"
                                cy="32"
                                r={circleR}
                                className="stroke-white/[0.08]"
                                strokeWidth="5"
                                fill="none"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r={circleR}
                                stroke={toflMargin < 0 ? "#f43f5e" : depPct > 85 ? "#fbbf24" : "#38bdf8"}
                                strokeWidth="5"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference * (1 - depPct / 100)}
                                strokeLinecap="round"
                                fill="none"
                                className="transition-all duration-700 ease-out"
                              />
                            </svg>
                            <span className="absolute font-mono text-[11px] font-bold text-white">
                              {depPct}%
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-tight font-sans">
                            Takeoff Used
                          </span>
                          <span className="font-mono text-[9px] text-[#71717A]">
                            {toflMargin >= 0 ? `+${Math.round(toflMargin)} m extra space` : `${Math.round(toflMargin)} m short`}
                          </span>
                        </div>

                        {/* Dial 3: Destination Runway Consumed */}
                        <div className="flex flex-col items-center space-y-1">
                          <div className="relative w-16 h-16 flex items-center justify-center">
                            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                              <circle
                                cx="32"
                                cy="32"
                                r={circleR}
                                className="stroke-white/[0.08]"
                                strokeWidth="5"
                                fill="none"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r={circleR}
                                stroke={lflMargin < 0 ? "#f43f5e" : destPct > 85 ? "#fbbf24" : "#34d399"}
                                strokeWidth="5"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference * (1 - destPct / 100)}
                                strokeLinecap="round"
                                fill="none"
                                className="transition-all duration-700 ease-out"
                              />
                            </svg>
                            <span className="absolute font-mono text-[11px] font-bold text-white">
                              {destPct}%
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-tight font-sans">
                            Landing Used
                          </span>
                          <span className="font-mono text-[9px] text-[#71717A]">
                            {lflMargin >= 0 ? `+${Math.round(lflMargin)} m extra space` : `${Math.round(lflMargin)} m short`}
                          </span>
                        </div>
                      </div>

                      {/* Operational Notes / Limiting Factor Callout */}
                      {item.notes && !item.within_calculated_limits && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] flex items-center space-x-1.5 font-sans">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="truncate">{item.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
