"use client";

import React, { useState } from "react";
import { AircraftAnalysisResult } from "@/types/routeAnalyzer";
import { BarChart3, Clock, Shield, CheckCircle2, AlertTriangle } from "lucide-react";

interface ComparisonVisualizationProps {
  results: AircraftAnalysisResult[];
  routeDistanceKm: number;
}

export const ComparisonVisualization: React.FC<ComparisonVisualizationProps> = ({
  results,
  routeDistanceKm,
}) => {
  const [metricTab, setMetricTab] = useState<"time" | "range">("time");

  if (!results || results.length < 2) return null;

  // Max calculations for proportional bar rendering
  const validTimes = results
    .map((r) => r.estimated_flight_time_min)
    .filter((t): t is number => t !== null && t !== undefined);
  const maxTime = Math.max(...validTimes, 1);

  const validRanges = results
    .map((r) => r.range_margin_km)
    .filter((rm): rm is number => rm !== null && rm !== undefined);
  const maxRange = Math.max(...validRanges.map(Math.abs), 1);

  // Sorted arrays for clean visualization
  const sortedByTime = [...results].sort(
    (a, b) => (a.estimated_flight_time_min ?? 999) - (b.estimated_flight_time_min ?? 999)
  );

  const sortedByRange = [...results].sort(
    (a, b) => (b.range_margin_km ?? -999) - (a.range_margin_km ?? -999)
  );

  return (
    <div className="rounded-2xl bg-[#111113] border border-white/[0.08] p-4 md:p-6 shadow-2xl space-y-5">
      {/* Header and Metric Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.08] gap-3">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-[#108AEF]" />
          <h3 className="text-sm font-bold text-[#FAFAFA] tracking-tight">
            Fleet Metric Comparison
          </h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setMetricTab("time")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metricTab === "time"
                ? "bg-[#108AEF] text-white shadow-sm"
                : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Flight Time</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricTab("range")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metricTab === "range"
                ? "bg-[#108AEF] text-white shadow-sm"
                : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Range Margin</span>
          </button>
        </div>
      </div>

      {/* Flight Time Comparison Bars */}
      {metricTab === "time" && (
        <div className="space-y-3">
          <p className="text-[11px] text-[#A1A1AA]">
            Estimated block flight time in minutes (shorter is faster):
          </p>

          <div className="space-y-2.5">
            {sortedByTime.map((item) => {
              const time = item.estimated_flight_time_min;
              const widthPct = time ? Math.max(12, Math.round((time / maxTime) * 100)) : 0;
              const isWithin = item.within_calculated_limits;

              return (
                <div key={item.aircraft_identifier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#FAFAFA]">
                        {item.aircraft_name}
                      </span>
                      <span className="text-[10px] font-mono text-[#71717A]">
                        ({item.aircraft_identifier})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-white text-xs">
                      {time !== null && time !== undefined ? `${Math.round(time)} min` : "N/A"}
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full h-3 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isWithin
                          ? "bg-gradient-to-r from-[#108AEF] to-[#38bdf8]"
                          : "bg-gradient-to-r from-rose-500 to-amber-500"
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Range Margin Comparison Bars */}
      {metricTab === "range" && (
        <div className="space-y-3">
          <p className="text-[11px] text-[#A1A1AA]">
            Excess distance buffer above the {Math.round(routeDistanceKm)} km route distance (positive is safe):
          </p>

          <div className="space-y-2.5">
            {sortedByRange.map((item) => {
              const margin = item.range_margin_km;
              const isPositive = margin !== null && margin !== undefined && margin >= 0;
              const widthPct = margin
                ? Math.max(10, Math.min(100, Math.round((Math.abs(margin) / maxRange) * 100)))
                : 0;

              return (
                <div key={item.aircraft_identifier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#FAFAFA]">
                        {item.aircraft_name}
                      </span>
                      <span className="text-[10px] font-mono text-[#71717A]">
                        ({item.aircraft_identifier})
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold text-xs ${
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {margin !== null && margin !== undefined
                        ? `${isPositive ? "+" : ""}${Math.round(margin).toLocaleString()} km`
                        : "N/A"}
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full h-3 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isPositive
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                          : "bg-gradient-to-r from-rose-600 to-rose-400"
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
