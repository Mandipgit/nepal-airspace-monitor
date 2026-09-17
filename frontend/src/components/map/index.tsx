"use client";

import dynamic from "next/dynamic";

export const DynamicFlightMap = dynamic(() => import("./FlightMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black text-neutral-400 select-none">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono-avionics tracking-wider text-neutral-300">
          INITIALIZING NEPAL AIRSPACE RADAR...
        </span>
      </div>
    </div>
  ),
});

export default DynamicFlightMap;
