"use client";

import React from "react";
import { Wind, Navigation, HelpCircle } from "lucide-react";

interface ConditionsInputProps {
  windKmh: number;
  onChangeWindKmh: (val: number) => void;
  descentDistanceKm: number;
  onChangeDescentDistanceKm: (val: number) => void;
  disabled?: boolean;
}

export const ConditionsInput: React.FC<ConditionsInputProps> = ({
  windKmh,
  onChangeWindKmh,
  descentDistanceKm,
  onChangeDescentDistanceKm,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA] flex items-center space-x-1.5 font-sans">
          <span>Flight Assumptions & Conditions</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Wind Input */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-[#FAFAFA]">
              <Wind className="w-3.5 h-3.5 text-[#108AEF]" />
              <span>Wind Component</span>
            </div>
            <span
              className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                windKmh > 0
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : windKmh < 0
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/[0.05] text-[#A1A1AA] border border-white/[0.08]"
              }`}
            >
              {windKmh > 0 ? `+${windKmh} km/h (Headwind)` : windKmh < 0 ? `${windKmh} km/h (Tailwind)` : "0 km/h (Calm)"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={windKmh}
              onChange={(e) => onChangeWindKmh(Number(e.target.value) || 0)}
              min={-400}
              max={400}
              step={5}
              disabled={disabled}
              className="w-full bg-[#18181B] text-xs font-mono text-[#FAFAFA] px-3 py-2 rounded-lg border border-white/[0.08] focus:border-[#108AEF] focus:outline-none transition-colors"
            />
            <span className="text-xs text-[#71717A] font-mono shrink-0">km/h</span>
          </div>

          <p className="text-[10px] text-[#71717A] leading-tight font-sans">
            Positive (+) = Headwind (slows ground speed) • Negative (-) = Tailwind (increases ground speed).
          </p>
        </div>

        {/* Descent Distance Input */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-[#FAFAFA] font-sans">
              <Navigation className="w-3.5 h-3.5 text-[#108AEF]" />
              <span>Descent Distance</span>
            </div>
            <span className="text-[11px] font-mono text-[#A1A1AA] bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.08]">
              {descentDistanceKm} km
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={descentDistanceKm}
              onChange={(e) => onChangeDescentDistanceKm(Math.max(0, Number(e.target.value) || 0))}
              min={0}
              max={300}
              step={10}
              disabled={disabled}
              className="w-full bg-[#18181B] text-xs font-mono text-[#FAFAFA] px-3 py-2 rounded-lg border border-white/[0.08] focus:border-[#108AEF] focus:outline-none transition-colors"
            />
            <span className="text-xs text-[#71717A] font-mono shrink-0">km</span>
          </div>

          <p className="text-[10px] text-[#71717A] leading-tight font-sans">
            Allocated distance for approach & descent profiling (default: 50 km).
          </p>
        </div>
      </div>
    </div>
  );
};
