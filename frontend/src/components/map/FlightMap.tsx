"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { NormalizedFlight } from "@/types/flight";
import { AirportSummary } from "@/types/airport";
import { Layers, Compass, Scan } from "lucide-react";

interface FlightMapProps {
  flights: NormalizedFlight[];
  airports: AirportSummary[];
  selectedFlightId: string | null;
  onSelectFlight: (flight: NormalizedFlight | null) => void;
  onBoundsChange?: (bounds: { lamin: number; lomin: number; lamax: number; lomax: number }) => void;
  syncViewport?: boolean;
  onToggleSyncViewport?: () => void;
}

// Nepal Geographical Center & Bounds
const NEPAL_CENTER: [number, number] = [28.3949, 84.1240];

// Extended Nepal FIR Airspace Corridor (covers all arrival STARs and approaches)
const NEPAL_FIR_BBOX = {
  lamin: 25.80,
  lomin: 79.80,
  lamax: 30.65,
  lomax: 88.50,
};

// Nepal Sovereign Border Bounding Box
const NEPAL_SOVEREIGN_BBOX = {
  lamin: 26.34,
  lomin: 80.05,
  lamax: 30.45,
  lomax: 88.20,
};

type TileStyle = "dark" | "satellite" | "streets";

// SVG Plane Silhouette Icon Factory
function createAircraftDivIcon(
  heading: number,
  hasHeading: boolean,
  isNepal: boolean,
  onGround: boolean,
  isSelected: boolean,
  callsign: string,
  squawk: string | null,
  source: string | null
): L.DivIcon {
  const isMlat = source?.toUpperCase().includes("MLAT") || false;
  let fillColor = "#38bdf8"; // International / Default Sky Blue
  if (isNepal) {
    fillColor = "#10b981"; // Nepal Registered Emerald
  }
  if (isMlat) {
    fillColor = isNepal ? "#10b981" : "#f59e0b"; // High-vis Amber for MLAT
  }
  if (onGround) {
    fillColor = "#94a3b8"; // Ground Muted Slate
  }
  if (isSelected) {
    fillColor = "#00f0ff"; // Vibrant High-Vis Cyan
  }

  const haloHtml = isSelected
    ? '<div class="aircraft-selected-halo"></div>'
    : '';

  const labelHtml = `
    <div class="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-0.5 rounded bg-slate-950/90 border border-slate-700/80 text-[9px] font-mono-avionics ${
      isSelected ? "text-cyan-300 font-bold border-cyan-400" : "text-slate-300"
    } pointer-events-none shadow-md flex items-center space-x-1">
      <span>${callsign}</span>
      ${isMlat ? '<span class="text-amber-400 text-[8px] font-bold">MLAT</span>' : ''}
      ${squawk ? `<span class="text-cyan-400 text-[8px] ml-0.5">SQ:${squawk}</span>` : ""}
    </div>
  `;

  const html = `
    <div class="relative flex items-center justify-center w-10 h-10 aircraft-marker-container">
      ${haloHtml}
      <div class="aircraft-icon-svg" style="transform: rotate(${heading}deg); transform-origin: center center;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="${fillColor}" stroke="#0b0f19" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L10 8L3 11L3 13L10 12L10 18L7 20L7 22L12 21L17 22L17 20L14 18L14 12L21 13L21 11L14 8L12 2Z" />
        </svg>
      </div>
      ${labelHtml}
    </div>
  `;

  return L.DivIcon ? new L.DivIcon({
    className: "aircraft-div-icon",
    html: html,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  }) : (L.divIcon({
    className: "aircraft-div-icon",
    html: html,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  }));
}

// Major Nepal Airport Hubs to highlight
const MAJOR_AIRPORTS = new Set(["VNKT", "VNPK", "VNBW", "VNLK", "VNVT", "VNNG", "VNJS"]);

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
  const mapInstanceRef = useRef<L.Map | null>(null);
  const flightLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const airportLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const activeTileLayersRef = useRef<L.Layer[]>([]);
  const [activeTileStyle, setActiveTileStyle] = useState<TileStyle>("dark");
  const onBoundsChangeRef = useRef(onBoundsChange);
  const syncViewportRef = useRef(syncViewport);
  const onSelectFlightRef = useRef(onSelectFlight);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    syncViewportRef.current = syncViewport;
  }, [syncViewport]);

  useEffect(() => {
    onSelectFlightRef.current = onSelectFlight;
  }, [onSelectFlight]);

  // Helper to attach tile layers (completely free, zero watermark)
  const setMapTileStyle = (style: TileStyle, map: L.Map) => {
    activeTileLayersRef.current.forEach((layer) => {
      map.removeLayer(layer);
    });
    activeTileLayersRef.current = [];

    if (style === "dark") {
      // ESRI Dark Gray Canvas (Base + Reference Label Layer) - 100% free, NO watermark
      const base = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
          maxZoom: 16,
        }
      ).addTo(map);

      const reference = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "",
          maxZoom: 16,
          pane: "overlayPane",
        }
      ).addTo(map);

      activeTileLayersRef.current = [base, reference];
    } else if (style === "satellite") {
      // ESRI World Imagery (High-res satellite view of the Himalayas) - 100% free, NO watermark
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
          maxZoom: 18,
        }
      ).addTo(map);

      activeTileLayersRef.current = [sat];
    } else {
      // OpenStreetMap - 100% free, NO watermark
      const osm = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      activeTileLayersRef.current = [osm];
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: NEPAL_CENTER,
      zoom: 7,
      minZoom: 4,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: true,
    });

    // Zoom control at top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Initial Dark Radar Canvas (ESRI)
    setMapTileStyle("dark", map);

    // Outer: Extended Nepal FIR Airspace Corridor Rectangle
    L.rectangle(
      [
        [NEPAL_FIR_BBOX.lamin, NEPAL_FIR_BBOX.lomin],
        [NEPAL_FIR_BBOX.lamax, NEPAL_FIR_BBOX.lomax],
      ],
      {
        color: "#06b6d4",
        weight: 1.5,
        dashArray: "6, 8",
        fillColor: "#06b6d4",
        fillOpacity: 0.02,
      }
    ).addTo(map);

    // Inner: Nepal Sovereign Territorial Border Rectangle
    L.rectangle(
      [
        [NEPAL_SOVEREIGN_BBOX.lamin, NEPAL_SOVEREIGN_BBOX.lomin],
        [NEPAL_SOVEREIGN_BBOX.lamax, NEPAL_SOVEREIGN_BBOX.lomax],
      ],
      {
        color: "#10b981",
        weight: 1,
        dashArray: "3, 6",
        fillColor: "#10b981",
        fillOpacity: 0.015,
      }
    ).addTo(map);

    // Listen to map viewport changes (Pan/Zoom) to sync visible bounds
    let moveTimeout: NodeJS.Timeout | null = null;
    map.on("moveend", () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        if (syncViewportRef.current && onBoundsChangeRef.current) {
          const b = map.getBounds();
          onBoundsChangeRef.current({
            lamin: Math.round(b.getSouth() * 100) / 100,
            lomin: Math.round(b.getWest() * 100) / 100,
            lamax: Math.round(b.getNorth() * 100) / 100,
            lomax: Math.round(b.getEast() * 100) / 100,
          });
        }
      }, 500);
    });

    // Deselect aircraft when clicking on empty map background
    map.on("click", () => {
      onSelectFlightRef.current?.(null);
    });

    // Layer groups for markers
    airportLayerGroupRef.current = L.layerGroup().addTo(map);
    flightLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Tile Style Cycle
  const cycleTileLayer = () => {
    if (!mapInstanceRef.current) return;

    let nextStyle: TileStyle = "dark";
    if (activeTileStyle === "dark") nextStyle = "satellite";
    else if (activeTileStyle === "satellite") nextStyle = "streets";
    else nextStyle = "dark";

    setMapTileStyle(nextStyle, mapInstanceRef.current);
    setActiveTileStyle(nextStyle);
  };

  // Reset View to Nepal Center
  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(NEPAL_CENTER, 7, { duration: 1.2 });
      if (onBoundsChangeRef.current) {
        onBoundsChangeRef.current(NEPAL_FIR_BBOX);
      }
    }
  };

  // Render Airport Markers
  useEffect(() => {
    if (!airportLayerGroupRef.current || !mapInstanceRef.current) return;

    airportLayerGroupRef.current.clearLayers();

    airports.forEach((apt) => {
      const isMajor = MAJOR_AIRPORTS.has(apt.ident);
      const radius = isMajor ? 5 : 3;
      const color = isMajor ? "#10b981" : "#64748b";

      const marker = L.circleMarker([apt.latitude_deg, apt.longitude_deg], {
        radius: radius,
        fillColor: color,
        color: "#0f172a",
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.8,
      });

      const popupContent = `
        <div class="p-1 font-sans text-xs">
          <div class="font-bold text-slate-100 flex items-center gap-1">
            <span>${apt.name}</span>
            <span class="text-emerald-400 font-mono">(${apt.ident}${apt.iata_code ? ` / ${apt.iata_code}` : ""})</span>
          </div>
          <div class="text-slate-400 mt-1 font-mono">
            Elev: ${apt.elevation_ft ? `${apt.elevation_ft.toLocaleString()} ft` : "N/A"} • ${apt.municipality || "Nepal"}
          </div>
        </div>
      `;

      marker.bindTooltip(popupContent, {
        direction: "top",
        className: "glass-panel-subtle text-slate-100 border-slate-700 p-2 rounded-lg",
      });

      marker.addTo(airportLayerGroupRef.current!);
    });
  }, [airports]);

  // Render Aircraft Markers
  useEffect(() => {
    if (!flightLayerGroupRef.current || !mapInstanceRef.current) return;

    flightLayerGroupRef.current.clearLayers();

    flights.forEach((flight) => {
      const lat = flight.position.latitude;
      const lon = flight.position.longitude;
      if (lat === null || lon === null) return;

      const hasHeading = flight.position.heading_deg !== null;
      const heading = flight.position.heading_deg ?? 0;
      const isNepal = flight.identification.is_nepal_registered;
      const onGround = flight.position.on_ground;
      const isSelected = flight.id === selectedFlightId;
      const callsign = flight.identification.callsign || flight.identification.icao24.toUpperCase();
      const squawk = flight.identification.squawk || null;
      const source = flight.identification.position_source || null;

      const icon = createAircraftDivIcon(heading, hasHeading, isNepal, onGround, isSelected, callsign, squawk, source);

      const marker = L.marker([lat, lon], { icon: icon, zIndexOffset: isSelected ? 1000 : 100 });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectFlight(flight);
      });

      marker.addTo(flightLayerGroupRef.current!);
    });
  }, [flights, selectedFlightId, onSelectFlight]);

  // Pan to selected flight when selection changes
  useEffect(() => {
    if (!selectedFlightId || !mapInstanceRef.current) return;

    const selected = flights.find((f) => f.id === selectedFlightId);
    if (selected && selected.position.latitude !== null && selected.position.longitude !== null) {
      mapInstanceRef.current.flyTo(
        [selected.position.latitude, selected.position.longitude],
        Math.max(mapInstanceRef.current.getZoom(), 9),
        { duration: 1.2 }
      );
    }
  }, [selectedFlightId, flights]);

  const tileStyleLabel = {
    dark: "Dark Radar (ESRI)",
    satellite: "Satellite (Himalayas)",
    streets: "OpenStreetMap",
  }[activeTileStyle];

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
        {/* Layer Switcher */}
        <button
          onClick={cycleTileLayer}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md transition-colors cursor-pointer"
          title="Switch map basemap"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>{tileStyleLabel}</span>
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
            title={syncViewport ? "Dynamic viewport sync active (updates as you pan/zoom)" : "Locked to Nepal FIR"}
          >
            <Scan className="w-3.5 h-3.5 text-cyan-400" />
            <span>{syncViewport ? "Viewport Sync ON" : "Lock FIR"}</span>
          </button>
        )}
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center space-x-3 px-3 py-1.5 rounded-xl glass-panel-subtle text-[10px] text-slate-300">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
          <span>Nepal Registered (9N)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          <span>International / Regional</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
          <span>On Ground</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full border border-emerald-400 bg-emerald-950" />
          <span>Airports</span>
        </div>
      </div>
    </div>
  );
};

export default FlightMap;
