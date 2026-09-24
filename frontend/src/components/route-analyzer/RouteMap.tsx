"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Map as MapLibreMap,
  Popup,
  NavigationControl,
  GeoJSONSource,
  setWorkerUrl,
  LngLatBounds,
} from "maplibre-gl";
import { AirportSummary } from "@/types/airport";
import { MousePointerClick, Maximize2, Compass, Layers } from "lucide-react";

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}

interface RouteMapProps {
  airports: AirportSummary[];
  departure: AirportSummary | null;
  destination: AirportSummary | null;
  isMapSelectMode: boolean;
  mapSelectionTarget: "departure" | "destination" | null;
  onAirportMapClick: (airport: AirportSummary) => void;
  onExitMapSelectMode: () => void;
}

const NEPAL_CENTER: [number, number] = [84.1240, 28.3949];
const NEPAL_INITIAL_ZOOM = 6.6;
const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

export const RouteMap: React.FC<RouteMapProps> = ({
  airports,
  departure,
  destination,
  isMapSelectMode,
  mapSelectionTarget,
  onAirportMapClick,
  onExitMapSelectMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);

  const isMapSelectModeRef = useRef(isMapSelectMode);
  const mapSelectionTargetRef = useRef(mapSelectionTarget);
  const onAirportMapClickRef = useRef(onAirportMapClick);

  useEffect(() => {
    isMapSelectModeRef.current = isMapSelectMode;
    mapSelectionTargetRef.current = mapSelectionTarget;
    onAirportMapClickRef.current = onAirportMapClick;
  }, [isMapSelectMode, mapSelectionTarget, onAirportMapClick]);

  // Setup / update Route line GeoJSON
  const updateRouteLine = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("route-line") as GeoJSONSource;
    if (!source) return;

    if (
      departure &&
      destination &&
      departure.longitude_deg &&
      departure.latitude_deg &&
      destination.longitude_deg &&
      destination.latitude_deg
    ) {
      const depCoord: [number, number] = [departure.longitude_deg, departure.latitude_deg];
      const destCoord: [number, number] = [destination.longitude_deg, destination.latitude_deg];

      const feature: GeoJSON.Feature = {
        type: "Feature",
        properties: {
          depIdent: departure.ident,
          destIdent: destination.ident,
        },
        geometry: {
          type: "LineString",
          coordinates: [depCoord, destCoord],
        },
      };

      source.setData({
        type: "FeatureCollection",
        features: [feature],
      });

      // Fit bounds to route
      const bounds = new LngLatBounds();
      bounds.extend(depCoord);
      bounds.extend(destCoord);
      map.fitBounds(bounds, {
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        maxZoom: 9.5,
        duration: 900,
      });
    } else {
      source.setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  }, [departure, destination]);

  // Setup / update Airport markers GeoJSON
  const updateAirportsLayer = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("airports-source") as GeoJSONSource;
    if (!source) return;

    const features: GeoJSON.Feature[] = airports
      .filter((a) => a.latitude_deg && a.longitude_deg)
      .map((a) => {
        const isDep = departure?.ident === a.ident;
        const isDest = destination?.ident === a.ident;
        let role = "neutral";
        if (isDep) role = "departure";
        if (isDest) role = "destination";

        return {
          type: "Feature",
          properties: {
            ident: a.ident,
            name: a.name,
            iata: a.iata_code || "",
            role,
            elevation: a.elevation_ft || 0,
            city: a.municipality || "Nepal",
            isSelected: isDep || isDest,
          },
          geometry: {
            type: "Point",
            coordinates: [a.longitude_deg, a.latitude_deg],
          },
        };
      });

    source.setData({
      type: "FeatureCollection",
      features,
    });
  }, [airports, departure, destination]);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE_DARK,
      center: NEPAL_CENTER,
      zoom: NEPAL_INITIAL_ZOOM,
      minZoom: 5.2,
      maxZoom: 14,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Controls
    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), "top-right");

    map.on("load", () => {
      // 1. Nepal boundary
      if (!map.getSource("nepal-boundary")) {
        map.addSource("nepal-boundary", {
          type: "geojson",
          data: "/nepal-boundary.geojson",
        });

        map.addLayer({
          id: "nepal-boundary-glow",
          type: "line",
          source: "nepal-boundary",
          paint: {
            "line-color": "#108AEF",
            "line-width": 3,
            "line-opacity": 0.25,
            "line-blur": 3,
          },
        });

        map.addLayer({
          id: "nepal-boundary-line",
          type: "line",
          source: "nepal-boundary",
          paint: {
            "line-color": "#ffffff",
            "line-width": 1.6,
            "line-opacity": 0.7,
          },
        });
      }

      // 2. Route line source & layers
      if (!map.getSource("route-line")) {
        map.addSource("route-line", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Route line glow
        map.addLayer({
          id: "route-line-glow",
          type: "line",
          source: "route-line",
          paint: {
            "line-color": "#108AEF",
            "line-width": 6,
            "line-opacity": 0.4,
            "line-blur": 4,
          },
        });

        // Crisp dashed aviation route line
        map.addLayer({
          id: "route-line-main",
          type: "line",
          source: "route-line",
          paint: {
            "line-color": "#38bdf8",
            "line-width": 2.5,
            "line-opacity": 0.95,
            "line-dasharray": [3, 2],
          },
        });
      }

      // 3. Airports source & layers
      if (!map.getSource("airports-source")) {
        map.addSource("airports-source", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Neutral airport dot
        map.addLayer({
          id: "airports-circles",
          type: "circle",
          source: "airports-source",
          paint: {
            "circle-radius": [
              "case",
              ["==", ["get", "isSelected"], true],
              7.5,
              4.5,
            ],
            "circle-color": [
              "match",
              ["get", "role"],
              "departure",
              "#108AEF",
              "destination",
              "#FB7185",
              "#71717A",
            ],
            "circle-stroke-width": [
              "case",
              ["==", ["get", "isSelected"], true],
              2.5,
              1.2,
            ],
            "circle-stroke-color": "#ffffff",
          },
        });

        // Airport Labels
        map.addLayer({
          id: "airports-labels",
          type: "symbol",
          source: "airports-source",
          layout: {
            "text-field": [
              "case",
              ["==", ["get", "isSelected"], true],
              ["concat", ["get", "ident"], " (", ["get", "role"], ")"],
              ["get", "ident"],
            ],
            "text-font": ["Noto Sans Bold"],
            "text-size": [
              "case",
              ["==", ["get", "isSelected"], true],
              12,
              10,
            ],
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-optional": true,
          },
          paint: {
            "text-color": [
              "match",
              ["get", "role"],
              "departure",
              "#38bdf8",
              "destination",
              "#f43f5e",
              "#A1A1AA",
            ],
            "text-halo-color": "rgba(0, 0, 0, 0.95)",
            "text-halo-width": 2,
          },
        });

        // Interactive Airport Click
        map.on("click", "airports-circles", (e) => {
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          const props = feat.properties as { ident: string };
          if (props?.ident) {
            const matched = airports.find((a) => a.ident === props.ident);
            if (matched) {
              onAirportMapClickRef.current(matched);
            }
          }
        });

        // Pointer cursor & tooltips
        map.on("mouseenter", "airports-circles", (e) => {
          map.getCanvas().style.cursor = "pointer";
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          const p = feat.properties as {
            ident: string;
            name: string;
            iata: string;
            city: string;
            elevation: number;
            role: string;
          };
          const coords = (feat.geometry as GeoJSON.Point).coordinates;

          const isSelecting = isMapSelectModeRef.current;
          const target = mapSelectionTargetRef.current;

          const actionPrompt = isSelecting
            ? `<div class="mt-1 text-[#108AEF] font-bold text-[10px]">👉 Click to select as ${target === "departure" ? "Departure" : "Destination"}</div>`
            : "";

          popupRef.current = new Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
          })
            .setLngLat(coords as [number, number])
            .setHTML(`
              <div class="text-xs p-1 select-none font-sans">
                <div class="font-bold text-white flex items-center space-x-1">
                  <span>${p.ident}</span>
                  ${p.iata ? `<span class="text-[#38bdf8] font-mono text-[10px]">(${p.iata})</span>` : ""}
                </div>
                <div class="text-[11px] text-neutral-300">${p.name}</div>
                <div class="text-[10px] text-neutral-400 mt-0.5">${p.city} • ${p.elevation} ft</div>
                ${actionPrompt}
              </div>
            `)
            .addTo(map);
        });

        map.on("mouseleave", "airports-circles", () => {
          map.getCanvas().style.cursor = "";
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
        });
      }

      // Initial data injection
      updateAirportsLayer();
      updateRouteLine();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update data layers whenever airports or route selection changes
  useEffect(() => {
    updateAirportsLayer();
  }, [updateAirportsLayer]);

  useEffect(() => {
    updateRouteLine();
  }, [updateRouteLine]);

  // Reset Viewport to whole Nepal
  const handleResetViewport = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({
      center: NEPAL_CENTER,
      zoom: NEPAL_INITIAL_ZOOM,
      duration: 800,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[360px] rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl bg-[#08080a]">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Mode Banner when "Select on Map" is active */}
      {isMapSelectMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-[#111113]/95 border border-[#108AEF] shadow-[0_4px_20px_rgba(16,138,239,0.4)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-[#108AEF] animate-pulse" />
          <span className="text-xs font-semibold text-white">
            Click any airport marker to set{" "}
            <strong className="text-[#38bdf8] uppercase">
              {mapSelectionTarget === "departure" ? "Departure" : "Destination"}
            </strong>
          </span>
          <button
            type="button"
            onClick={onExitMapSelectMode}
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/[0.10] hover:bg-white/[0.20] text-neutral-300 hover:text-white transition-colors cursor-pointer ml-1"
          >
            Done
          </button>
        </div>
      )}

      {/* Floating Bottom Reset View Button */}
      <div className="absolute bottom-3 right-3 z-10">
        <button
          type="button"
          onClick={handleResetViewport}
          className="p-2 rounded-xl bg-[#111113]/90 hover:bg-[#18181B] border border-white/[0.12] text-[#A1A1AA] hover:text-[#FAFAFA] shadow-lg transition-all duration-150 active:scale-[0.95] cursor-pointer"
          title="Reset map view to Nepal"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Left Legend */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center space-x-3 px-3 py-1.5 rounded-xl bg-[#111113]/90 border border-white/[0.08] text-[10px] text-[#A1A1AA] backdrop-blur-md select-none font-mono">
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-[#108AEF]" />
          <span>Departure</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-[#FB7185]" />
          <span>Destination</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-[#71717A]" />
          <span>Airports</span>
        </div>
      </div>
    </div>
  );
};
