import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const RouteAnalyzerHeader: React.FC = () => {
  return (
    <div className="relative flex items-center justify-between pb-4 border-b border-white/[0.08]">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-neutral-300 hover:text-white transition-all duration-150 active:scale-95 shadow-sm group shrink-0 cursor-pointer"
          title="Return to Live Airspace Map"
          aria-label="Return to Live Airspace Map"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-neutral-300 group-hover:text-white" />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#FAFAFA] font-sans">
            Route Aircraft Analyzer
          </h1>
          <p className="text-xs md:text-sm text-[#A1A1AA] mt-1 font-sans">
            Compare aircraft performance for a selected Nepal route.
          </p>
        </div>
      </div>
    </div>
  );
};
