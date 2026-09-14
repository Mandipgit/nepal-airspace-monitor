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
import { Layers, Compass, Scan } from "lucide-react";

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

/**
 * Generate 64x64 Retina canvas icons for aircraft symbol layer
 */
function registerAircraftIcons(map: MapLibreMap) {
  const iconDefs: {
    id: string;
    color: string;
    stroke: string;
    isStale?: boolean;
    isSelected?: boolean;
  }[] = [
    { id: "plane-nepal", color: "#10b981", stroke: "#020617" }, // Emerald 9N
    { id: "plane-intl", color: "#0284c7", stroke: "#020617" }, // Sky Blue Intl
    { id: "plane-mlat", color: "#f59e0b", stroke: "#020617" }, // High-vis Amber MLAT
    { id: "plane-ground", color: "#64748b", stroke: "#020617" }, // Slate Ground
    { id: "plane-selected", color: "#00f0ff", stroke: "#ffffff", isSelected: true }, // Cyan Selected
    { id: "plane-stale", color: "#f59e0b", stroke: "#f59e0b", isStale: true }, // Hollow Stale
  ];

  iconDefs.forEach(({ id, color, stroke, isStale, isSelected }) => {
    if (map.hasImage(id)) return;
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = size / 2;
    const cy = size / 2;

    // Glowing selection halo
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 240, 255, 0.35)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#00f0ff";
      ctx.stroke();
    }

    // Aircraft Silhouette (Pointing UP = 0 deg heading)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.4, 1.4);

    const ox = -12;
    const oy = -12;
    ctx.beginPath();
    ctx.moveTo(12 + ox, 2 + oy);
    ctx.lineTo(10 + ox, 8 + oy);
    ctx.lineTo(3 + ox, 11 + oy);
    ctx.lineTo(3 + ox, 13 + oy);
    ctx.lineTo(10 + ox, 12 + oy);
    ctx.lineTo(10 + ox, 18 + oy);
    ctx.lineTo(7 + ox, 20 + oy);
    ctx.lineTo(7 + ox, 22 + oy);
    ctx.lineTo(12 + ox, 21 + oy);
    ctx.lineTo(17 + ox, 22 + oy);
    ctx.lineTo(17 + ox, 20 + oy);
    ctx.lineTo(14 + ox, 18 + oy);
    ctx.lineTo(14 + ox, 12 + oy);
    ctx.lineTo(21 + ox, 13 + oy);
    ctx.lineTo(21 + ox, 11 + oy);
    ctx.lineTo(14 + ox, 8 + oy);
    ctx.closePath();

    if (!isStale) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.lineWidth = isStale ? 2.5 : 1.8;
    ctx.strokeStyle = isStale ? color : stroke;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.restore();

    const imgData = ctx.getImageData(0, 0, size, size);
    map.addImage(id, imgData, { pixelRatio: 2 });
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
    const isNepal = flight.identification.is_nepal_registered;
    const onGround = flight.position.on_ground;
    const isMlat = flight.identification.position_source?.toUpperCase().includes("MLAT") || false;
    const freshnessSec = flight.data_freshness_seconds ?? null;
    const isStale = freshnessSec !== null && freshnessSec > 25;

    let iconId = "plane-intl";
    if (isNepal) iconId = "plane-nepal";
    if (isMlat) iconId = isNepal ? "plane-nepal" : "plane-mlat";
    if (onGround) iconId = "plane-ground";
    if (isStale) iconId = "plane-stale";
    if (isSelected) iconId = "plane-selected";

    const callsign = flight.identification.callsign || flight.identification.icao24.toUpperCase();
    const altFt = flight.position.altitude_baro_ft ?? 0;
    const spdKts = flight.position.ground_speed_kts ?? 0;
    const fl = Math.round(altFt / 100);

    // Multi-tier labels for progressive disclosure
    const labelCallsign = callsign;
    const labelFL = `${callsign}\nFL${fl}`;
    const labelFull = `${callsign}\n${Math.round(altFt).toLocaleString()} ft • ${Math.round(spdKts)} kts`;

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
        isNepal,
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
                0.55,
                7,
                0.75,
                10,
                0.95,
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
                ["==", ["get", "isNepal"], true],
                isDarkStyle ? "#34d399" : "#065f46",
                isDarkStyle ? "#e2e8f0" : "#0f172a",
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
              "text-color": isDarkStyle ? "#00f0ff" : "#0284c7",
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
      maxBoundsViscosity: 1.0, // 100% rigid boundary - cannot scroll or drag outside bounds
      attributionControl: false,
    });

    // Navigation Controls (Zoom & Compass)
    map.addControl(
      new NavigationControl({
        showCompass: true,
        showZoom: true,
      }),
      "top-right"
    );

    // Pan locking manager:
    // At minimum zoom (maximum zoom out framed to blue dotted FIR box), lock dragging completely.
    // When user zooms in, enable dragging/panning within NEPAL_MAX_BOUNDS.
    const updatePanLock = () => {
      if (!map) return;
      const currentZoom = map.getZoom();
      const lockThreshold = (minZoomRef.current || MIN_ZOOM) + 0.08;
      if (currentZoom <= lockThreshold) {
        if (map.dragPan.isEnabled()) {
          map.dragPan.disable();
        }
      } else {
        if (!map.dragPan.isEnabled()) {
          map.dragPan.enable();
        }
      }
    };

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
      updatePanLock();

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

    // Update pan lock dynamically on zoom changes
    map.on("zoom", updatePanLock);

    // Re-frame exactly to FIR bounds when zooming all the way back out
    map.on("zoomend", () => {
      const baseZoom = minZoomRef.current || MIN_ZOOM;
      if (map.getZoom() <= baseZoom + 0.08) {
        map.fitBounds(NEPAL_FIR_BOUNDS, { padding: 0, duration: 250 });
        updatePanLock();
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
        updatePanLock();
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
      duration: 800,
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

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      {/* MapLibre WebGL DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
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
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Nepal (9N)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>Regional</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>MLAT</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full border border-emerald-400 bg-slate-800" />
          <span>Airports</span>
        </div>
      </div>
    </div>
  );
};

export default FlightMap;
