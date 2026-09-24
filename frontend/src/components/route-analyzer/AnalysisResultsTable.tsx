"use client";

import React from "react";
import { RouteAircraftAnalysisResponse, AircraftAnalysisResult } from "@/types/routeAnalyzer";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  Milestone,
  ArrowUpRight,
  Info,
  ChevronRight,
  Plane,
} from "lucide-react";

interface AnalysisResultsTableProps {
  analysis: RouteAircraftAnalysisResponse | null;
  loading: boolean;
  onSelectAircraftDetails: (result: AircraftAnalysisResult) => void;
}

export const AnalysisResultsTable: React.FC<AnalysisResultsTableProps> = ({
  analysis,
  loading,
  onSelectAircraftDetails,
}) => {
  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-[#111113] border border-white/[0.08] shadow-2xl space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-white/[0.08] rounded-lg" />
          <div className="h-6 w-24 bg-white/[0.08] rounded-full" />
        </div>
        <div className="space-y-2 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/[0.04] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const { route, conditions, results, missing_aircraft, disclaimer } = analysis;
  const withinCount = results.filter((r) => r.within_calculated_limits).length;
  const outsideCount = results.length - withinCount;

  return (
    <div className="rounded-2xl bg-[#111113] border border-white/[0.08] shadow-2xl p-4 md:p-6 space-y-6">
      {/* Top Results Summary Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/[0.08] gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-[#FAFAFA] tracking-tight">
              Route Suitability Results
            </h2>
            <span className="font-mono text-xs text-[#108AEF] bg-[#108AEF]/15 border border-[#108AEF]/30 px-2 py-0.5 rounded-full font-bold">
              {route.departure.ident} → {route.destination.ident}
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-1 font-mono">
            Haversine Distance: <strong className="text-white">{Math.round(route.distance_km)} km</strong> ({Math.round(route.distance_km * 0.539957)} nm) • Wind:{" "}
            {conditions.wind_kmh > 0
              ? `+${conditions.wind_kmh} km/h (Headwind)`
              : conditions.wind_kmh < 0
              ? `${conditions.wind_kmh} km/h (Tailwind)`
              : "0 km/h (Calm)"}
          </p>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{withinCount} Within Limits</span>
          </div>

          {outsideCount > 0 && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{outsideCount} Outside Limits</span>
            </div>
          )}
        </div>
      </div>

      {/* Missing Aircraft Notification */}
      {missing_aircraft && missing_aircraft.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Notice: No database records found for {missing_aircraft.join(", ")}. These were omitted from analytical modeling.
          </span>
        </div>
      )}

      {/* Results Table (Responsive desktop table + card view on mobile) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
              <th className="pb-3 pl-2">Aircraft</th>
              <th className="pb-3 text-center">Status</th>
              <th className="pb-3 text-right">Est. Flight Time</th>
              <th className="pb-3 text-right">Nominal Range</th>
              <th className="pb-3 text-right">Range Margin</th>
              <th className="pb-3 text-right">Takeoff Margin</th>
              <th className="pb-3 text-right">Landing Margin</th>
              <th className="pb-3 pr-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-xs">
            {results.map((result) => {
              const isWithin = result.within_calculated_limits;
              const rangeMargin = result.range_margin_km;
              const toflMargin = result.takeoff_runway_margin_m;
              const lflMargin = result.landing_runway_margin_m;

              return (
                <tr
                  key={result.aircraft_identifier}
                  onClick={() => onSelectAircraftDetails(result)}
                  className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                >
                  {/* Aircraft Name & Details */}
                  <td className="py-3.5 pl-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#FAFAFA] shrink-0">
                        <Plane className="w-4 h-4 text-[#108AEF]" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[#FAFAFA] group-hover:text-[#108AEF] transition-colors">
                          {result.aircraft_name}
                        </div>
                        <div className="text-[11px] text-[#71717A] flex items-center space-x-1.5 font-mono">
                          <span>{result.aircraft_identifier}</span>
                          {result.passenger_capacity && (
                            <>
                              <span>•</span>
                              <span>{result.passenger_capacity} seats</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 text-center">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold select-none ${
                        isWithin
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {isWithin ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Within Limits</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Outside Limits</span>
                        </>
                      )}
                    </span>
                  </td>

                  {/* Estimated Flight Time */}
                  <td className="py-3.5 text-right font-mono font-bold text-sm text-[#FAFAFA]">
                    {typeof result.estimated_flight_time_min === "number"
                      ? `${Math.round(result.estimated_flight_time_min)} min`
                      : "—"}
                  </td>

                  {/* Nominal Range */}
                  <td className="py-3.5 text-right font-mono text-[#D4D4D8]">
                    {typeof result.nominal_range_km === "number"
                      ? `${Math.round(result.nominal_range_km).toLocaleString()} km`
                      : "—"}
                  </td>

                  {/* Range Margin */}
                  <td className="py-3.5 text-right font-mono font-semibold">
                    {typeof rangeMargin === "number" ? (
                      <span className={rangeMargin >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {rangeMargin >= 0 ? `+${Math.round(rangeMargin).toLocaleString()} km` : `${Math.round(rangeMargin).toLocaleString()} km`}
                      </span>
                    ) : (
                      <span className="text-[#71717A]">—</span>
                    )}
                  </td>

                  {/* Takeoff Margin */}
                  <td className="py-3.5 text-right font-mono">
                    {typeof toflMargin === "number" ? (
                      <span className={toflMargin >= 0 ? "text-emerald-400" : "text-rose-400 font-semibold"}>
                        {toflMargin >= 0 ? `+${Math.round(toflMargin)} m` : `${Math.round(toflMargin)} m`}
                      </span>
                    ) : (
                      <span className="text-[#71717A]">—</span>
                    )}
                  </td>

                  {/* Landing Margin */}
                  <td className="py-3.5 text-right font-mono">
                    {typeof lflMargin === "number" ? (
                      <span className={lflMargin >= 0 ? "text-emerald-400" : "text-rose-400 font-semibold"}>
                        {lflMargin >= 0 ? `+${Math.round(lflMargin)} m` : `${Math.round(lflMargin)} m`}
                      </span>
                    ) : (
                      <span className="text-[#71717A]">—</span>
                    )}
                  </td>

                  {/* Action Link */}
                  <td className="py-3.5 pr-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAircraftDetails(result);
                      }}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.10] text-[#A1A1AA] hover:text-[#FAFAFA] text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Disclaimer Box */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-[#71717A] flex items-start space-x-2.5 leading-relaxed">
        <Info className="w-4 h-4 text-[#108AEF] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#A1A1AA]">Analytical Performance Note: </strong>
          {disclaimer}
        </div>
      </div>
    </div>
  );
};
