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
import { Layers, Compass, Scan, PanelLeftOpen } from "lucide-react";

// Register MapLibre Web Worker from local public bundle (solves Next.js Turbopack missing vector tiles)
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}


interface FlightMapProps {
  flights: NormalizedFlight[];
  airports: AirportSummary[];
  selectedFlightId: string | null;
  onSelectFlight: (flight: NormalizedFlight | null) => void;
  onBoundsChange?: (bounds: { lamin: number; lomin: number; lamax: number; lomax: number }) => void;
  syncViewport?: boolean;
  onToggleSyncViewport?: () => void;
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
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
const NEPAL_INITIAL_ZOOM = 6.48;
const MIN_ZOOM = 6.48; // Maximum zoom out point locked exactly to the blue dotted lines
const MAX_ZOOM = 15.0;

// Maximum geographical bounds for panning (strict containment to blue dotted FIR corridor)
const NEPAL_MAX_BOUNDS: [[number, number], [number, number]] = [
  [79.50, 25.50], // Southwest [lng, lat]
  [88.80, 30.95], // Northeast [lng, lat]
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
    { colorKey: "green", fill: "#22c55e", stroke: "#0f172a" },
    { colorKey: "yellow", fill: "#facc15", stroke: "#0f172a" },
    { colorKey: "selected", fill: "#ef4444", stroke: "#0f172a", isSelected: true },
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
  selectedFlightId: string | null,
  bounds?: { lamin: number; lomin: number; lamax: number; lomax: number } | null
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  flights.forEach((flight) => {
    const lat = flight.position.latitude;
    const lon = flight.position.longitude;
    if (lat === null || lon === null) return;

    // Strict viewport bounds filter - strictly only flights within visible map
    if (bounds) {
      if (
        lat < bounds.lamin ||
        lat > bounds.lamax ||
        lon < bounds.lomin ||
        lon > bounds.lomax
      ) {
        return;
      }
    }

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


export const FlightMap: React.FC<FlightMapProps> = ({
  flights,
  airports,
  selectedFlightId,
  onSelectFlight,
  onBoundsChange,
  syncViewport = true,
  onToggleSyncViewport,
  isSidebarOpen = true,
  onOpenSidebar,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const [activeTileStyle, setActiveTileStyle] = useState<TileStyle>("liberty");

  const popupRef = useRef<Popup | null>(null);
  const moveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSelectedFlightIdRef = useRef<string | null>(null);
  const minZoomRef = useRef<number>(MIN_ZOOM);

  const onBoundsChangeRef = useRef(onBoundsChange);
  const syncViewportRef = useRef(syncViewport);
  const onSelectFlightRef = useRef(onSelectFlight);
  const flightsRef = useRef(flights);
  const airportsRef = useRef(airports);
  const selectedFlightIdRef = useRef(selectedFlightId);

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

      // 2. Airspace boundary features removed as requested (clean map view)

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
                isDarkStyle ? "#94a3b8" : "#475569",
              ],
              "circle-stroke-color": isDarkStyle ? "#020617" : "#ffffff",
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
            filter: ["==", ["geometry-type"], "LineString"],
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
            filter: ["==", ["geometry-type"], "LineString"],
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
            filter: ["==", ["geometry-type"], "Point"],
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
      const bounds = map.getBounds();
      const currentBbox = {
        lamin: bounds.getSouth(),
        lomin: bounds.getWest(),
        lamax: bounds.getNorth(),
        lomax: bounds.getEast(),
      };
      const initialAircraftData = flightsToGeoJSON(
        flightsRef.current,
        selectedFlightIdRef.current,
        currentBbox
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
                ? "rgba(2, 6, 23, 0.95)"
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
                ? "rgba(2, 6, 23, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              "text-halo-width": 2.5,
              "text-halo-blur": 0.5,
            },
          });
        } catch (err) {
          console.error("Error adding aircraft layers:", err);
        }
      }

    },
    []
  );

  // Initialize MapLibre GL Map Instance (STRICTLY ONCE)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialStyleDef = OPENFREEMAP_STYLES.liberty;

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

    // Initial load handler
    map.on("load", () => {
      setupMapLayers(map, airportsRef.current, initialStyleDef.isDark);

      // Fit map camera EXACTLY to the FIR bounding box (0 padding)
      map.fitBounds(NEPAL_FIR_BOUNDS, {
        padding: 0,
        duration: 0,
      });

      const fitZoom = Math.round(map.getZoom() * 100) / 100;
      map.setMinZoom(fitZoom);
      minZoomRef.current = fitZoom;

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

    // Re-fit on container resize (e.g. sidebar toggle)
    map.on("resize", () => {
      const baseZoom = minZoomRef.current || MIN_ZOOM;
      if (map.getZoom() <= baseZoom + 0.1) {
        map.fitBounds(NEPAL_FIR_BOUNDS, { padding: 0, duration: 0 });
        const fitZoom = Math.round(map.getZoom() * 100) / 100;
        map.setMinZoom(fitZoom);
        minZoomRef.current = fitZoom;
      }
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
            selectedFlightIdRef.current,
            nextBounds
          );
          aircraftSource.setData(updatedGeoJSON);
        }
      }, 350);
    };

    map.on("moveend", handleMoveEnd);

    // Click handler for aircraft selection via GPU hit detection
    map.on("click", "aircraft-icons", (e) => {
      if (!e.features || e.features.length === 0) return;
      const clickedId = e.features[0].properties?.id;
      if (clickedId) {
        const flight = flightsRef.current.find((f) => f.id === clickedId) || null;
        onSelectFlightRef.current?.(flight);
      }
    });

    // Deselect aircraft on empty map background click
    map.on("click", (e) => {
      if (!mapInstanceRef.current) return;
      const aircraftHits = mapInstanceRef.current.queryRenderedFeatures(e.point, {
        layers: ["aircraft-icons"],
      });
      if (aircraftHits.length === 0) {
        onSelectFlightRef.current?.(null);
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
          <div class="p-1 font-sans text-xs">
            <div class="font-bold text-slate-100 flex items-center gap-1">
              <span>${p.name}</span>
              <span class="text-emerald-400 font-mono font-bold">(${p.ident}${p.iata ? ` / ${p.iata}` : ""})</span>
            </div>
            <div class="text-slate-400 mt-1 font-mono text-[11px]">
              Elev: ${p.elevation ? `${p.elevation.toLocaleString()} ft` : "N/A"} • ${p.municipality || "Nepal"}
            </div>
          </div>
        `)
        .addTo(map);
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

  // Update Aircraft GeoJSON Source data when flights polling updates (ZERO MAP RESET)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const aircraftSource = map.getSource("aircraft") as GeoJSONSource;
    if (!aircraftSource) return;

    const b = map.getBounds();
    const currentBounds = {
      lamin: b.getSouth(),
      lomin: b.getWest(),
      lamax: b.getNorth(),
      lomax: b.getEast(),
    };

    const nextGeoJSON = flightsToGeoJSON(flights, selectedFlightId, currentBounds);
    aircraftSource.setData(nextGeoJSON);
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

  // Handle Basemap Style Switching
  const cycleTileLayer = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const styles: TileStyle[] = ["liberty", "dark", "positron", "bright"];
    const currentIndex = styles.indexOf(activeTileStyle);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    setActiveTileStyle(nextStyle);

    map.setStyle(OPENFREEMAP_STYLES[nextStyle].url);
    map.once("style.load", () => {
      setupMapLayers(map, airportsRef.current, OPENFREEMAP_STYLES[nextStyle].isDark);
    });
  };

  // Reset to exact FIR Airspace View
  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.fitBounds(NEPAL_FIR_BOUNDS, {
      padding: 0,
      duration: 600,
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

  // Option 1: Live Flight Trajectory & Breadcrumbs trail manager
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
    let isCancelled = false;

    const renderTrajectoryFeatures = (
      points: { latitude: number; longitude: number; altitude_ft?: number | null; groundspeed_kts?: number | null }[]
    ) => {
      const currentMap = mapInstanceRef.current;
      if (!currentMap || !currentMap.isStyleLoaded()) return;
      const source = currentMap.getSource("trajectory") as GeoJSONSource;
      if (!source) return;

      const coords: [number, number][] = points.map((p) => [p.longitude, p.latitude]);

      // Connect to latest real-time aircraft coordinate if available
      if (
        selectedFlight.position.latitude !== null &&
        selectedFlight.position.longitude !== null
      ) {
        const curLng = selectedFlight.position.longitude;
        const curLat = selectedFlight.position.latitude;
        if (
          coords.length === 0 ||
          Math.abs(coords[coords.length - 1][0] - curLng) > 0.0001 ||
          Math.abs(coords[coords.length - 1][1] - curLat) > 0.0001
        ) {
          coords.push([curLng, curLat]);
        }
      }

      const features: GeoJSON.Feature[] = [];

      // LineString path
      if (coords.length >= 2) {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
          properties: {
            id: "trajectory-line",
          },
        });
      }

      // Breadcrumb dots
      const recentPts = points.slice(-30);
      recentPts.forEach((pt, idx) => {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [pt.longitude, pt.latitude],
          },
          properties: {
            id: `traj-pt-${idx}`,
            alt: pt.altitude_ft,
            spd: pt.groundspeed_kts,
          },
        });
      });

      source.setData({
        type: "FeatureCollection",
        features,
      });
    };

    // Draw initial point immediately
    if (selectedFlight.position.latitude !== null && selectedFlight.position.longitude !== null) {
      renderTrajectoryFeatures([
        {
          latitude: selectedFlight.position.latitude,
          longitude: selectedFlight.position.longitude,
          altitude_ft:
            selectedFlight.position.altitude_baro_ft ??
            (selectedFlight.position.altitude_baro_m != null
              ? Math.round(selectedFlight.position.altitude_baro_m * 3.28084)
              : null),
          groundspeed_kts:
            selectedFlight.position.groundspeed_kts ??
            (selectedFlight.position.groundspeed_mps != null
              ? Math.round(selectedFlight.position.groundspeed_mps * 1.94384)
              : null),
        },
      ]);
    }

    // Fetch full trajectory trail from backend
    fetchFlightTrajectory(targetIcao)
      .then((res) => {
        if (isCancelled) return;
        renderTrajectoryFeatures(res.points || []);
      })
      .catch((err) => {
        console.warn(`Could not fetch trajectory for ${targetIcao}:`, err);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedFlightId, flights]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      {/* MapLibre WebGL DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
        {/* Open Sidebar Menu Toggle (Appears smoothly when sidebar is closed) */}
        {!isSidebarOpen && onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md transition-colors cursor-pointer"
            title="Open Navigation Menu"
          >
            <PanelLeftOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Menu</span>
          </button>
        )}

        {/* OpenFreeMap Style Switcher */}
        <button
          onClick={cycleTileLayer}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md transition-colors cursor-pointer"
          title="Switch OpenFreeMap style (Liberty, Dark, Positron, Bright)"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>{OPENFREEMAP_STYLES[activeTileStyle].name}</span>
        </button>

        {/* Center Nepal Reset */}
        <button
          onClick={handleResetView}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md transition-colors cursor-pointer"
          title="Reset map view to Nepal"
        >
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span>Center Nepal</span>
        </button>

        {/* Viewport Sync Toggle */}
        {onToggleSyncViewport && (
          <button
            onClick={onToggleSyncViewport}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-xl backdrop-blur-md transition-colors cursor-pointer ${
              syncViewport
                ? "bg-cyan-950/80 hover:bg-cyan-900/80 border-cyan-500/60 text-cyan-300"
                : "bg-slate-900/95 hover:bg-slate-800 border-slate-700 text-slate-400"
            }`}
            title={syncViewport ? "Dynamic viewport bounds active (updates as you pan/zoom)" : "Locked to Nepal FIR"}
          >
            <Scan className="w-3.5 h-3.5 text-cyan-400" />
            <span>{syncViewport ? "Viewport Bounds ON" : "Lock FIR"}</span>
          </button>
        )}
      </div>

      {/* Streamlined Minimal Floating Legend */}
      <div className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center space-x-3 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[10px] text-slate-300 shadow-lg backdrop-blur-md pointer-events-none">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="font-semibold text-emerald-400">9N (Nepal)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/50" />
          <span className="font-semibold text-yellow-300">Other / Transit</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
          <span className="font-semibold text-red-400">Selected & Trail</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full border border-slate-300 bg-slate-700" />
          <span>Airports</span>
        </div>
      </div>
    </div>
  );
};

export default FlightMap;

