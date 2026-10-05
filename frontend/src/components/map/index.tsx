"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@heroui/react";

export const DynamicFlightMap = dynamic(() => import("./FlightMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#050505] text-neutral-400 select-none">
      <div className="flex flex-col items-center space-y-3">
        <Spinner size="md" className="w-8 h-8 border-[#108AEF] border-t-transparent animate-spin" />
        <span className="text-xs font-sans font-medium text-neutral-300 tracking-normal">
          Initializing Radar Dashboard...
        </span>
      </div>
    </div>
  ),
});

export default DynamicFlightMap;
