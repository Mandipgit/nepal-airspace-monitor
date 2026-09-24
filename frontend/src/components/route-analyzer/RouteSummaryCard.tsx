"use client";

import React from "react";
import { RouteInformationResponse } from "@/types/routeAnalyzer";
import {
  Compass,
  Milestone,
  PlaneTakeoff,
  PlaneLanding,
  ArrowRight,
  Info,
  RefreshCw,
} from "lucide-react";

interface RouteSummaryCardProps {
  routeInfo: RouteInformationResponse | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export const RouteSummaryCard: React.FC<RouteSummaryCardProps> = ({
  routeInfo,
  loading,
  error,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-white/[0.08] rounded" />
          <div className="h-4 w-16 bg-white/[0.08] rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="h-14 bg-white/[0.05] rounded-lg" />
          <div className="h-14 bg-white/[0.05] rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="font-semibold text-rose-200">Unable to load route data</span>
          <p className="text-[11px] text-rose-300/80">{error}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 font-medium text-[11px] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  if (!routeInfo) return null;

  const { route, departure_runway, destination_runway } = routeInfo;

  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-lg space-y-3">
      {/* Top Banner: Route Segment & Distance */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-sm text-[#FAFAFA] font-mono tracking-tight">
            {route.departure.ident}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-[#108AEF]" />
          <span className="font-bold text-sm text-[#FAFAFA] font-mono tracking-tight">
            {route.destination.ident}
          </span>
          <span className="text-xs text-[#71717A] hidden sm:inline">
            ({route.departure.municipality || "Origin"} → {route.destination.municipality || "Destination"})
          </span>
        </div>

        <div className="flex items-center space-x-1.5 bg-[#108AEF]/15 border border-[#108AEF]/25 px-2.5 py-0.5 rounded-full">
          <Milestone className="w-3.5 h-3.5 text-[#108AEF]" />
          <span className="text-xs font-mono font-bold text-[#FAFAFA]">
            {Math.round(route.distance_km)} km
          </span>
          <span className="text-[10px] text-[#A1A1AA] font-mono">
            ({Math.round(route.distance_km * 0.539957)} nm)
          </span>
        </div>
      </div>

      {/* Runway Specifications for Both Endpoints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Departure Runway */}
        <div className="p-2.5 rounded-xl bg-[#111113] border border-white/[0.06] space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#A1A1AA]">
            <span className="flex items-center space-x-1 text-[#108AEF] font-semibold">
              <PlaneTakeoff className="w-3.5 h-3.5" />
              <span>Departure Runway</span>
            </span>
            <span className="font-mono text-[#FAFAFA]">
              {departure_runway.runway_ident ? `RWY ${departure_runway.runway_ident}` : "Primary"}
            </span>
          </div>
          <div className="text-sm font-bold text-[#FAFAFA] font-mono">
            {Math.round(departure_runway.runway_length_m).toLocaleString()} m
            <span className="text-[11px] font-normal text-[#71717A] ml-1.5">
              ({departure_runway.runway_length_ft?.toLocaleString() || Math.round(departure_runway.runway_length_m * 3.28084).toLocaleString()} ft)
            </span>
          </div>
          <div className="text-[10px] text-[#71717A] flex items-center justify-between">
            <span>Surface: {departure_runway.surface || "Paved"}</span>
            <span>Elev: {route.departure.elevation_ft?.toLocaleString() || "—"} ft</span>
          </div>
        </div>

        {/* Destination Runway */}
        <div className="p-2.5 rounded-xl bg-[#111113] border border-white/[0.06] space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#A1A1AA]">
            <span className="flex items-center space-x-1 text-[#FB7185] font-semibold">
              <PlaneLanding className="w-3.5 h-3.5" />
              <span>Destination Runway</span>
            </span>
            <span className="font-mono text-[#FAFAFA]">
              {destination_runway.runway_ident ? `RWY ${destination_runway.runway_ident}` : "Primary"}
            </span>
          </div>
          <div className="text-sm font-bold text-[#FAFAFA] font-mono">
            {Math.round(destination_runway.runway_length_m).toLocaleString()} m
            <span className="text-[11px] font-normal text-[#71717A] ml-1.5">
              ({destination_runway.runway_length_ft?.toLocaleString() || Math.round(destination_runway.runway_length_m * 3.28084).toLocaleString()} ft)
            </span>
          </div>
          <div className="text-[10px] text-[#71717A] flex items-center justify-between">
            <span>Surface: {destination_runway.surface || "Paved"}</span>
            <span>Elev: {route.destination.elevation_ft?.toLocaleString() || "—"} ft</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 text-[10px] text-[#71717A]">
        <Info className="w-3 h-3 text-[#108AEF] shrink-0" />
        <span>
          Destination field length reflects the longest active runway evaluated by the analytical backend model.
        </span>
      </div>
    </div>
  );
};
