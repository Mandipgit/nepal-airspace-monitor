"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Map as MapLibreMap,
  Popup,
  NavigationControl,
  GeoJSONSource,
  setWorkerUrl,
} from "maplibre-gl";
import { NormalizedFlight } from "@/types/flight";
import { AirportSummary } from "@/types/airport";
import { fetchFlightTrajectory } from "@/lib/api";
import { Layers, Scan } from "lucide-react";

// Register MapLibre Web Worker from local public bundle (solves Next.js Turbopack missing vector tiles)
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}


interface FlightMapProps {
  flights: NormalizedFlight[];
  airports: AirportSummary[];
  selectedFlightId: string | null;
  onSelectFlight: (flight: NormalizedFlight | null) => void;
  selectedAirportIdent?: string | null;
  onSelectAirport?: (ident: string | null) => void;
  onBoundsChange?: (bounds: { lamin: number; lomin: number; lamax: number; lomax: number }) => void;
  syncViewport?: boolean;
  onToggleSyncViewport?: () => void;
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (dark: boolean) => void;
  activeTileStyle?: TileStyle | string;
  onCycleTileStyle?: () => void;
}

// Kathmandu FIR Airspace Corridor (covers STAR arrivals & approaches)
// This blue dotted boundary is the exact maximum zoom-out framing target
const NEPAL_FIR_BBOX = {
  lamin: 25.80,
  lomin: 79.80,
  lamax: 30.65,
  lomax: 88.50,
};

const NEPAL_FIR_BOUNDS: [[number, number], [number, number]] = [
  [NEPAL_FIR_BBOX.lomin, NEPAL_FIR_BBOX.lamin], // [79.80, 25.80] Southwest
  [NEPAL_FIR_BBOX.lomax, NEPAL_FIR_BBOX.lamax], // [88.50, 30.65] Northeast
];

// Exact geographical center of the blue dotted FIR box
const NEPAL_CENTER: [number, number] = [84.1500, 28.2250]; // [lng, lat]
const NEPAL_INITIAL_ZOOM = 7.0;
const MIN_ZOOM = 6.0;
const MAX_ZOOM = 15.0;

// Fixed absolute geographic boundary established by maximum zoomed-out framing
const NEPAL_MAX_BOUNDS: [[number, number], [number, number]] = [
  [79.50, 25.50], // Southwest [lng, lat]
  [88.80, 31.00], // Northeast [lng, lat]
];

type TileStyle = "liberty" | "dark" | "positron" | "bright";

const OPENFREEMAP_STYLES: Record<TileStyle, { name: string; url: string; isDark: boolean }> = {
  liberty: {
    name: "OpenFreeMap Liberty",
    url: "https://tiles.openfreemap.org/styles/liberty",
    isDark: false,
  },
  dark: {
    name: "OpenFreeMap Dark",
    url: "https://tiles.openfreemap.org/styles/dark",
    isDark: true,
  },
  positron: {
    name: "OpenFreeMap Positron",
    url: "https://tiles.openfreemap.org/styles/positron",
    isDark: false,
  },
  bright: {
    name: "OpenFreeMap Bright",
    url: "https://tiles.openfreemap.org/styles/bright",
    isDark: false,
  },
};

const MAJOR_AIRPORTS = new Set(["VNKT", "VNPK", "VNBW", "VNLK", "VNVT", "VNNG", "VNJS"]);

export type AircraftCategory =
  | "helicopter"
  | "turboprop"
  | "regional"
  | "narrowbody"
  | "widebody"
  | "generic";

/**
 * Classify aircraft into FlightRadar24-style silhouette categories
 */
export function resolveAircraftCategory(flight: NormalizedFlight): AircraftCategory {
  const typeCode = (
    flight.identification.aircraft_type_icao ||
    flight.aircraft_spec?.icao_type ||
    ""
  ).toUpperCase().trim();
  const catCode = flight.identification.category;
  const catName = (flight.identification.category_name || "").toLowerCase();
  const specModel = (flight.aircraft_spec?.model || "").toUpperCase();

  // 1. Helicopter / Rotorcraft
  if (
    catCode === 7 ||
    catName.includes("rotor") ||
    catName.includes("heli") ||
    typeCode.startsWith("H") ||
    typeCode.startsWith("EC") ||
    typeCode.startsWith("AS") ||
    typeCode.startsWith("B06") ||
    typeCode.startsWith("B412") ||
    typeCode.startsWith("R44") ||
    typeCode.startsWith("R66") ||
    typeCode.startsWith("MI") ||
    specModel.includes("HELICOPTER")
  ) {
    return "helicopter";
  }

  // 2. Wide-Body / Heavy Airliners (Transatlantic / Intercontinental)
  const widebodyTypes = [
    "A330", "A332", "A333", "A338", "A339", "A33X",
    "A340", "A342", "A343", "A345", "A346",
    "A350", "A359", "A35K",
    "A380", "A388",
    "B744", "B747", "B748", "B741", "B742",
    "B777", "B772", "B773", "B77L", "B77W", "B778", "B779",
    "B787", "B788", "B789", "B78X",
    "B762", "B763", "B764", "B767",
    "MD11", "DC10", "IL96"
  ];
  if (
    catCode === 5 ||
    catName.includes("heavy") ||
    widebodyTypes.some((t) => typeCode.includes(t)) ||
    specModel.includes("330") ||
    specModel.includes("350") ||
    specModel.includes("777") ||
    specModel.includes("787") ||
    specModel.includes("747")
  ) {
    return "widebody";
  }

  // 3. Small Turboprop (ATR 42/72, Dash 8, Twin Otter, Dornier 228, Caravan, etc.)
  const turbopropTypes = [
    "AT72", "AT75", "AT76", "AT42", "AT43", "AT45", "ATR",
    "DH8A", "DH8B", "DH8C", "DH8D", "DHC8", "Q400",
    "DHC6", "DH6",
    "D228", "DO228",
    "C208", "PC12", "PC6",
    "B350", "BE20", "BE9L", "B190", "JS41", "L410", "SF34", "F50", "AN24", "AN26", "Y12"
  ];
  const op = (flight.identification.operator_icao || "").toUpperCase();
  if (
    turbopropTypes.some((t) => typeCode.includes(t)) ||
    specModel.includes("ATR") ||
    specModel.includes("TWIN OTTER") ||
    specModel.includes("DASH 8") ||
    specModel.includes("DORNIER") ||
    specModel.includes("CARAVAN") ||
    op === "BHA" || // Buddha Air ATR fleet
    op === "NYT" || // Yeti Airlines ATR fleet
    op === "TRA" || // Tara Air DHC-6 / Dornier
    op === "SMT"    // Summit Air L-410 / Dornier
  ) {
    return "turboprop";
  }

  // 4. Regional Jets (CRJ-200/700/900, Embraer ERJ 145 / E-Jets)
  const regionalTypes = [
    "CRJ1", "CRJ2", "CRJ7", "CRJ9", "CRJX", "CL60",
    "E135", "E140", "E145", "E170", "E175", "E190", "E195", "E290", "E295",
    "SU95", "ARJ21", "BCS1", "BCS3", "A220"
  ];
  if (
    regionalTypes.some((t) => typeCode.includes(t)) ||
    specModel.includes("CRJ") ||
    specModel.includes("EMBRAER")
  ) {
    return "regional";
  }

  // 5. Narrow-Body Airliners (A320/A321 family, B737 family)
  const narrowbodyTypes = [
    "A318", "A319", "A320", "A321", "A20N", "A21N",
    "B731", "B732", "B733", "B734", "B735", "B736", "B737", "B738", "B739", "B38M", "B39M",
    "B752", "B753",
    "C919", "MC21", "T204"
  ];
  if (
    narrowbodyTypes.some((t) => typeCode.includes(t)) ||
    specModel.includes("320") ||
    specModel.includes("321") ||
    specModel.includes("737") ||
    catCode === 3 ||
    catName.includes("large")
  ) {
    return "narrowbody";
  }

  return "generic";
}

/**
 * Strict color assignment based on user specifications:
 * - Selected: RED with clear glowing highlight
 * - Callsign starts with "9N": GREEN
 * - All other aircraft: YELLOW
 */
export function getAircraftColor(
  flight: NormalizedFlight,
  isSelected: boolean
): "selected" | "green" | "yellow" {
  if (isSelected) return "selected";
  const callsign = (flight.identification.callsign || "").trim().toUpperCase();
  const registration = (flight.identification.registration || "").trim().toUpperCase();
  const operator = (flight.identification.operator_icao || "").trim().toUpperCase();
  const originCountry = (flight.identification.origin_country || "").trim().toLowerCase();

  const isNepal =
    flight.identification.is_nepal_registered ||
    originCountry === "nepal" ||
    callsign.startsWith("9N") ||
    callsign.startsWith("9-N") ||
    registration.startsWith("9N") ||
    registration.startsWith("9-N") ||
    ["BHA", "NYT", "SHA", "RNA", "HRA", "TRA", "SMT", "GKR", "HIM", "GBL"].includes(operator);

  if (isNepal) {
    return "green";
  }
  return "yellow";
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/**
 * Draw highly distinct aircraft silhouette pointing UP (0 deg heading)
 */
function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  category: AircraftCategory,
  fillColor: string,
  strokeColor: string
) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (category) {
    case "helicopter": {
      // Rotor Disc (semi-transparent spinning disc)
      ctx.beginPath();
      ctx.ellipse(0, -4, 14, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = fillColor === "#ef4444" ? "rgba(239, 68, 68, 0.25)" : "rgba(255, 255, 255, 0.20)";
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Fuselage & Cabin Bubble
      ctx.beginPath();
      ctx.moveTo(0, -14); // Nose
      ctx.bezierCurveTo(-5, -14, -6, -5, -5, 1);
      ctx.lineTo(-2, 13); // Tail boom port
      ctx.lineTo(-1, 16); // Tail end
      ctx.lineTo(1, 16);
      ctx.lineTo(2, 13);
      ctx.bezierCurveTo(5, 1, 6, -5, 5, -14); // Cabin starboard
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Tail rotor blade
      ctx.beginPath();
      ctx.moveTo(1, 13);
      ctx.lineTo(6, 13);
      ctx.moveTo(1, 16);
      ctx.lineTo(6, 16);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();

      // Main rotor hub
      ctx.beginPath();
      ctx.arc(0, -4, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
      break;
    }

    case "turboprop": {
      // Straight wings with twin engine nacelles & T-tail (ATR 72 / Dash 8 / Twin Otter)
      ctx.beginPath();
      ctx.moveTo(0, -19); // Nose
      ctx.bezierCurveTo(-2.5, -18, -3.2, -10, -3.2, -6);
      ctx.lineTo(-19, -4); // Port wing tip leading
      ctx.lineTo(-19, -1); // Port wing tip trailing
      ctx.lineTo(-3.2, 0);
      ctx.lineTo(-2.8, 14);
      ctx.lineTo(-8.5, 15.5); // Port stabilizer
      ctx.lineTo(-8.5, 18);
      ctx.lineTo(0, 18.5); // Tail cone
      ctx.lineTo(8.5, 18); // Starboard stabilizer
      ctx.lineTo(8.5, 15.5);
      ctx.lineTo(2.8, 14);
      ctx.lineTo(3.2, 0);
      ctx.lineTo(19, -1); // Starboard wing tip trailing
      ctx.lineTo(19, -4); // Starboard wing tip leading
      ctx.lineTo(3.2, -6);
      ctx.bezierCurveTo(3.2, -10, 2.5, -18, 0, -19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Twin Engine Nacelles / Turboprops
      ctx.beginPath();
      drawRoundedRect(ctx, -9.5, -7.5, 3.2, 8, 1.5);
      drawRoundedRect(ctx, 6.3, -7.5, 3.2, 8, 1.5);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case "regional": {
      // Rear-engine swept wing jet with T-tail (CRJ-200/900, ERJ 145)
      ctx.beginPath();
      ctx.moveTo(0, -21); // Nose
      ctx.bezierCurveTo(-2.4, -20, -3.0, -12, -3.0, -6);
      ctx.lineTo(-18, 5); // Port wing tip leading
      ctx.lineTo(-17.5, 8); // Port wing tip trailing
      ctx.lineTo(-3.0, 4);
      ctx.lineTo(-2.6, 16);
      ctx.lineTo(-9.5, 17.5); // T-Tail port
      ctx.lineTo(-9.5, 20);
      ctx.lineTo(0, 20.5); // Tail tip
      ctx.lineTo(9.5, 20);
      ctx.lineTo(9.5, 17.5); // T-Tail starboard
      ctx.lineTo(2.6, 16);
      ctx.lineTo(3.0, 4);
      ctx.lineTo(17.5, 8); // Starboard wing tip trailing
      ctx.lineTo(18, 5); // Starboard wing tip leading
      ctx.lineTo(3.0, -6);
      ctx.bezierCurveTo(3.0, -12, 2.4, -20, 0, -21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Rear Pod Engines
      ctx.beginPath();
      drawRoundedRect(ctx, -6.8, 8, 3, 7.5, 1.5);
      drawRoundedRect(ctx, 3.8, 8, 3, 7.5, 1.5);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case "narrowbody": {
      // Swept wings, underwing twin engines, conventional tail (A320, B737)
      ctx.beginPath();
      ctx.moveTo(0, -25); // Nose
      ctx.bezierCurveTo(-3.2, -23, -4.0, -14, -4.0, -8);
      ctx.lineTo(-24, 7); // Port wing tip leading
      ctx.lineTo(-23.5, 10); // Port wing tip trailing
      ctx.lineTo(-4.0, 5);
      ctx.lineTo(-3.2, 17);
      ctx.lineTo(-11, 21.5); // Port tail
      ctx.lineTo(-10.5, 23.5);
      ctx.lineTo(0, 24); // Tail cone
      ctx.lineTo(10.5, 23.5); // Starboard tail
      ctx.lineTo(11, 21.5);
      ctx.lineTo(3.2, 17);
      ctx.lineTo(4.0, 5);
      ctx.lineTo(23.5, 10); // Starboard wing tip trailing
      ctx.lineTo(24, 7); // Starboard wing tip leading
      ctx.lineTo(4.0, -8);
      ctx.bezierCurveTo(4.0, -14, 3.2, -23, 0, -25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Underwing Turbofans
      ctx.beginPath();
      drawRoundedRect(ctx, -12.5, -2, 3.8, 9, 1.8);
      drawRoundedRect(ctx, 8.7, -2, 3.8, 9, 1.8);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case "widebody": {
      // Long wingspan, broad fuselage, massive turbofans (A330, A350, B777, B787)
      ctx.beginPath();
      ctx.moveTo(0, -32); // Nose
      ctx.bezierCurveTo(-4.2, -30, -5.2, -18, -5.2, -10);
      ctx.lineTo(-32, 10); // Heavy port wing tip leading
      ctx.lineTo(-31.5, 14); // Heavy port wing tip trailing
      ctx.lineTo(-5.2, 7);
      ctx.lineTo(-4.2, 23);
      ctx.lineTo(-14.5, 28.5); // Port tail
      ctx.lineTo(-14, 31);
      ctx.lineTo(0, 31.5); // Tail tip
      ctx.lineTo(14, 31); // Starboard tail
      ctx.lineTo(14.5, 28.5);
      ctx.lineTo(4.2, 23);
      ctx.lineTo(5.2, 7);
      ctx.lineTo(31.5, 14); // Starboard wing tip trailing
      ctx.lineTo(32, 10); // Starboard wing tip leading
      ctx.lineTo(5.2, -10);
      ctx.bezierCurveTo(5.2, -18, 4.2, -30, 0, -32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Heavy Underwing Turbofans
      ctx.beginPath();
      drawRoundedRect(ctx, -16.5, -3, 4.8, 12, 2.4);
      drawRoundedRect(ctx, 11.7, -3, 4.8, 12, 2.4);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case "generic":
    default: {
      // Standard aerodynamic twin-jet profile
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.bezierCurveTo(-3.0, -20, -3.8, -12, -3.8, -7);
      ctx.lineTo(-21, 6);
      ctx.lineTo(-20.5, 9);
      ctx.lineTo(-3.8, 4.5);
      ctx.lineTo(-3.0, 16);
      ctx.lineTo(-10, 20);
      ctx.lineTo(-9.5, 22);
      ctx.lineTo(0, 22.5);
      ctx.lineTo(9.5, 22);
      ctx.lineTo(10, 20);
      ctx.lineTo(3.0, 16);
      ctx.lineTo(3.8, 4.5);
      ctx.lineTo(20.5, 9);
      ctx.lineTo(21, 6);
      ctx.lineTo(3.8, -7);
      ctx.bezierCurveTo(3.8, -12, 3.0, -20, 0, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      drawRoundedRect(ctx, -11, -1, 3.4, 8, 1.6);
      drawRoundedRect(ctx, 7.6, -1, 3.4, 8, 1.6);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

/**
 * Generate 96x96 Retina canvas icons for each category and color state
 */
function registerAircraftIcons(map: MapLibreMap) {
  const categories: AircraftCategory[] = [
    "helicopter",
    "turboprop",
    "regional",
    "narrowbody",
    "widebody",
    "generic",
  ];

  const palettes: {
    colorKey: "green" | "yellow" | "selected";
    fill: string;
    stroke: string;
    isSelected?: boolean;
  }[] = [
      { colorKey: "green", fill: "#22c55e", stroke: "#000000" },
      { colorKey: "yellow", fill: "#facc15", stroke: "#000000" },
      { colorKey: "selected", fill: "#ef4444", stroke: "#000000", isSelected: true },
    ];

  const size = 96;

  categories.forEach((category) => {
    palettes.forEach(({ colorKey, fill, stroke, isSelected }) => {
      const id = `plane-${category}-${colorKey}`;
      if (map.hasImage(id)) return;

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cx = size / 2;
      const cy = size / 2;

      // Draw clean silhouette centered at (cx, cy) - no radial glow or extra boundaries
      ctx.save();
      ctx.translate(cx, cy);
      drawSilhouette(ctx, category, fill, stroke);
      ctx.restore();

      const imgData = ctx.getImageData(0, 0, size, size);
      map.addImage(id, imgData, { pixelRatio: 2 });
    });
  });

  // Backward compatibility fallbacks
  const legacyAliases: [string, string][] = [
    ["plane-nepal", "plane-turboprop-green"],
    ["plane-intl", "plane-narrowbody-yellow"],
    ["plane-mlat", "plane-turboprop-yellow"],
    ["plane-ground", "plane-turboprop-yellow"],
    ["plane-selected", "plane-narrowbody-selected"],
    ["plane-stale", "plane-generic-yellow"],
  ];
  legacyAliases.forEach(([aliasId, targetId]) => {
    if (!map.hasImage(aliasId) && map.hasImage(targetId)) {
      // Intentionally mapped
    }
  });
}

/**
 * Transform flight collection into GeoJSON with zoom-dependent labels & properties
 */
function flightsToGeoJSON(
  flights: NormalizedFlight[],
  selectedFlightId: string | null
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  flights.forEach((flight) => {
    const lat = flight.position.latitude;
    const lon = flight.position.longitude;
    if (lat === null || lon === null) return;

    const isSelected = flight.id === selectedFlightId;
    const category = resolveAircraftCategory(flight);
    const colorName = getAircraftColor(flight, isSelected);
    const iconId = `plane-${category}-${colorName}`;
    const isGreen = colorName === "green";

    const callsign = flight.identification.callsign || flight.identification.icao24.toUpperCase();
    const altFt =
      flight.position.altitude_baro_ft ??
      (flight.position.altitude_baro_m != null
        ? Math.round(flight.position.altitude_baro_m * 3.28084)
        : null);

    const spdKts =
      flight.position.groundspeed_kts ??
      (flight.position.groundspeed_mps != null
        ? Math.round(flight.position.groundspeed_mps * 1.94384)
        : null);

    const fl = altFt != null ? Math.round(altFt / 100) : null;
    const altLabel = altFt != null ? `${Math.round(altFt).toLocaleString()} ft` : "--- ft";
    const spdLabel = spdKts != null ? `${Math.round(spdKts)} kts` : "--- kts";

    // Multi-tier labels for progressive disclosure
    const labelCallsign = callsign;
    const labelFL = fl != null ? `${callsign}\nFL${fl}` : callsign;
    const labelFull = `${callsign}\n${altLabel} • ${spdLabel}`;

    features.push({
      type: "Feature",
      id: flight.id,
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
      properties: {
        id: flight.id,
        callsign,
        heading: flight.position.heading_deg ?? 0,
        icon: iconId,
        isSelected,
        isGreen,
        category,
        labelCallsign,
        labelFL,
        labelFull,
      },
    });
  });

  return {
    type: "FeatureCollection",
    features,
  };
}






/**
 * Known regional and international reference airport coordinates [longitude, latitude]
 */
const KNOWN_AIRPORT_COORDS: Record<string, [number, number]> = {
  // Nepal Airports
  VNKT: [85.3591, 27.6966],
  KTM: [85.3591, 27.6966],
  VNPK: [83.9821, 28.2009],
  PKR: [83.9821, 28.2009],
  VNBW: [83.4161, 27.5056],
  BWA: [83.4161, 27.5056],
  VNLK: [86.7297, 27.6869],
  LUA: [86.7297, 27.6869],
  VNVT: [87.2644, 26.4816],
  BIR: [87.2644, 26.4816],
  VNNG: [81.6669, 28.1054],
  KEP: [81.6669, 28.1054],
  VNCG: [88.0792, 26.5708],
  BDP: [88.0792, 26.5708],
  VNDH: [80.5794, 28.7522],
  DHI: [80.5794, 28.7522],
  VNJP: [85.9239, 26.7072],
  JKR: [85.9239, 26.7072],
  VNSI: [84.9692, 27.1594],
  SIF: [84.9692, 27.1594],
  VNJS: [83.7225, 28.7842],
  JMO: [83.7225, 28.7842],
  VNBP: [84.4294, 27.6789],
  BHR: [84.4294, 27.6789],
  VNTR: [87.1953, 27.3142],
  TMI: [87.1953, 27.3142],
  VNSK: [81.6369, 28.5861],
  SKH: [81.6369, 28.5861],
  VNST: [81.8172, 29.9686],
  IMK: [81.8172, 29.9686],
  // Regional & International Gateways
  VIDP: [77.1031, 28.5665],
  DEL: [77.1031, 28.5665],
  VABB: [72.8656, 19.0896],
  BOM: [72.8656, 19.0896],
  VECC: [88.4467, 22.6547],
  CCU: [88.4467, 22.6547],
  VEBD: [88.3286, 26.6812],
  IXB: [88.3286, 26.6812],
  VEPT: [85.0880, 25.5913],
  PAT: [85.0880, 25.5913],
  VIBN: [82.8593, 25.4524],
  VNS: [82.8593, 25.4524],
  VILK: [80.8893, 26.7606],
  LKO: [80.8893, 26.7606],
  VEGK: [83.4497, 26.7397],
  GOP: [83.4497, 26.7397],
  VGHS: [90.3978, 23.8433],
  DAC: [90.3978, 23.8433],
  VQPR: [89.4246, 27.4032],
  PBH: [89.4246, 27.4032],
  OMDB: [55.3657, 25.2532],
  DXB: [55.3657, 25.2532],
  OTHH: [51.6081, 25.2731],
  DOH: [51.6081, 25.2731],
  OMSJ: [55.5172, 25.3286],
  SHJ: [55.5172, 25.3286],
  OKBK: [47.9800, 29.2267],
  KWI: [47.9800, 29.2267],
  OMAA: [54.6511, 24.4330],
  AUH: [54.6511, 24.4330],
  VTBS: [100.7501, 13.6900],
  BKK: [100.7501, 13.6900],
  VTBD: [100.6072, 13.9125],
  DMK: [100.6072, 13.9125],
  WMKK: [101.7099, 2.7456],
  KUL: [101.7099, 2.7456],
  WSSS: [103.9915, 1.3644],
  SIN: [103.9915, 1.3644],
  VHHH: [113.9185, 22.3080],
  HKG: [113.9185, 22.3080],
  // South & East Asian Common Hubs
  OPIS: [72.8258, 33.5492],
  ISB: [72.8258, 33.5492],
  OPLA: [74.4036, 31.5216],
  LHE: [74.4036, 31.5216],
  OPKC: [67.1608, 24.9065],
  KHI: [67.1608, 24.9065],
  ZGGG: [113.2988, 23.3924],
  CAN: [113.2988, 23.3924],
  ZUUU: [103.9471, 30.5785],
  CTU: [103.9471, 30.5785],
  ZPPP: [102.9292, 25.1019],
  KMG: [102.9292, 25.1019],
  ZBAA: [116.5975, 40.0801],
  PEK: [116.5975, 40.0801],
  PKX: [116.4105, 39.5098],
};

function isPointInsideBox(lng: number, lat: number, box: [number, number, number, number]): boolean {
  return lng >= box[0] && lng <= box[2] && lat >= box[1] && lat <= box[3];
}

function intersectSegmentWithBox(
  pOut: [number, number],
  pIn: [number, number],
  box: [number, number, number, number]
): [number, number] {
  const [minX, minY, maxX, maxY] = box;
  const [x0, y0] = pOut;
  const [x1, y1] = pIn;
  const dx = x1 - x0;
  const dy = y1 - y0;

  let bestT = 0.0;

  if (Math.abs(dx) > 1e-7) {
    const tLeft = (minX - x0) / dx;
    if (tLeft >= 0 && tLeft <= 1) {
      const y = y0 + tLeft * dy;
      if (y >= minY - 0.05 && y <= maxY + 0.05 && tLeft > bestT) bestT = tLeft;
    }
    const tRight = (maxX - x0) / dx;
    if (tRight >= 0 && tRight <= 1) {
      const y = y0 + tRight * dy;
      if (y >= minY - 0.05 && y <= maxY + 0.05 && tRight > bestT) bestT = tRight;
    }
  }

  if (Math.abs(dy) > 1e-7) {
    const tBottom = (minY - y0) / dy;
    if (tBottom >= 0 && tBottom <= 1) {
      const x = x0 + tBottom * dx;
      if (x >= minX - 0.05 && x <= maxX + 0.05 && tBottom > bestT) bestT = tBottom;
    }
    const tTop = (maxY - y0) / dy;
    if (tTop >= 0 && tTop <= 1) {
      const x = x0 + tTop * dx;
      if (x >= minX - 0.05 && x <= maxX + 0.05 && tTop > bestT) bestT = tTop;
    }
  }

  if (bestT > 0 && bestT < 1) {
    return [
      Math.min(maxX, Math.max(minX, x0 + bestT * dx)),
      Math.min(maxY, Math.max(minY, y0 + bestT * dy)),
    ];
  }

  // Robust fallback: clamp pOut to viewport boundary edge so segment begins precisely at viewport edge
  return [
    Math.min(maxX, Math.max(minX, x0)),
    Math.min(maxY, Math.max(minY, y0)),
  ];
}

function clipPathToViewport(
  rawCoords: [number, number][],
  viewportBox: [number, number, number, number]
): [number, number][] {
  if (rawCoords.length < 2) return rawCoords;

  const firstPt = rawCoords[0];
  // If the flight originated within the current viewport, display its available path fully
  if (isPointInsideBox(firstPt[0], firstPt[1], viewportBox)) {
    return rawCoords;
  }

  // If the origin is outside the visible viewport, only display starting from the current viewport boundary
  const lastIdx = rawCoords.length - 1;
  let firstInsideIdx = -1;
  for (let i = 0; i <= lastIdx; i++) {
    if (isPointInsideBox(rawCoords[i][0], rawCoords[i][1], viewportBox)) {
      firstInsideIdx = i;
      break;
    }
  }

  if (firstInsideIdx <= 0) {
    return rawCoords;
  }

  const pOut = rawCoords[firstInsideIdx - 1];
  const pIn = rawCoords[firstInsideIdx];
  const boundaryEntryPt = intersectSegmentWithBox(pOut, pIn, viewportBox);

  return [boundaryEntryPt, ...rawCoords.slice(firstInsideIdx)];
}

/**
 * Builds GeoJSON FeatureCollection for authentic flight trajectory path rendering.
 * Renders the path the aircraft has flown from, clipping at viewport boundary if originated outside.
 */
function buildTrajectoryGeoJSON(
  flight: NormalizedFlight,
  historyPts: Array<{ lng: number; lat: number; alt?: number | null; spd?: number | null }> = [],
  serverPoints?: Array<{ latitude: number; longitude: number; altitude_ft?: number | null; groundspeed_kts?: number | null }>,
  viewportBox?: [number, number, number, number]
): GeoJSON.FeatureCollection {
  if (flight.position.latitude === null || flight.position.longitude === null) {
    return { type: "FeatureCollection", features: [] };
  }

  const curLng = flight.position.longitude;
  const curLat = flight.position.latitude;
  const curAlt = flight.position.altitude_baro_ft;
  const curSpd = flight.position.groundspeed_kts;

  let coords: [number, number][] = [];
  const waypoints: Array<{
    longitude: number;
    latitude: number;
    altitude_ft?: number | null;
    groundspeed_kts?: number | null;
  }> = [];

  // 1. Incorporate server points if provided and has valid breadcrumbs
  if (serverPoints && serverPoints.length > 0) {
    for (const sp of serverPoints) {
      if (
        coords.length === 0 ||
        Math.abs(sp.longitude - coords[coords.length - 1][0]) > 0.0001 ||
        Math.abs(sp.latitude - coords[coords.length - 1][1]) > 0.0001
      ) {
        coords.push([sp.longitude, sp.latitude]);
        waypoints.push({
          longitude: sp.longitude,
          latitude: sp.latitude,
          altitude_ft: sp.altitude_ft ?? curAlt,
          groundspeed_kts: sp.groundspeed_kts ?? curSpd,
        });
      }
    }
  } else if (historyPts && historyPts.length > 0) {
    // 2. Use client-side recorded live history breadcrumbs
    for (const hp of historyPts) {
      if (
        coords.length === 0 ||
        Math.abs(hp.lng - coords[coords.length - 1][0]) > 0.0001 ||
        Math.abs(hp.lat - coords[coords.length - 1][1]) > 0.0001
      ) {
        coords.push([hp.lng, hp.lat]);
        waypoints.push({
          longitude: hp.lng,
          latitude: hp.lat,
          altitude_ft: hp.alt ?? curAlt,
          groundspeed_kts: hp.spd ?? curSpd,
        });
      }
    }
  }

  // 3. If only 0 or 1 point available, use flight origin airport or reverse heading to guarantee immediate trail
  if (coords.length <= 1) {
    const origKey = (flight.route?.origin_icao || flight.route?.origin_iata || "").trim().toUpperCase();
    let origCoord: [number, number] | null = null;
    if (origKey && KNOWN_AIRPORT_COORDS[origKey]) {
      origCoord = KNOWN_AIRPORT_COORDS[origKey];
    }
    if (origCoord) {
      coords.unshift(origCoord);
      waypoints.unshift({
        longitude: origCoord[0],
        latitude: origCoord[1],
        altitude_ft: 0,
        groundspeed_kts: 0,
      });
    } else if (flight.position.heading_deg !== null && flight.position.heading_deg !== undefined) {
      // Reverse heading projection to boundary
      const reverseRad = ((flight.position.heading_deg + 180) % 360) * (Math.PI / 180);
      const backLng = curLng + Math.sin(reverseRad) * 4.5;
      const backLat = curLat + Math.cos(reverseRad) * 4.5;
      coords.unshift([backLng, backLat]);
    }
  }

  // 4. Ensure current aircraft position is the exact end of the trajectory
  if (
    coords.length === 0 ||
    Math.abs(curLng - coords[coords.length - 1][0]) > 0.0001 ||
    Math.abs(curLat - coords[coords.length - 1][1]) > 0.0001
  ) {
    coords.push([curLng, curLat]);
    waypoints.push({
      longitude: curLng,
      latitude: curLat,
      altitude_ft: curAlt,
      groundspeed_kts: curSpd,
    });
  }

  // 5. Apply Viewport Boundary Clipping requirement
  if (viewportBox) {
    coords = clipPathToViewport(coords, viewportBox);
  }

  const features: GeoJSON.Feature[] = [];

  // LineString path: only drawn when we have at least 2 coordinates
  if (coords.length >= 2) {
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
      properties: {
        id: "trajectory-line",
        isLine: true,
      },
    });
  }

  // Waypoint dots (breadcrumbs strictly within visible bounds)
  const recentWaypoints = waypoints.slice(-30);
  recentWaypoints.forEach((wp, idx) => {
    if (!viewportBox || isPointInsideBox(wp.longitude, wp.latitude, viewportBox)) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [wp.longitude, wp.latitude],
        },
        properties: {
          id: `traj-pt-${idx}`,
          isPoint: true,
          alt: wp.altitude_ft,
          spd: wp.groundspeed_kts,
        },
      });
    }
  });

  return {
    type: "FeatureCollection",
    features,
  };
}


export const FlightMap: React.FC<FlightMapProps> = ({
  flights,
  airports,
  selectedFlightId,
  onSelectFlight,
  selectedAirportIdent,
  onSelectAirport,
  onBoundsChange,
  syncViewport = true,
  onToggleSyncViewport,
  isSidebarOpen = true,
  onOpenSidebar,
  isDarkMode = true,
  onToggleDarkMode,
  activeTileStyle: propActiveTileStyle,
  onCycleTileStyle,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const [activeTileStyle, setActiveTileStyle] = useState<TileStyle>(
    (propActiveTileStyle as TileStyle) || "dark"
  );

  const popupRef = useRef<Popup | null>(null);
  const moveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSelectedFlightIdRef = useRef<string | null>(null);
  const minZoomRef = useRef<number>(MIN_ZOOM);

  // Client-side breadcrumb history tracker: flight.id -> coordinates
  const flightHistoryRef = useRef<Record<string, Array<{ lng: number; lat: number; alt?: number | null; spd?: number | null }>>>({});
  // Cached server radar breadcrumbs: icao24 -> points
  const trajectoryServerCacheRef = useRef<Record<string, Array<{ latitude: number; longitude: number; altitude_ft?: number | null; groundspeed_kts?: number | null }>>>({});

  const onBoundsChangeRef = useRef(onBoundsChange);
  const syncViewportRef = useRef(syncViewport);
  const onSelectFlightRef = useRef(onSelectFlight);
  const onSelectAirportRef = useRef(onSelectAirport);
  const flightsRef = useRef(flights);
  const airportsRef = useRef(airports);
  const selectedFlightIdRef = useRef(selectedFlightId);
  const selectedAirportIdentRef = useRef(selectedAirportIdent);

  useEffect(() => {
    onSelectAirportRef.current = onSelectAirport;
  }, [onSelectAirport]);

  useEffect(() => {
    selectedAirportIdentRef.current = selectedAirportIdent;
  }, [selectedAirportIdent]);

  useEffect(() => {
    airportsRef.current = airports;
  }, [airports]);

  useEffect(() => {
    flightsRef.current = flights;
  }, [flights]);

  useEffect(() => {
    selectedFlightIdRef.current = selectedFlightId;
    const map = mapInstanceRef.current;
    if (map && map.isStyleLoaded()) {
      const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
      if (aircraftSource) {
        aircraftSource.setData(flightsToGeoJSON(flightsRef.current, selectedFlightId));
      }
    }
  }, [selectedFlightId]);

  // Instant Trajectory Rendering Engine (Synchronous 0ms updates with boundary clipping)
  const renderInstantTrajectory = useCallback(
    (
      targetFlight: NormalizedFlight | null,
      serverPoints?: Array<{ latitude: number; longitude: number; altitude_ft?: number | null; groundspeed_kts?: number | null }>
    ) => {
      const map = mapInstanceRef.current;
      if (!map || !map.isStyleLoaded()) return;
      const source = map.getSource("trajectory") as GeoJSONSource;
      if (!source) return;

      if (
        !targetFlight ||
        targetFlight.position.latitude === null ||
        targetFlight.position.longitude === null
      ) {
        source.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      // Compute current visible viewport boundary box for exact boundary clipping
      const bounds = map.getBounds();
      const viewportBox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];

      const geojson = buildTrajectoryGeoJSON(
        targetFlight,
        flightHistoryRef.current[targetFlight.id] || [],
        serverPoints,
        viewportBox
      );

      source.setData(geojson);
    },
    []
  );

  const renderInstantTrajectoryRef = useRef(renderInstantTrajectory);
  useEffect(() => {
    renderInstantTrajectoryRef.current = renderInstantTrajectory;
  }, [renderInstantTrajectory]);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    syncViewportRef.current = syncViewport;
  }, [syncViewport]);

  useEffect(() => {
    onSelectFlightRef.current = onSelectFlight;
  }, [onSelectFlight]);

  useEffect(() => {
    flightsRef.current = flights;
  }, [flights]);

  useEffect(() => {
    airportsRef.current = airports;
  }, [airports]);

  useEffect(() => {
    selectedFlightIdRef.current = selectedFlightId;
  }, [selectedFlightId]);

  /**
   * Helper to set up GeoJSON vector layers (airspace borders, airports, and aircraft)
   */
  const setupMapLayers = useCallback(
    (map: MapLibreMap, airportList: AirportSummary[], isDarkStyle = false) => {
      // 1. Register Canvas Aircraft Icons
      registerAircraftIcons(map);

      // 2. Nepal Geographic Border & Airspace Styling
      // Hide internal state/province dashed lines (small dots) completely so the interior of Nepal is clean
      if (map.getLayer("boundary_state")) {
        try {
          map.setLayoutProperty("boundary_state", "visibility", "none");
        } catch {
          // ignore
        }
      }

      // Keep regional basemap boundaries subtle so surrounding countries/states remain dark and unhighlighted
      const boundaryLayers = [
        "boundary_country_z5-",
        "boundary_country_z0-4",
        "boundary_country",
        "boundary_country_inner",
        "boundary_country_outer",
      ];
      boundaryLayers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          try {
            map.setPaintProperty(layerId, "line-color", isDarkStyle ? "#334155" : "#475569");
            map.setPaintProperty(layerId, "line-opacity", isDarkStyle ? 0.35 : 0.65);
            map.setPaintProperty(layerId, "line-width", 1.0);
          } catch {
            // safely ignore if layer has different paint spec
          }
        }
      });

      // Remove global OpenMapTiles country glow so surrounding regions do not glow
      if (map.getLayer("boundary_country_glow")) {
        try {
          map.removeLayer("boundary_country_glow");
        } catch {
          // ignore
        }
      }

      // Add/update dedicated Nepal boundary GeoJSON source and layers strictly along Nepal's actual border
      if (!map.getSource("nepal-boundary")) {
        try {
          map.addSource("nepal-boundary", {
            type: "geojson",
            data: "/nepal-boundary.geojson",
          });

          // Glow effect strictly along Nepal's actual geographic border
          map.addLayer({
            id: "nepal-boundary-glow",
            type: "line",
            source: "nepal-boundary",
            paint: {
              "line-color": isDarkStyle ? "#ffffff" : "#0284c7",
              "line-width": isDarkStyle ? 4.5 : 2.5,
              "line-opacity": isDarkStyle ? 0.35 : 0.2,
              "line-blur": 3,
            },
          });

          // Crisp white boundary line strictly along Nepal's actual geographic border in Dark Mode
          map.addLayer({
            id: "nepal-boundary-line",
            type: "line",
            source: "nepal-boundary",
            paint: {
              "line-color": isDarkStyle ? "#ffffff" : "#475569",
              "line-width": isDarkStyle ? 2.2 : 1.4,
              "line-opacity": isDarkStyle ? 0.95 : 0.7,
            },
          });
        } catch (err) {
          console.error("Error setting up nepal-boundary layers:", err);
        }
      } else {
        // Update paint properties on theme/style change
        try {
          if (map.getLayer("nepal-boundary-glow")) {
            map.setPaintProperty("nepal-boundary-glow", "line-color", isDarkStyle ? "#ffffff" : "#0284c7");
            map.setPaintProperty("nepal-boundary-glow", "line-opacity", isDarkStyle ? 0.35 : 0.2);
            map.setPaintProperty("nepal-boundary-glow", "line-width", isDarkStyle ? 4.5 : 2.5);
          }
          if (map.getLayer("nepal-boundary-line")) {
            map.setPaintProperty("nepal-boundary-line", "line-color", isDarkStyle ? "#ffffff" : "#475569");
            map.setPaintProperty("nepal-boundary-line", "line-opacity", isDarkStyle ? 0.95 : 0.7);
            map.setPaintProperty("nepal-boundary-line", "line-width", isDarkStyle ? 2.2 : 1.4);
          }
        } catch {
          // ignore
        }
      }

      // 3. Airports GeoJSON
      const airportFeatures: GeoJSON.Feature[] = (airportList || [])
        .filter((apt) => apt.latitude_deg && apt.longitude_deg)
        .map((apt) => ({
          type: "Feature",
          properties: {
            ident: apt.ident,
            name: apt.name,
            iata: apt.iata_code || "",
            elevation: apt.elevation_ft || 0,
            municipality: apt.municipality || "Nepal",
            isMajor: MAJOR_AIRPORTS.has(apt.ident),
          },
          geometry: {
            type: "Point",
            coordinates: [apt.longitude_deg, apt.latitude_deg],
          },
        }));

      const airportsGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: airportFeatures,
      };

      if (map.getSource("airports")) {
        (map.getSource("airports") as GeoJSONSource).setData(airportsGeoJSON);
      } else {
        try {
          map.addSource("airports", {
            type: "geojson",
            data: airportsGeoJSON,
          });

          map.addLayer({
            id: "airports-circle",
            type: "circle",
            source: "airports",
            paint: {
              "circle-radius": [
                "case",
                ["boolean", ["get", "isMajor"], false],
                6.0,
                3.5,
              ],
              "circle-color": [
                "case",
                ["boolean", ["get", "isMajor"], false],
                "#10b981",
                isDarkStyle ? "#a3a3a3" : "#525252",
              ],
              "circle-stroke-color": isDarkStyle ? "#000000" : "#ffffff",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.95,
            },
          });
        } catch (err) {
          console.error("Error adding airports layer:", err);
        }
      }

      // 3.5. Flight Trajectory & Breadcrumb GeoJSON Source & Layers (rendered beneath aircraft)
      if (!map.getSource("trajectory")) {
        try {
          map.addSource("trajectory", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          });

          // Trajectory glowing outer path
          map.addLayer({
            id: "trajectory-glow",
            type: "line",
            source: "trajectory",
            filter: ["any", ["==", ["geometry-type"], "LineString"], ["==", ["get", "isLine"], true]],
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#ef4444",
              "line-width": 7,
              "line-opacity": 0.45,
              "line-blur": 3,
            },
          });

          // Trajectory crisp vector path
          map.addLayer({
            id: "trajectory-line",
            type: "line",
            source: "trajectory",
            filter: ["any", ["==", ["geometry-type"], "LineString"], ["==", ["get", "isLine"], true]],
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#ef4444",
              "line-width": 2.5,
              "line-opacity": 0.95,
            },
          });

          // Trajectory breadcrumb waypoints
          map.addLayer({
            id: "trajectory-points",
            type: "circle",
            source: "trajectory",
            filter: ["any", ["==", ["geometry-type"], "Point"], ["==", ["get", "isPoint"], true]],
            paint: {
              "circle-radius": 3.5,
              "circle-color": "#ffffff",
              "circle-stroke-color": "#ef4444",
              "circle-stroke-width": 1.8,
              "circle-opacity": 0.95,
            },
          });
        } catch (err) {
          console.error("Error adding trajectory layers:", err);
        }
      }

      // 4. Aircraft GeoJSON Source & High-Performance Symbol Layers
      const initialAircraftData = flightsToGeoJSON(
        flightsRef.current,
        selectedFlightIdRef.current
      );

      if (map.getSource("aircraft")) {
        (map.getSource("aircraft") as GeoJSONSource).setData(initialAircraftData);
      } else {
        try {
          map.addSource("aircraft", {
            type: "geojson",
            data: initialAircraftData,
          });

          // Aircraft Directional Icons Layer (Hardware-accelerated map track rotation)
          map.addLayer({
            id: "aircraft-icons",
            type: "symbol",
            source: "aircraft",
            layout: {
              "icon-image": ["get", "icon"],
              "icon-rotate": ["get", "heading"],
              "icon-rotation-alignment": "map",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                0.70,
                7,
                0.95,
                10,
                1.25,
                14,
                1.55,
              ],
            },
          });

          // Aircraft Labels Layer with NATIVE COLLISION MANAGEMENT & ZOOM-DEPENDENT LOD
          map.addLayer({
            id: "aircraft-labels",
            type: "symbol",
            source: "aircraft",
            filter: ["!=", ["get", "isSelected"], true], // Selected flight has separate pinned layer
            layout: {
              // Zoom-dependent progressive disclosure:
              // Zoom < 6: empty string (icon only)
              // Zoom 6–8: Callsign
              // Zoom 8–10: Callsign + FL
              // Zoom 10+: Callsign + Alt + Speed
              "text-field": [
                "step",
                ["zoom"],
                "",
                6,
                ["get", "labelCallsign"],
                8,
                ["get", "labelFL"],
                10,
                ["get", "labelFull"],
              ],
              "text-font": ["Noto Sans Bold"],
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6,
                10,
                9,
                11,
                12,
                12.5,
              ],
              // Variable anchor dynamically wraps around icon to prevent edge collisions
              "text-variable-anchor": ["top", "bottom", "left", "right", "top-left", "top-right"],
              "text-radial-offset": 0.85,
              "text-justify": "auto",
              // COLLISION DETECTION: Automatically suppress overlapping labels
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "text-padding": 4,
            },
            paint: {
              "text-color": [
                "case",
                ["==", ["get", "isGreen"], true],
                isDarkStyle ? "#34d399" : "#065f46",
                isDarkStyle ? "#facc15" : "#b45309",
              ],
              "text-halo-color": isDarkStyle
                ? "rgba(0, 0, 0, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              "text-halo-width": 2.2,
              "text-halo-blur": 0.5,
            },
          });

          // Selected Aircraft Pinned Label (always visible, highest priority)
          map.addLayer({
            id: "aircraft-selected-label",
            type: "symbol",
            source: "aircraft",
            filter: ["==", ["get", "isSelected"], true],
            layout: {
              "text-field": ["get", "labelFull"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 12,
              "text-variable-anchor": ["top", "bottom", "left", "right"],
              "text-radial-offset": 1.1,
              "text-justify": "auto",
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#ef4444",
              "text-halo-color": isDarkStyle
                ? "rgba(0, 0, 0, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              "text-halo-width": 2.5,
              "text-halo-blur": 0.5,
            },
          });
        } catch (err) {
          console.error("Error adding aircraft layers:", err);
        }
      }

      // Re-apply trajectory immediately if a flight is currently selected
      if (selectedFlightIdRef.current) {
        const sel = flightsRef.current.find((f) => f.id === selectedFlightIdRef.current);
        if (sel) {
          renderInstantTrajectoryRef.current?.(sel);
        }
      }

    },
    []
  );

  // Initialize MapLibre GL Map Instance (STRICTLY ONCE)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialStyleDef = OPENFREEMAP_STYLES.dark;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: initialStyleDef.url,
      center: NEPAL_CENTER,
      zoom: NEPAL_INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: NEPAL_MAX_BOUNDS,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 80,
    });

    // Configure silky smooth wheel zoom and continuous momentum panning
    map.scrollZoom.setWheelZoomRate(1 / 450);
    map.scrollZoom.enable();
    map.dragPan.enable();

    // Navigation Controls (Zoom & Compass)
    map.addControl(
      new NavigationControl({
        showCompass: true,
        showZoom: true,
      }),
      "top-right"
    );

    // Provide clean fallback for any missing sprite icons (e.g. circle-11 in OpenFreeMap)
    map.on("styleimagemissing", (e) => {
      const id = e.id;
      if (!map.hasImage(id)) {
        const size = 16;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#888888";
          ctx.fill();
          map.addImage(id, ctx.getImageData(0, 0, size, size));
        }
      }
    });

    // Initial load handler
    map.on("load", () => {
      setupMapLayers(map, airportsRef.current, initialStyleDef.isDark);

      // Enforce new minimum zoom exactly ONE ZOOM STEP MORE ZOOMED OUT (6.0)
      const newMinZoom = 6.0;
      map.setMinZoom(newMinZoom);
      minZoomRef.current = newMinZoom;

      // Lock camera to current framing and enforce fixed geographic bounds
      map.setCenter(NEPAL_CENTER);
      map.setZoom(7.0);
      map.setMaxBounds(NEPAL_MAX_BOUNDS);
      map.dragPan.enable();

      // Trigger initial bounds calculation
      const b = map.getBounds();
      if (onBoundsChangeRef.current && syncViewportRef.current) {
        onBoundsChangeRef.current({
          lamin: Math.round(b.getSouth() * 10000) / 10000,
          lomin: Math.round(b.getWest() * 10000) / 10000,
          lamax: Math.round(b.getNorth() * 10000) / 10000,
          lomax: Math.round(b.getEast() * 10000) / 10000,
        });
      }
    });

    // Re-fit on container resize (e.g. sidebar toggle or window resize)
    map.on("resize", () => {
      map.setMaxBounds(NEPAL_MAX_BOUNDS);
      map.dragPan.enable();
    });

    // Debounced Viewport change listener (drag/pan/zoom)
    const handleMoveEnd = () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = setTimeout(() => {
        if (!mapInstanceRef.current) return;
        const b = mapInstanceRef.current.getBounds();
        const nextBounds = {
          lamin: Math.round(b.getSouth() * 10000) / 10000,
          lomin: Math.round(b.getWest() * 10000) / 10000,
          lamax: Math.round(b.getNorth() * 10000) / 10000,
          lomax: Math.round(b.getEast() * 10000) / 10000,
        };

        if (syncViewportRef.current && onBoundsChangeRef.current) {
          onBoundsChangeRef.current(nextBounds);
        }

        // Update aircraft source data for current visible bounds
        const aircraftSource = mapInstanceRef.current.getSource("aircraft") as GeoJSONSource;
        if (aircraftSource) {
          const updatedGeoJSON = flightsToGeoJSON(
            flightsRef.current,
            selectedFlightIdRef.current
          );
          aircraftSource.setData(updatedGeoJSON);
        }

        // If a flight is currently selected, recompute boundary projection for the new viewport bounds
        if (selectedFlightIdRef.current) {
          const currentFlight = flightsRef.current.find((f) => f.id === selectedFlightIdRef.current);
          if (currentFlight) {
            const cached = trajectoryServerCacheRef.current[currentFlight.identification.icao24];
            renderInstantTrajectoryRef.current?.(currentFlight, cached);
          }
        }
      }, 150);
    };

    map.on("moveend", handleMoveEnd);

    // Variable to track if a feature (aircraft or airport) was clicked in this event cycle
    let featureClickedInThisCycle = false;

    // Click handler for aircraft selection via GPU hit detection (INSTANT 0ms RED MARKER & TRAIL RENDER)
    map.on("click", "aircraft-icons", (e) => {
      if (!e.features || e.features.length === 0) return;
      featureClickedInThisCycle = true;
      const clickedId = e.features[0].properties?.id;
      if (clickedId) {
        selectedFlightIdRef.current = clickedId;

        // 1. Instantly turn aircraft marker RED on exact click frame (0ms)
        const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
        if (aircraftSource) {
          aircraftSource.setData(flightsToGeoJSON(flightsRef.current, clickedId));
        }

        const flight = flightsRef.current.find((f) => f.id === clickedId) || null;
        if (flight) {
          // 2. Render flight path/trail immediately and consistently (0ms)
          const targetIcao = flight.identification.icao24;
          const cached = trajectoryServerCacheRef.current[targetIcao];
          renderInstantTrajectoryRef.current?.(flight, cached);
        }
        onSelectFlightRef.current?.(flight);
        onSelectAirportRef.current?.(null);
      }
    });

    // Click handler for airport selection on Nepal map
    map.on("click", "airports-circle", (e) => {
      if (!e.features || e.features.length === 0) return;
      featureClickedInThisCycle = true;
      const clickedIdent = e.features[0].properties?.ident;
      if (clickedIdent) {
        if (popupRef.current) {
          popupRef.current.remove();
        }
        // Deselect flight and select airport
        selectedFlightIdRef.current = null;
        const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
        if (aircraftSource) {
          aircraftSource.setData(flightsToGeoJSON(flightsRef.current, null));
        }
        onSelectFlightRef.current?.(null);
        // Clear flight trajectory
        const trajSource = map.getSource("trajectory") as GeoJSONSource;
        if (trajSource) {
          trajSource.setData({ type: "FeatureCollection", features: [] });
        }
        onSelectAirportRef.current?.(clickedIdent);
      }
    });

    // Deselect aircraft and airport on empty map background click (INSTANT 0ms TRAIL REMOVAL)
    map.on("click", (e) => {
      if (!mapInstanceRef.current) return;
      if (featureClickedInThisCycle) {
        featureClickedInThisCycle = false;
        return;
      }

      const bbox: [[number, number], [number, number]] = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ];
      const aircraftHits = mapInstanceRef.current.queryRenderedFeatures(bbox, {
        layers: ["aircraft-icons"],
      });
      const airportHits = mapInstanceRef.current.queryRenderedFeatures(bbox, {
        layers: ["airports-circle"],
      });
      if (aircraftHits.length === 0 && airportHits.length === 0) {
        selectedFlightIdRef.current = null;
        const aircraftSource = mapInstanceRef.current.getSource("aircraft") as GeoJSONSource;
        if (aircraftSource) {
          aircraftSource.setData(flightsToGeoJSON(flightsRef.current, null));
        }
        // Synchronously clear trajectory source on the exact click event
        const trajSource = mapInstanceRef.current.getSource("trajectory") as GeoJSONSource;
        if (trajSource) {
          trajSource.setData({ type: "FeatureCollection", features: [] });
        }
        onSelectFlightRef.current?.(null);
        onSelectAirportRef.current?.(null);
      }
    });

    // Aircraft Hover Cursor
    map.on("mouseenter", "aircraft-icons", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "aircraft-icons", () => {
      map.getCanvas().style.cursor = "";
    });

    // Airport Hover Tooltip
    popupRef.current = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: "avionics-map-popup",
    });

    map.on("mouseenter", "airports-circle", (e) => {
      map.getCanvas().style.cursor = "pointer";
      if (!e.features || e.features.length === 0 || !popupRef.current) return;
      const f = e.features[0];
      const geom = f.geometry as GeoJSON.Point;
      const coords = geom.coordinates.slice() as [number, number];
      const p = f.properties || {};

      popupRef.current
        .setLngLat(coords)
        .setHTML(`
          <div class="p-1 font-sans text-xs cursor-pointer select-none" id="popup-airport-${p.ident}">
            <div class="font-bold text-neutral-100 flex items-center gap-1">
              <span>${p.name}</span>
              <span class="text-emerald-400 font-mono font-bold">(${p.ident}${p.iata ? ` / ${p.iata}` : ""})</span>
            </div>
            <div class="text-neutral-400 mt-1 font-mono text-[11px]">
              Elev: ${p.elevation ? `${p.elevation.toLocaleString()} ft` : "N/A"} • ${p.municipality || "Nepal"}
            </div>
            <div class="text-[10px] text-emerald-400 font-sans font-semibold mt-1 flex items-center gap-1">
              <span>Click to view airport & runway details</span>
              <span>→</span>
            </div>
          </div>
        `)
        .addTo(map);

      const popupEl = document.getElementById(`popup-airport-${p.ident}`);
      if (popupEl) {
        popupEl.onclick = () => {
          if (popupRef.current) popupRef.current.remove();
          onSelectFlightRef.current?.(null);
          const trajSource = map.getSource("trajectory") as GeoJSONSource;
          if (trajSource) {
            trajSource.setData({ type: "FeatureCollection", features: [] });
          }
          onSelectAirportRef.current?.(p.ident);
        };
      }
    });

    map.on("mouseleave", "airports-circle", () => {
      map.getCanvas().style.cursor = "";
      if (popupRef.current) {
        popupRef.current.remove();
      }
    });

    mapInstanceRef.current = map;
    if (typeof window !== "undefined") {
      (window as unknown as { __map: MapLibreMap }).__map = map;
    }

    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [setupMapLayers]);

  // Update Aircraft GeoJSON Source data and track live history when flights polling updates (ZERO MAP RESET)
  useEffect(() => {
    // Record breadcrumbs for all flights in memory
    flights.forEach((f) => {
      if (f.position.latitude !== null && f.position.longitude !== null) {
        const hist = flightHistoryRef.current[f.id] || [];
        const last = hist[hist.length - 1];
        if (
          !last ||
          Math.abs(last.lng - f.position.longitude) > 0.0001 ||
          Math.abs(last.lat - f.position.latitude) > 0.0001
        ) {
          hist.push({
            lng: f.position.longitude,
            lat: f.position.latitude,
            alt: f.position.altitude_baro_ft,
            spd: f.position.groundspeed_kts,
          });
          if (hist.length > 50) hist.shift();
          flightHistoryRef.current[f.id] = hist;
        }
      }
    });

    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
    if (!aircraftSource) return;

    const nextGeoJSON = flightsToGeoJSON(flights, selectedFlightId);
    aircraftSource.setData(nextGeoJSON);

    // If currently selected flight updated position, refresh its path
    if (selectedFlightId) {
      const currentFlight = flights.find((f) => f.id === selectedFlightId);
      if (currentFlight) {
        const cached = trajectoryServerCacheRef.current[currentFlight.identification.icao24];
        renderInstantTrajectoryRef.current?.(currentFlight, cached);
      }
    }
  }, [flights, selectedFlightId]);

  // Update Airport vector layer when airports change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      setupMapLayers(map, airports, OPENFREEMAP_STYLES[activeTileStyle].isDark);
    } else {
      map.once("style.load", () => {
        setupMapLayers(map, airports, OPENFREEMAP_STYLES[activeTileStyle].isDark);
      });
    }
  }, [airports, activeTileStyle, setupMapLayers]);

  // Synchronize Dark Mode toggle from TopBar with Map State
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (isDarkMode) {
      if (activeTileStyle !== "dark") {
        setActiveTileStyle("dark");
        map.setStyle(OPENFREEMAP_STYLES.dark.url);
        map.once("style.load", () => {
          setupMapLayers(map, airportsRef.current, true);
        });
      }
    } else {
      if (activeTileStyle === "dark") {
        setActiveTileStyle("bright");
        map.setStyle(OPENFREEMAP_STYLES.bright.url);
        map.once("style.load", () => {
          setupMapLayers(map, airportsRef.current, false);
        });
      }
    }
  }, [isDarkMode, activeTileStyle, setupMapLayers]);

  // Synchronize Map Tile Style from Prop (TopBar control)
  useEffect(() => {
    if (!propActiveTileStyle) return;
    const styleKey = propActiveTileStyle as TileStyle;
    if (!OPENFREEMAP_STYLES[styleKey] || styleKey === activeTileStyle) return;

    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    setActiveTileStyle(styleKey);
    map.setStyle(OPENFREEMAP_STYLES[styleKey].url);
    map.once("style.load", () => {
      setupMapLayers(map, airportsRef.current, OPENFREEMAP_STYLES[styleKey].isDark);
    });
  }, [propActiveTileStyle, activeTileStyle, setupMapLayers]);

  // Handle Basemap Style Switching (Dark is removed from options)
  const cycleTileLayer = () => {
    if (onCycleTileStyle) {
      onCycleTileStyle();
      return;
    }
    const map = mapInstanceRef.current;
    if (!map) return;

    const styles: TileStyle[] = ["bright", "liberty", "positron"];
    const currentIndex = styles.indexOf(activeTileStyle);
    const nextStyle = currentIndex === -1 ? styles[0] : styles[(currentIndex + 1) % styles.length];
    setActiveTileStyle(nextStyle);

    if (isDarkMode && onToggleDarkMode) {
      onToggleDarkMode(false);
    }

    map.setStyle(OPENFREEMAP_STYLES[nextStyle].url);
    map.once("style.load", () => {
      setupMapLayers(map, airportsRef.current, OPENFREEMAP_STYLES[nextStyle].isDark);
    });
  };

  // Reset to exact FIR Airspace View at enforced minimum zoom
  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const baseZoom = minZoomRef.current || MIN_ZOOM;
    map.easeTo({
      center: NEPAL_CENTER,
      zoom: baseZoom,
      duration: 500,
    });
  };

  // Smoothly fly to selected flight ONLY when selection actually changes
  useEffect(() => {
    if (!selectedFlightId || !mapInstanceRef.current) {
      prevSelectedFlightIdRef.current = selectedFlightId;
      return;
    }

    if (prevSelectedFlightIdRef.current !== selectedFlightId) {
      prevSelectedFlightIdRef.current = selectedFlightId;
      const selected = flights.find((f) => f.id === selectedFlightId);
      if (selected && selected.position.latitude !== null && selected.position.longitude !== null) {
        mapInstanceRef.current.flyTo({
          center: [selected.position.longitude, selected.position.latitude],
          zoom: Math.max(mapInstanceRef.current.getZoom(), 8.5),
          duration: 1200,
          essential: true,
        });
      }
    }
  }, [selectedFlightId, flights]);

  // Live Flight Trajectory & Breadcrumbs trail manager (Instant boundary projection + backend radar enhancement)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!selectedFlightId) {
      if (map && map.isStyleLoaded() && map.getSource("trajectory")) {
        (map.getSource("trajectory") as GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      return;
    }

    const selectedFlight = flightsRef.current.find((f) => f.id === selectedFlightId);
    if (!selectedFlight) return;

    const targetIcao = selectedFlight.identification.icao24;
    const cachedPoints = trajectoryServerCacheRef.current[targetIcao];

    // Render instant boundary-aware trajectory immediately (0ms synchronous render)
    renderInstantTrajectory(selectedFlight, cachedPoints);

    let isCancelled = false;

    // Fetch full trajectory trail from backend in background to enhance precision
    fetchFlightTrajectory(targetIcao)
      .then((res) => {
        if (isCancelled) return;
        if (res.points && res.points.length > 0) {
          trajectoryServerCacheRef.current[targetIcao] = res.points;
        }
        if (selectedFlightIdRef.current === selectedFlight.id) {
          renderInstantTrajectory(selectedFlight, res.points || cachedPoints);
        }
      })
      .catch((err) => {
        console.warn(`Could not fetch trajectory for ${targetIcao}:`, err);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedFlightId, renderInstantTrajectory]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      {/* MapLibre WebGL DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full" />



      {/* Streamlined Minimal Floating Legend */}
      <div
        style={{
          willChange: "transform",
          transform: isSidebarOpen ? "translateX(268px)" : "translateX(0px)",
          transition: isSidebarOpen
            ? "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)"
            : "transform 260ms cubic-bezier(0.25, 1, 0.5, 1)",
        }}
        className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center space-x-3.5 px-4 py-2 rounded-2xl bg-[#0a0b0e]/95 border border-white/18 text-[11px] shadow-[0_4px_15px_rgba(0,0,0,0.45)] backdrop-blur-xl pointer-events-none select-none"
      >
        <span className="font-semibold text-emerald-400">9N (Nepal)</span>
        <span className="font-semibold text-yellow-300">Other / Transit</span>
        <span className="font-semibold text-red-400">Selected & Trail</span>
        <span className="font-medium text-neutral-300">Airports</span>
      </div>
    </div>
  );
};

export default FlightMap;

