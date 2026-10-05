"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Map as MapLibreMap,
  Popup,
  NavigationControl,
  GeoJSONSource,
  setWorkerUrl,
} from "maplibre-gl";
import { NormalizedFlight, FlightTrajectoryResponse } from "@/types/flight";
import { AirportSummary } from "@/types/airport";
import { fetchFlightTrajectory, fetchAirportDetail } from "@/lib/api";
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






function isPointInsideBox(lng: number, lat: number, box: [number, number, number, number]): boolean {
  return lng >= box[0] && lng <= box[2] && lat >= box[1] && lat <= box[3];
}

/**
 * Calculates the exact point where a line segment from pOut (outside box)
 * to pIn (inside box) enters the axis-aligned boundary box.
 * Uses the Liang-Barsky line clipping algorithm.
 */
function getBoundaryEntryIntersection(
  pOut: [number, number],
  pIn: [number, number],
  box: [number, number, number, number]
): [number, number] {
  const [minX, minY, maxX, maxY] = box;
  const [x0, y0] = pOut;
  const [x1, y1] = pIn;
  const dx = x1 - x0;
  const dy = y1 - y0;

  let tEnter = 0.0;
  let tExit = 1.0;

  const checks = [
    { p: -dx, q: x0 - minX }, // Left: x >= minX
    { p: dx, q: maxX - x0 },  // Right: x <= maxX
    { p: -dy, q: y0 - minY }, // Bottom: y >= minY
    { p: dy, q: maxY - y0 },  // Top: y <= maxY
  ];

  for (const { p, q } of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) {
        return [
          Math.min(maxX, Math.max(minX, x0)),
          Math.min(maxY, Math.max(minY, y0)),
        ];
      }
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > tEnter) tEnter = t;
      } else {
        if (t < tExit) tExit = t;
      }
    }
  }

  if (tEnter <= tExit && tEnter >= 0 && tEnter <= 1) {
    return [
      Math.min(maxX, Math.max(minX, x0 + tEnter * dx)),
      Math.min(maxY, Math.max(minY, y0 + tEnter * dy)),
    ];
  }

  return [
    Math.min(maxX, Math.max(minX, x0)),
    Math.min(maxY, Math.max(minY, y0)),
  ];
}

/**
 * Clips flight trajectory against the configured maximum map viewport boundary.
 * If departure is inside the configured boundary, path is left unclipped.
 * If departure is outside, path is clipped to start at the exact boundary entry intersection.
 */
function clipTrajectoryToMaxViewport(
  rawCoords: [number, number][],
  maxBox: [number, number, number, number]
): [number, number][] {
  if (rawCoords.length < 2) return rawCoords;

  const firstPt = rawCoords[0];
  // 1. Straightforward case: If departure location is inside configured maximum map viewport,
  // render the trace starting from the departure location toward the aircraft's current position.
  if (isPointInsideBox(firstPt[0], firstPt[1], maxBox)) {
    return rawCoords;
  }

  // 2. Departure outside configured maximum viewport:
  // Find where the flight path first enters the configured maximum viewport boundary.
  let firstInsideIdx = -1;
  for (let i = 0; i < rawCoords.length; i++) {
    if (isPointInsideBox(rawCoords[i][0], rawCoords[i][1], maxBox)) {
      firstInsideIdx = i;
      break;
    }
  }

  if (firstInsideIdx <= 0) {
    return rawCoords;
  }

  const pOut = rawCoords[firstInsideIdx - 1];
  const pIn = rawCoords[firstInsideIdx];
  const boundaryEntryPt = getBoundaryEntryIntersection(pOut, pIn, maxBox);

  return [boundaryEntryPt, ...rawCoords.slice(firstInsideIdx)];
}

/**
 * Resolves the genuine departure coordinates using existing flight route and airports data.
 * Strictly adheres to zero hardcoding requirement.
 */
function getDepartureCoordinates(
  flight: NormalizedFlight,
  airportsList: AirportSummary[],
  serverTrajectory?: FlightTrajectoryResponse | null,
  cachedAirportCoords?: Record<string, [number, number]>
): [number, number] | null {
  // 1. Direct from server trajectory response if provided
  if (
    serverTrajectory?.origin_longitude != null &&
    serverTrajectory?.origin_latitude != null
  ) {
    return [serverTrajectory.origin_longitude, serverTrajectory.origin_latitude];
  }

  // 2. Direct from flight route if provided by backend API
  if (
    flight.route?.origin_longitude != null &&
    flight.route?.origin_latitude != null
  ) {
    return [flight.route.origin_longitude, flight.route.origin_latitude];
  }

  const origKey = (
    flight.route?.origin_icao ||
    flight.route?.origin_iata ||
    serverTrajectory?.origin_icao ||
    serverTrajectory?.origin_iata ||
    ""
  ).trim().toUpperCase();

  if (!origKey) return null;

  // 3. From dynamically cached airport coordinates lookup
  if (cachedAirportCoords && cachedAirportCoords[origKey]) {
    return cachedAirportCoords[origKey];
  }

  // 4. From loaded airports dataset (passed as prop to FlightMap)
  if (airportsList && airportsList.length > 0) {
    const matchedAirport = airportsList.find(
      (a) =>
        a.ident.toUpperCase() === origKey ||
        (a.iata_code && a.iata_code.toUpperCase() === origKey)
    );
    if (
      matchedAirport &&
      matchedAirport.longitude_deg != null &&
      matchedAirport.latitude_deg != null
    ) {
      return [matchedAirport.longitude_deg, matchedAirport.latitude_deg];
    }
  }

  return null;
}

/**
 * Builds GeoJSON FeatureCollection for authentic flight trajectory path rendering.
 * Renders the path the aircraft has flown, starting from departure location, and clipping
 * to the configured maximum viewport boundary if originated outside.
 */
function buildTrajectoryGeoJSON(
  flight: NormalizedFlight,
  historyPts: Array<{ lng: number; lat: number; alt?: number | null; spd?: number | null }> = [],
  serverTrajectory?: FlightTrajectoryResponse | null,
  airportsList: AirportSummary[] = [],
  maxViewportBounds: [[number, number], [number, number]] = NEPAL_MAX_BOUNDS,
  cachedAirportCoords?: Record<string, [number, number]>
): GeoJSON.FeatureCollection {
  if (flight.position.latitude === null || flight.position.longitude === null) {
    return { type: "FeatureCollection", features: [] };
  }

  const curLng = flight.position.longitude;
  const curLat = flight.position.latitude;
  const curAlt = flight.position.altitude_baro_ft;
  const curSpd = flight.position.groundspeed_kts;

  let rawCoords: [number, number][] = [];
  const waypoints: Array<{
    longitude: number;
    latitude: number;
    altitude_ft?: number | null;
    groundspeed_kts?: number | null;
  }> = [];

  const depCoord = getDepartureCoordinates(flight, airportsList, serverTrajectory, cachedAirportCoords);

  // 1. If departure location is known, start the trace from the actual departure location
  if (depCoord) {
    rawCoords.push([depCoord[0], depCoord[1]]);
    waypoints.push({
      longitude: depCoord[0],
      latitude: depCoord[1],
      altitude_ft: 0,
      groundspeed_kts: 0,
    });
  }

  // 2. Gather historical breadcrumbs from server and/or client history
  const serverPoints = serverTrajectory?.points || [];
  const breadcrumbPoints: Array<{ lng: number; lat: number; alt?: number | null; spd?: number | null }> = [];
  if (serverPoints.length >= 2) {
    for (const sp of serverPoints) {
      breadcrumbPoints.push({
        lng: sp.longitude,
        lat: sp.latitude,
        alt: sp.altitude_ft,
        spd: sp.groundspeed_kts,
      });
    }
  } else if (historyPts.length >= 2) {
    for (const hp of historyPts) {
      breadcrumbPoints.push({
        lng: hp.lng,
        lat: hp.lat,
        alt: hp.alt,
        spd: hp.spd,
      });
    }
  } else if (serverPoints.length === 1) {
    breadcrumbPoints.push({
      lng: serverPoints[0].longitude,
      lat: serverPoints[0].latitude,
      alt: serverPoints[0].altitude_ft,
      spd: serverPoints[0].groundspeed_kts,
    });
  } else if (historyPts.length === 1) {
    breadcrumbPoints.push({
      lng: historyPts[0].lng,
      lat: historyPts[0].lat,
      alt: historyPts[0].alt,
      spd: historyPts[0].spd,
    });
  }

  // Append breadcrumb points with deduplication
  for (const bp of breadcrumbPoints) {
    if (
      rawCoords.length === 0 ||
      Math.abs(bp.lng - rawCoords[rawCoords.length - 1][0]) > 0.0001 ||
      Math.abs(bp.lat - rawCoords[rawCoords.length - 1][1]) > 0.0001
    ) {
      rawCoords.push([bp.lng, bp.lat]);
      waypoints.push({
        longitude: bp.lng,
        latitude: bp.lat,
        altitude_ft: bp.alt ?? curAlt,
        groundspeed_kts: bp.spd ?? curSpd,
      });
    }
  }

  // 3. Ensure the current aircraft position is the exact end of the trajectory
  if (
    rawCoords.length === 0 ||
    Math.abs(curLng - rawCoords[rawCoords.length - 1][0]) > 0.0001 ||
    Math.abs(curLat - rawCoords[rawCoords.length - 1][1]) > 0.0001
  ) {
    rawCoords.push([curLng, curLat]);
    waypoints.push({
      longitude: curLng,
      latitude: curLat,
      altitude_ft: curAlt,
      groundspeed_kts: curSpd,
    });
  }

  // 4. Strict check: If we only have 1 single coordinate (current position alone, no departure & no breadcrumbs),
  // do not fabricate a path.
  if (rawCoords.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  // 5. Configured maximum viewport boundary clipping
  const maxBox: [number, number, number, number] = [
    maxViewportBounds[0][0], // minLng
    maxViewportBounds[0][1], // minLat
    maxViewportBounds[1][0], // maxLng
    maxViewportBounds[1][1], // maxLat
  ];

  const clippedCoords = clipTrajectoryToMaxViewport(rawCoords, maxBox);

  if (clippedCoords.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  const features: GeoJSON.Feature[] = [];

  features.push({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: clippedCoords,
    },
    properties: {
      id: "trajectory-line",
      isLine: true,
    },
  });

  // Waypoints within configured maximum boundary
  const recentWaypoints = waypoints.slice(-30);
  recentWaypoints.forEach((wp, idx) => {
    if (isPointInsideBox(wp.longitude, wp.latitude, maxBox)) {
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
  // Cached server radar breadcrumbs: icao24 -> trajectory response
  const trajectoryServerCacheRef = useRef<Record<string, FlightTrajectoryResponse>>({});
  const trajectoryReqIdRef = useRef<number>(0);
  const airportCoordsCacheRef = useRef<Record<string, [number, number]>>({});

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
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    syncViewportRef.current = syncViewport;
  }, [syncViewport]);

  useEffect(() => {
    onSelectFlightRef.current = onSelectFlight;
  }, [onSelectFlight]);

  // Synchronously and immediately clear the trajectory GeoJSON source
  const clearTrajectory = useCallback((mapInstance?: MapLibreMap | null) => {
    const map = mapInstance || mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource("trajectory") as GeoJSONSource;
    if (source) {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, []);

  const clearTrajectoryRef = useRef(clearTrajectory);
  useEffect(() => {
    clearTrajectoryRef.current = clearTrajectory;
  }, [clearTrajectory]);

  // Instant Trajectory Rendering Engine (Synchronous 0ms updates with boundary clipping)
  const renderInstantTrajectory = useCallback(
    (
      targetFlight: NormalizedFlight | null,
      serverTrajectory?: FlightTrajectoryResponse | null
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

      const geojson = buildTrajectoryGeoJSON(
        targetFlight,
        flightHistoryRef.current[targetFlight.id] || [],
        serverTrajectory,
        airportsRef.current,
        NEPAL_MAX_BOUNDS,
        airportCoordsCacheRef.current
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
    selectedFlightIdRef.current = selectedFlightId;
    const map = mapInstanceRef.current;
    if (map && map.isStyleLoaded()) {
      const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
      if (aircraftSource) {
        aircraftSource.setData(flightsToGeoJSON(flightsRef.current, selectedFlightId));
      }
    }
    if (!selectedFlightId) {
      trajectoryReqIdRef.current += 1;
      clearTrajectory();
    }
  }, [selectedFlightId, clearTrajectory]);

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

      // 3. Airports & Heliports GeoJSON
      const airportFeatures: GeoJSON.Feature[] = (airportList || [])
        .filter((apt) => apt.latitude_deg && apt.longitude_deg)
        .map((apt) => {
          const isHeliport =
            apt.type === "heliport" ||
            (Boolean(apt.ident) && apt.ident.toUpperCase().startsWith("VNH")) ||
            (Boolean(apt.name) && apt.name.toLowerCase().includes("heliport"));
          return {
            type: "Feature",
            properties: {
              ident: apt.ident,
              name: apt.name,
              iata: apt.iata_code || "",
              elevation: apt.elevation_ft || 0,
              municipality: apt.municipality || "Nepal",
              isMajor: MAJOR_AIRPORTS.has(apt.ident),
              isHeliport,
              facilityType: isHeliport ? "Heliport" : "Airport",
            },
            geometry: {
              type: "Point",
              coordinates: [apt.longitude_deg, apt.latitude_deg],
            },
          };
        });

      const airportsGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: airportFeatures,
      };

      if (map.getSource("airports")) {
        (map.getSource("airports") as GeoJSONSource).setData(airportsGeoJSON);
        if (map.getLayer("airports-circle")) {
          map.setPaintProperty("airports-circle", "circle-color", [
            "case",
            ["boolean", ["get", "isHeliport"], false],
            "#ffffff",
            "#10b981",
          ]);
          map.setPaintProperty("airports-circle", "circle-stroke-color", "rgba(0, 0, 0, 0.85)");
          map.setPaintProperty("airports-circle", "circle-stroke-width", 1.5);
          map.setPaintProperty("airports-circle", "circle-opacity", 0.95);
        }
        if (map.getLayer("airports-labels")) {
          map.setPaintProperty("airports-labels", "text-color", [
            "case",
            ["boolean", ["get", "isHeliport"], false],
            "#ffffff",
            "#10b981",
          ]);
        }
      } else {
        try {
          map.addSource("airports", {
            type: "geojson",
            data: airportsGeoJSON,
          });

          // Airports & Heliports circles (Airports = green, Heliports = white)
          map.addLayer({
            id: "airports-circle",
            type: "circle",
            source: "airports",
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                4.0,
                8,
                5.5,
                11,
                7.5,
              ],
              "circle-color": [
                "case",
                ["boolean", ["get", "isHeliport"], false],
                "#ffffff",
                "#10b981",
              ],
              "circle-stroke-color": "rgba(0, 0, 0, 0.85)",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.95,
            },
          });

          // Airport & Heliport Ident/IATA labels for closer zoom
          map.addLayer({
            id: "airports-labels",
            type: "symbol",
            source: "airports",
            minzoom: 8.0,
            layout: {
              "text-field": [
                "case",
                ["!=", ["get", "iata"], ""],
                ["get", "iata"],
                ["get", "ident"],
              ],
              "text-font": ["Noto Sans Bold"],
              "text-size": 10,
              "text-offset": [0, 1.15],
              "text-anchor": "top",
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": [
                "case",
                ["boolean", ["get", "isHeliport"], false],
                "#ffffff",
                "#10b981",
              ],
              "text-halo-color": "rgba(0, 0, 0, 0.95)",
              "text-halo-width": 2,
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
          const cached = trajectoryServerCacheRef.current[sel.identification.icao24];
          renderInstantTrajectoryRef.current?.(sel, cached);
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
        // Toggle/Deselect if clicking currently selected aircraft
        if (clickedId === selectedFlightIdRef.current) {
          selectedFlightIdRef.current = null;
          trajectoryReqIdRef.current += 1;
          clearTrajectoryRef.current?.(map);
          const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
          if (aircraftSource) {
            aircraftSource.setData(flightsToGeoJSON(flightsRef.current, null));
          }
          onSelectFlightRef.current?.(null);
          return;
        }

        // New flight selected: immediately clear previous aircraft's trace (0ms) and invalidate pending requests
        trajectoryReqIdRef.current += 1;
        clearTrajectoryRef.current?.(map);
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

    // Click handler for airport & heliport selection on Nepal map
    const handleAirportClick = (e: any) => {
      if (!e.features || e.features.length === 0) return;
      featureClickedInThisCycle = true;
      const clickedIdent = e.features[0].properties?.ident;
      if (clickedIdent) {
        if (popupRef.current) {
          popupRef.current.remove();
        }
        // Deselect flight and select airport
        selectedFlightIdRef.current = null;
        trajectoryReqIdRef.current += 1;
        clearTrajectoryRef.current?.(map);
        const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
        if (aircraftSource) {
          aircraftSource.setData(flightsToGeoJSON(flightsRef.current, null));
        }
        onSelectFlightRef.current?.(null);
        onSelectAirportRef.current?.(clickedIdent);
      }
    };

    map.on("click", "airports-circle", handleAirportClick);
    map.on("click", "airports-labels", handleAirportClick);

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
      const airportLayers = ["airports-circle", "airports-labels"].filter((l) =>
        Boolean(mapInstanceRef.current?.getLayer(l))
      );
      const airportHits = mapInstanceRef.current.queryRenderedFeatures(bbox, {
        layers: airportLayers,
      });
      if (aircraftHits.length === 0 && airportHits.length === 0) {
        selectedFlightIdRef.current = null;
        trajectoryReqIdRef.current += 1;
        clearTrajectoryRef.current?.(mapInstanceRef.current);
        const aircraftSource = mapInstanceRef.current.getSource("aircraft") as GeoJSONSource;
        if (aircraftSource) {
          aircraftSource.setData(flightsToGeoJSON(flightsRef.current, null));
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

    // Airport & Heliport Hover Tooltip
    popupRef.current = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: "avionics-map-popup",
    });

    const handleAirportHover = (e: any) => {
      map.getCanvas().style.cursor = "pointer";
      if (!e.features || e.features.length === 0 || !popupRef.current) return;
      const f = e.features[0];
      const geom = f.geometry as GeoJSON.Point;
      const coords = geom.coordinates.slice() as [number, number];
      const p = f.properties || {};
      const isHeliport = Boolean(p.isHeliport);

      popupRef.current
        .setLngLat(coords)
        .setHTML(`
          <div class="p-1 font-sans text-xs cursor-pointer select-none" id="popup-airport-${p.ident}">
            <div class="font-bold text-neutral-100 flex items-center gap-1.5">
              <span class="inline-block w-2.5 h-2.5 rounded-full ${isHeliport ? "bg-white border border-neutral-300" : "bg-emerald-400 border border-emerald-300"}"></span>
              <span>${p.name}</span>
              <span class="${isHeliport ? "text-neutral-200" : "text-emerald-400"} font-mono font-bold">(${p.ident}${p.iata ? ` / ${p.iata}` : ""})</span>
            </div>
            <div class="text-neutral-300 mt-1 font-mono text-[11px] flex items-center gap-1.5">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${isHeliport ? "bg-white/15 text-white border border-white/30" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"}">
                ${isHeliport ? "Heliport" : "Airport"}
              </span>
              <span>Elev: ${p.elevation ? `${p.elevation.toLocaleString()} ft` : "N/A"} • ${p.municipality || "Nepal"}</span>
            </div>
            <div class="text-[10px] ${isHeliport ? "text-neutral-300" : "text-emerald-400"} font-sans font-semibold mt-1.5 flex items-center gap-1">
              <span>Click to view ${isHeliport ? "heliport" : "airport"} details</span>
              <span>→</span>
            </div>
          </div>
        `)
        .addTo(map);

      const popupEl = document.getElementById(`popup-airport-${p.ident}`);
      if (popupEl) {
        popupEl.onclick = () => {
          if (popupRef.current) popupRef.current.remove();
          selectedFlightIdRef.current = null;
          trajectoryReqIdRef.current += 1;
          clearTrajectoryRef.current?.(map);
          const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
          if (aircraftSource) {
            aircraftSource.setData(flightsToGeoJSON(flightsRef.current, null));
          }
          onSelectFlightRef.current?.(null);
          onSelectAirportRef.current?.(p.ident);
        };
      }
    };

    const handleAirportLeave = () => {
      map.getCanvas().style.cursor = "";
      if (popupRef.current) {
        popupRef.current.remove();
      }
    };

    map.on("mouseenter", "airports-circle", handleAirportHover);
    map.on("mouseenter", "airports-labels", handleAirportHover);
    map.on("mouseleave", "airports-circle", handleAirportLeave);
    map.on("mouseleave", "airports-labels", handleAirportLeave);

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
      trajectoryReqIdRef.current += 1;
      clearTrajectory(map);
      return;
    }

    const selectedFlight = flightsRef.current.find((f) => f.id === selectedFlightId);
    if (!selectedFlight) {
      trajectoryReqIdRef.current += 1;
      clearTrajectory(map);
      return;
    }

    const targetIcao = selectedFlight.identification.icao24;
    const cached = trajectoryServerCacheRef.current[targetIcao];
    const reqId = ++trajectoryReqIdRef.current;
    let isCancelled = false;

    // Render instant boundary-aware trajectory immediately (0ms synchronous render)
    renderInstantTrajectory(selectedFlight, cached);

    // If departure airport coords not in memory yet, dynamically resolve via /airports/{ident}
    const origKey = (
      selectedFlight.route?.origin_icao ||
      selectedFlight.route?.origin_iata ||
      cached?.origin_icao ||
      cached?.origin_iata ||
      ""
    ).trim().toUpperCase();

    if (
      origKey &&
      !airportCoordsCacheRef.current[origKey] &&
      !selectedFlight.route?.origin_latitude &&
      !cached?.origin_latitude
    ) {
      fetchAirportDetail(origKey)
        .then((apt) => {
          if (isCancelled || reqId !== trajectoryReqIdRef.current) return;
          if (apt && apt.longitude_deg != null && apt.latitude_deg != null) {
            airportCoordsCacheRef.current[origKey] = [apt.longitude_deg, apt.latitude_deg];
            if (selectedFlightIdRef.current === selectedFlight.id) {
              renderInstantTrajectory(selectedFlight, trajectoryServerCacheRef.current[targetIcao]);
            }
          }
        })
        .catch(() => {});
    }

    // Fetch full trajectory trail from backend in background to enhance precision
    fetchFlightTrajectory(targetIcao)
      .then((res) => {
        if (isCancelled || reqId !== trajectoryReqIdRef.current) return;
        if (selectedFlightIdRef.current !== selectedFlight.id) return;
        if (res) {
          trajectoryServerCacheRef.current[targetIcao] = res;
        }
        renderInstantTrajectory(selectedFlight, res || cached);
      })
      .catch((err) => {
        if (isCancelled || reqId !== trajectoryReqIdRef.current) return;
        if (selectedFlightIdRef.current !== selectedFlight.id) return;
        console.warn(`Could not fetch trajectory for ${targetIcao}:`, err);
        renderInstantTrajectory(selectedFlight, cached);
      });

    return () => {
      isCancelled = true;
      if (selectedFlightIdRef.current !== selectedFlight.id) {
        clearTrajectory(mapInstanceRef.current);
      }
    };
  }, [selectedFlightId, renderInstantTrajectory, clearTrajectory]);

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

