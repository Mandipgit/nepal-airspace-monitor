import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info, Sparkles, X, Menu } from "lucide-react";

interface RouteAnalyzerHeaderProps {
  onToggleSidebar?: () => void;
}

export const RouteAnalyzerHeader: React.FC<RouteAnalyzerHeaderProps> = ({
  onToggleSidebar,
}) => {
  const [showInfo, setShowInfo] = useState<boolean>(false);

  return (
    <div className="relative flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-neutral-300 hover:text-white transition-all duration-150 active:scale-95 shadow-sm group shrink-0 cursor-pointer"
          title="Return to Live Airspace Map"
          aria-label="Return to Live Airspace Map"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-neutral-300 group-hover:text-white" />
        </Link>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-neutral-300 hover:text-white transition-all duration-150 active:scale-95 shadow-sm shrink-0 cursor-pointer"
            title="Toggle App Navigation Menu"
            aria-label="Toggle App Navigation Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#FAFAFA] font-sans">
              Route Aircraft Analyzer
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#108AEF]/15 text-[#108AEF] border border-[#108AEF]/25 select-none font-mono">
              Nepal FIR
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#A1A1AA] mt-1 font-sans">
            Compare aircraft performance for a selected Nepal route.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 self-start md:self-auto">
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer select-none ${
            showInfo
              ? "bg-[#108AEF]/20 text-[#FAFAFA] border-[#108AEF]/40"
              : "bg-white/[0.04] text-[#A1A1AA] border-white/[0.08] hover:text-[#FAFAFA] hover:bg-white/[0.08]"
          }`}
          title="Analytical model notes & dispatch disclaimer"
        >
          <Info className="w-3.5 h-3.5 text-[#108AEF]" />
          <span>Analytical Guidance</span>
        </button>
      </div>

      {/* Slide-down Info / Help Disclaimer Banner */}
      {showInfo && (
        <div className="absolute top-full left-0 right-0 z-30 mt-2 p-4 rounded-2xl bg-[#111113] border border-[#108AEF]/30 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 text-xs text-[#D4D4D8] leading-relaxed">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-2.5">
              <Sparkles className="w-4 h-4 text-[#108AEF] shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-semibold text-[#FAFAFA]">
                  Approximate Analytical Comparison Engine
                </p>
                <p className="text-[#A1A1AA]">
                  Calculations evaluate great-circle Haversine distances, effective groundspeed with wind
                  correction, and runway margins derived from published airport databases and static manufacturer
                  specifications.
                </p>
                <p className="text-[11px] text-[#71717A]">
                  ⚠️ <strong>Disclaimer:</strong> This tool is designed strictly for comparative exploratory analysis.
                  It is <em>not</em> an operational flight planning system, dispatch release, or certified Aircraft
                  Flight Manual (AFM/POH) calculation.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="p-1 rounded-lg text-[#71717A] hover:text-[#FAFAFA] hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
