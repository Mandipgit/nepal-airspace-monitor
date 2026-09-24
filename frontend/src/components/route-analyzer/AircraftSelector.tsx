"use client";

import React, { useState, useMemo, useCallback } from "react";
import { AircraftSpecification } from "@/types/routeAnalyzer";
import { Search, Plane, X, RefreshCw, Check, AlertCircle } from "lucide-react";

interface AircraftSelectorProps {
  availableAircraft: AircraftSpecification[];
  selectedAircraft: AircraftSpecification[];
  onToggleAircraft: (aircraft: AircraftSpecification) => void;
  onClearAll: () => void;
  onSelectPreset: (aircraftList: AircraftSpecification[]) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  maxLimit?: number;
}

const CATEGORIES = [
  { id: "all", label: "All Categories" },
  { id: "commuter", label: "Commuter / STOL" },
  { id: "regional", label: "Regional Turboprop" },
  { id: "short_medium", label: "Short / Medium Haul" },
  { id: "business", label: "Business Jet" },
];

export const AircraftSelector: React.FC<AircraftSelectorProps> = ({
  availableAircraft,
  selectedAircraft,
  onToggleAircraft,
  onClearAll,
  onSelectPreset,
  loading = false,
  error = null,
  onRetry,
  maxLimit = 15,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const getAircraftKey = useCallback((a: AircraftSpecification): string => {
    return a.id !== undefined && a.id !== null ? `id-${a.id}` : `model-${a.model}`;
  }, []);

  const selectedKeys = useMemo(
    () => new Set(selectedAircraft.map(getAircraftKey)),
    [selectedAircraft, getAircraftKey]
  );

  const filteredAircraft = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableAircraft.filter((item) => {
      // Category match
      if (activeCategory !== "all") {
        const cat = (item.category || "").toLowerCase();
        if (activeCategory === "commuter" && !cat.includes("commuter") && !cat.includes("stol")) return false;
        if (activeCategory === "regional" && !cat.includes("regional")) return false;
        if (activeCategory === "short_medium" && !cat.includes("short_medium") && !cat.includes("commercial")) return false;
        if (activeCategory === "business" && !cat.includes("business")) return false;
      }

      // Query match
      if (!q) return true;
      const model = (item.model || "").toLowerCase();
      const icao = (item.icao_type || "").toLowerCase();
      const engine = (item.engine_type || "").toLowerCase();
      return model.includes(q) || icao.includes(q) || engine.includes(q);
    });
  }, [availableAircraft, searchQuery, activeCategory]);

  // Domestic Nepal Fleet preset (ATR 72, Twin Otter, Dornier 228, A320, CRJ)
  const handleSelectDomesticPreset = () => {
    const targets = ["ATR", "DHC", "DO228", "DORNIER", "320", "CRJ", "B737", "737", "TWIN", "OTTER"];
    const matched = availableAircraft.filter((a) =>
      targets.some(
        (t) =>
          a.model.toUpperCase().includes(t) ||
          (a.icao_type && a.icao_type.toUpperCase().includes(t))
      )
    ).slice(0, 5);

    if (matched.length > 0) {
      onSelectPreset(matched);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with Selected Count and Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA] flex items-center space-x-1.5 font-sans">
            <Plane className="w-3.5 h-3.5 text-[#108AEF]" />
            <span>Aircraft Comparison Fleet</span>
          </label>
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${
              selectedAircraft.length > 0
                ? "bg-[#108AEF]/20 text-[#108AEF] border border-[#108AEF]/30"
                : "bg-white/[0.05] text-[#71717A] border border-white/[0.08]"
            }`}
          >
            {selectedAircraft.length} / {maxLimit} selected
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleSelectDomesticPreset}
            className="text-[11px] font-medium text-[#108AEF] hover:text-[#38bdf8] hover:underline cursor-pointer select-none"
          >
            Quick Select Nepal Fleet
          </button>
          {selectedAircraft.length > 0 && (
            <>
              <span className="text-[#71717A] text-xs">•</span>
              <button
                type="button"
                onClick={onClearAll}
                className="text-[11px] font-medium text-[#71717A] hover:text-[#FAFAFA] hover:underline cursor-pointer select-none"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selected Aircraft Chips */}
      {selectedAircraft.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          {selectedAircraft.map((ac) => {
            const key = getAircraftKey(ac);
            return (
              <span
                key={key}
                className="inline-flex items-center space-x-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs bg-[#108AEF]/15 border border-[#108AEF]/30 text-[#FAFAFA] group"
              >
                <span className="font-semibold text-xs">{ac.model}</span>
                <span className="text-[10px] font-mono text-[#108AEF] bg-[#108AEF]/20 px-1 rounded">
                  {ac.icao_type}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleAircraft(ac)}
                  className="p-0.5 rounded-md hover:bg-white/[0.10] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors cursor-pointer"
                  title={`Remove ${ac.model}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search Input & Category Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#71717A] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search aircraft by model or ICAO (e.g. ATR 72, A320, DHC-6, Twin Otter)..."
            className="w-full bg-[#18181B] text-xs text-[#FAFAFA] placeholder-[#71717A] pl-9 pr-3 py-2 rounded-xl border border-white/[0.08] focus:border-[#108AEF] focus:outline-none transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`text-[11px] px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer select-none font-medium ${
                activeCategory === cat.id
                  ? "bg-white/[0.12] text-[#FAFAFA] border border-white/[0.15]"
                  : "bg-white/[0.03] text-[#71717A] hover:text-[#A1A1AA] hover:bg-white/[0.06] border border-white/[0.05]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aircraft List Grid / Scroll Area */}
      <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl bg-[#111113] border border-white/[0.08] p-1.5 scrollbar-thin">
        {loading ? (
          <div className="p-5 text-center text-xs text-[#71717A] flex items-center justify-center space-x-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#108AEF]" />
            <span>Loading aircraft specifications...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center space-y-2">
            <div className="flex items-center justify-center space-x-1.5 text-xs text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-[#FAFAFA] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Loading Fleet</span>
              </button>
            )}
          </div>
        ) : filteredAircraft.length > 0 ? (
          filteredAircraft.map((aircraft) => {
            const itemKey = getAircraftKey(aircraft);
            const isSelected = selectedKeys.has(itemKey);
            const isLimitReached = !isSelected && selectedAircraft.length >= maxLimit;

            return (
              <button
                key={itemKey}
                type="button"
                disabled={isLimitReached}
                onClick={() => onToggleAircraft(aircraft)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-[#108AEF]/15 border border-[#108AEF]/30 text-[#FAFAFA]"
                    : isLimitReached
                    ? "opacity-40 cursor-not-allowed text-[#71717A]"
                    : "hover:bg-white/[0.05] text-[#D4D4D8] border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-[#108AEF] text-white"
                        : "border border-white/[0.20] text-transparent"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold text-[#FAFAFA] truncate">
                        {aircraft.model}
                      </span>
                      <span className="text-[10px] font-mono text-[#108AEF] bg-[#108AEF]/10 px-1 rounded shrink-0">
                        {aircraft.icao_type}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#71717A] flex items-center space-x-2">
                      {aircraft.engine_type && <span>{aircraft.engine_type}</span>}
                      {aircraft.passenger_capacity && (
                        <span>• {aircraft.passenger_capacity} pax</span>
                      )}
                      {aircraft.nominal_range_nm && (
                        <span>• {aircraft.nominal_range_nm} nm</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] font-mono text-[#71717A] shrink-0 ml-2">
                  {aircraft.cruise_speed_kts ? `${aircraft.cruise_speed_kts} kts` : ""}
                </div>
              </button>
            );
          })
        ) : availableAircraft.length === 0 ? (
          <div className="p-4 text-center space-y-2">
            <p className="text-xs text-[#71717A]">No aircraft specifications available.</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-[#FAFAFA] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reload Fleet</span>
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-[#71717A]">
            No aircraft matched &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
};
