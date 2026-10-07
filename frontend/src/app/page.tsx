"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/common/TopBar";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { FlightDetailsPanel } from "@/components/flight-details/FlightDetailsPanel";
import { AirportDetailsPanel } from "@/components/airport-details/AirportDetailsPanel";
import { FlightSearchDrawer } from "@/components/flight-list/FlightSearchDrawer";
import { BottomStatsSlider } from "@/components/stats/BottomStatsSlider";
import { DynamicFlightMap } from "@/components/map";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { useLiveFlights } from "@/hooks/useLiveFlights";
import { useAirports } from "@/hooks/useAirports";
import { NormalizedFlight } from "@/types/flight";
import { getUserFriendlyErrorMessage } from "@/lib/errors";
import { List } from "lucide-react";
import { Spinner } from "@heroui/react";

const DAILY_AEROAPI_QUOTA_SECONDS = 210; // 3.5 minutes allowed per 24 hours
const STORAGE_AEROAPI_REMAINING = "aerotrace_aeroapi_remaining_seconds";
const STORAGE_AEROAPI_RESET = "aerotrace_aeroapi_reset_timestamp";

function getInitialAeroApiQuota(): { remaining: number; resetTime: number } {
  if (typeof window === "undefined") {
    return { remaining: DAILY_AEROAPI_QUOTA_SECONDS, resetTime: Date.now() + 86400000 };
  }
  const now = Date.now();
  const savedReset = localStorage.getItem(STORAGE_AEROAPI_RESET);
  const savedRemaining = localStorage.getItem(STORAGE_AEROAPI_REMAINING);

  let resetTime = savedReset ? parseInt(savedReset, 10) : 0;
  if (!resetTime || isNaN(resetTime) || now >= resetTime) {
    resetTime = now + 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_AEROAPI_RESET, resetTime.toString());
    localStorage.setItem(STORAGE_AEROAPI_REMAINING, DAILY_AEROAPI_QUOTA_SECONDS.toString());
    return { remaining: DAILY_AEROAPI_QUOTA_SECONDS, resetTime };
  }

  const remaining = savedRemaining !== null ? parseInt(savedRemaining, 10) : DAILY_AEROAPI_QUOTA_SECONDS;
  return { remaining: isNaN(remaining) ? DAILY_AEROAPI_QUOTA_SECONDS : remaining, resetTime };
}

function formatResetCountdown(targetTimestamp: number): string {
  const diffMs = Math.max(0, targetTimestamp - Date.now());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${mins}m ${secs}s`;
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#000000] z-50 flex flex-col items-center justify-center gap-3 select-none">
        <Spinner size="lg" className="w-9 h-9 border-[#108AEF] border-t-transparent animate-spin" />
        <span className="text-xs font-sans font-medium text-neutral-400">
          Entering Radar Dashboard...
        </span>
      </div>
    );
  }

  return <DashboardView />;
}

function DashboardView() {
  const { isAuthenticated } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aerotrace_dark_mode");
      if (saved !== null) return saved === "true";
    }
    return true;
  });
  const [activeTileStyle, setActiveTileStyle] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const savedDark = localStorage.getItem("aerotrace_dark_mode");
      const savedStyle = localStorage.getItem("aerotrace_tile_style");
      if (savedDark === "false" && (!savedStyle || savedStyle === "dark")) return "bright";
      if (savedStyle) return savedStyle;
      if (savedDark === "false") return "bright";
    }
    return "dark";
  });
  const [syncViewport, setSyncViewport] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aerotrace_sync_viewport");
      if (saved !== null) return saved === "true";
    }
    return true;
  });
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Persist dashboard view states across page navigations and reloads
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aerotrace_dark_mode", String(isDarkMode));
    }
  }, [isDarkMode]);

  // Ensure root document strictly remains in dark mode so other pages are NEVER affected
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aerotrace_tile_style", activeTileStyle);
    }
  }, [activeTileStyle]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aerotrace_sync_viewport", String(syncViewport));
    }
  }, [syncViewport]);

  // Automatic App Drawer reveal when cursor touches the leftmost boundary of the entire screen
  // and smooth hide when mouse directs away into the map (> 275px)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 12) {
        setIsSidebarOpen(true);
      } else if (e.clientX > 275) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const [viewportBounds, setViewportBounds] = useState<{
    lamin?: number;
    lomin?: number;
    lamax?: number;
    lomax?: number;
  }>({});

  const [nepalContextOnly, setNepalContextOnly] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aerotrace_nepal_context");
      if (saved !== null) return saved === "true";
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aerotrace_nepal_context", String(nepalContextOnly));
    }
  }, [nepalContextOnly]);

  // FlightAware AeroAPI detailed mode management (3.5 min daily limit, strict mutual exclusion)
  const [isDetailedMode, setIsDetailedMode] = useState<boolean>(false);
  const [detailedRemainingSeconds, setDetailedRemainingSeconds] = useState<number>(() => {
    return getInitialAeroApiQuota().remaining;
  });
  const [detailedResetTimestamp, setDetailedResetTimestamp] = useState<number>(() => {
    return getInitialAeroApiQuota().resetTime;
  });
  const [detailedResetCountdown, setDetailedResetCountdown] = useState<string>("24h");

  // Keep 24-hour reset countdown fresh and automatically restore quota when 24h cycle elapses
  useEffect(() => {
    const updateResetInfo = () => {
      const now = Date.now();
      if (now >= detailedResetTimestamp) {
        const newReset = now + 24 * 60 * 60 * 1000;
        setDetailedResetTimestamp(newReset);
        setDetailedRemainingSeconds(DAILY_AEROAPI_QUOTA_SECONDS);
        localStorage.setItem(STORAGE_AEROAPI_RESET, newReset.toString());
        localStorage.setItem(STORAGE_AEROAPI_REMAINING, DAILY_AEROAPI_QUOTA_SECONDS.toString());
        setDetailedResetCountdown("24h");
      } else {
        setDetailedResetCountdown(formatResetCountdown(detailedResetTimestamp));
      }
    };

    updateResetInfo();
    const interval = setInterval(updateResetInfo, 10000);
    return () => clearInterval(interval);
  }, [detailedResetTimestamp]);

  // Second-by-second countdown while Detailed Mode is active; auto-reverts to OpenSky at 0
  useEffect(() => {
    if (!isDetailedMode) return;

    const timer = setInterval(() => {
      setDetailedRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsDetailedMode(false);
          localStorage.setItem(STORAGE_AEROAPI_REMAINING, "0");
          return 0;
        }
        localStorage.setItem(STORAGE_AEROAPI_REMAINING, next.toString());
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isDetailedMode]);

  // Turn off detailed mode when unmounting (e.g. navigating to other pages) to prevent background calls
  useEffect(() => {
    return () => {
      setIsDetailedMode(false);
    };
  }, []);

  const isDetailedQuotaExhausted = detailedRemainingSeconds <= 0;

  // Track if overall monthly AeroAPI quota is exhausted
  const [isAeroApiMonthlyExhausted, setIsAeroApiMonthlyExhausted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aerotrace_aeroapi_monthly_exceeded") === "true";
    }
    return false;
  });
  const [aeroApiNotice, setAeroApiNotice] = useState<string | null>(null);

  const handleToggleDetailedMode = useCallback(() => {
    if (isDetailedMode) {
      setIsDetailedMode(false);
      return;
    }
    if (isAeroApiMonthlyExhausted) {
      setAeroApiNotice(
        "FlightAware AeroAPI monthly usage quota has been exhausted. Live radar will remain on OpenSky Network."
      );
      return;
    }
    if (detailedRemainingSeconds <= 0) {
      return;
    }
    setIsDetailedMode(true);
  }, [isDetailedMode, isAeroApiMonthlyExhausted, detailedRemainingSeconds]);

  const {
    flights,
    loading,
    refreshing,
    error,
    stats,
    cacheAge,
    countdown,
    rateLimitRemaining,
    providerStatus,
    providerError,
    refetch,
  } = useLiveFlights({
    enriched: true,
    nepalContextOnly,
    provider: isDetailedMode ? "flightaware" : "opensky",
    // When in detailed mode, use fixed Nepal full bounds as requested ("with the viewport that we have set (maximum zoomed out state of the map)")
    ...(isDetailedMode
      ? { lamin: 25.80, lomin: 79.80, lamax: 30.65, lomax: 88.50 }
      : (syncViewport ? viewportBounds : {})),
  });

  // Automatically catch and warn if backend signals AeroAPI monthly quota exhaustion
  useEffect(() => {
    if (providerStatus === "quota_exceeded") {
      setIsAeroApiMonthlyExhausted(true);
      setIsDetailedMode(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("aerotrace_aeroapi_monthly_exceeded", "true");
      }
      setAeroApiNotice(
        providerError ||
          "FlightAware AeroAPI monthly quota has been reached. Live radar automatically switched back to OpenSky Network."
      );
    }
  }, [providerStatus, providerError]);

  // Automatically refetch live flights when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const { airports } = useAirports();

  const [selectedFlight, setSelectedFlight] = useState<NormalizedFlight | null>(null);
  const [selectedAirportIdent, setSelectedAirportIdent] = useState<string | null>(null);

  // Sync selected flight with live updates from polling
  useEffect(() => {
    if (selectedFlight) {
      const updated = flights.find((f) => f.id === selectedFlight.id);
      if (updated) {
        setSelectedFlight(updated);
      }
    }
  }, [flights, selectedFlight?.id]);

  const handleSelectFlight = useCallback((flight: NormalizedFlight | null) => {
    setSelectedFlight((prev) => {
      if (!flight || prev?.id === flight.id) {
        return null;
      }
      return flight;
    });
    if (flight) {
      setSelectedAirportIdent(null);
    }
  }, []);

  const handleSelectAirport = useCallback((ident: string | null, keepFlight: boolean = false) => {
    setSelectedAirportIdent((prev) => {
      if (!ident || prev === ident) {
        return null;
      }
      return ident;
    });
    if (ident && !keepFlight) {
      setSelectedFlight(null);
    }
  }, []);

  const handleBoundsChange = useCallback(
    (bounds: { lamin: number; lomin: number; lamax: number; lomax: number }) => {
      setViewportBounds((prev) => {
        if (
          prev.lamin !== undefined &&
          prev.lomin !== undefined &&
          prev.lamax !== undefined &&
          prev.lomax !== undefined &&
          Math.abs(prev.lamin - bounds.lamin) < 0.02 &&
          Math.abs(prev.lomin - bounds.lomin) < 0.02 &&
          Math.abs(prev.lamax - bounds.lamax) < 0.02 &&
          Math.abs(prev.lomax - bounds.lomax) < 0.02
        ) {
          return prev;
        }
        return bounds;
      });
    },
    []
  );

  const handleToggleSyncViewport = useCallback(() => {
    setSyncViewport((prev) => {
      const next = !prev;
      if (!next) {
        setViewportBounds({});
      }
      return next;
    });
  }, []);

  const handleCycleTileStyle = useCallback(() => {
    const styles = ["bright", "liberty", "positron"];
    setActiveTileStyle((prev) => {
      const idx = styles.indexOf(prev);
      const next = idx === -1 ? styles[0] : styles[(idx + 1) % styles.length];
      return next;
    });
    setIsDarkMode(false);
  }, []);

  const handleToggleDarkMode = useCallback((dark: boolean) => {
    setIsDarkMode(dark);
    setActiveTileStyle(dark ? "dark" : "bright");
  }, []);

  return (
    <div
      data-theme={isDarkMode ? "dark" : "light"}
      className={`flex flex-col h-screen w-screen overflow-hidden ${
        isDarkMode ? "dark" : "light"
      } bg-[var(--page-bg)] text-[var(--text-primary)] relative font-sans transition-colors duration-150 ease-out`}
    >
      {/* 1. Dedicated Top Navigation Bar Inspired by Reference Screenshot */}
      <TopBar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        mapStyle={activeTileStyle}
        onCycleMapStyle={handleCycleTileStyle}
        syncViewport={syncViewport}
        onToggleSyncViewport={handleToggleSyncViewport}
        nepalContextOnly={nepalContextOnly}
        onToggleNepalContext={() => setNepalContextOnly((prev) => !prev)}
        flights={flights}
        airports={airports}
        onSelectFlight={handleSelectFlight}
        onSelectAirport={(ident) => handleSelectAirport(ident, true)}
        onCenterFlight={(flt) => {
          if (typeof window !== "undefined") {
            const map = (window as unknown as { __map?: import("maplibre-gl").Map }).__map;
            if (map && flt.position.latitude && flt.position.longitude) {
              map.flyTo({
                center: [flt.position.longitude, flt.position.latitude],
                zoom: Math.max(map.getZoom(), 10),
                essential: true,
                duration: 1200,
              });
            }
          }
        }}
        onCenterAirport={(lat, lon) => {
          if (typeof window !== "undefined") {
            const map = (window as unknown as { __map?: import("maplibre-gl").Map }).__map;
            if (map && lat && lon) {
              map.flyTo({
                center: [lon, lat],
                zoom: Math.max(map.getZoom(), 11),
                essential: true,
                duration: 1200,
              });
            }
          }
        }}
      />

      {/* 2. Operations Workspace (Sidebar | Flight Details | Live Map) */}
      <div className="flex flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden relative">
        {/* Leftmost Screen Boundary Hover Trigger Strip (Active only when no details panel occupies the left edge) */}
        {!selectedFlight && !selectedAirportIdent && (
          <div
            onMouseEnter={() => setIsSidebarOpen(true)}
            className="fixed left-0 top-14 bottom-0 w-3.5 z-30 pointer-events-auto cursor-pointer"
            aria-hidden="true"
          />
        )}

        {/* Left Application Sidebar / App Drawer */}
        <AppSidebar
          isOpen={isSidebarOpen}
          onOpen={() => setIsSidebarOpen(true)}
          onClose={() => setIsSidebarOpen(false)}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
          flightCount={flights.length}
          syncViewport={syncViewport}
          onToggleSyncViewport={handleToggleSyncViewport}
          activeNav={isSearchOpen ? "directory" : "dashboard"}
        />

        {/* Selected Aircraft / Flight Details Panel (Immediately next to sidebar) */}
        {selectedFlight && (
          <FlightDetailsPanel
            flight={selectedFlight}
            onClose={() => setSelectedFlight(null)}
            onSelectAirport={(ident) => handleSelectAirport(ident, true)}
            onCenterFlight={(flt) => {
              if (typeof window !== "undefined") {
                const map = (window as unknown as { __map?: import("maplibre-gl").Map }).__map;
                if (map && flt.position.latitude && flt.position.longitude) {
                  map.flyTo({
                    center: [flt.position.longitude, flt.position.latitude],
                    zoom: Math.max(map.getZoom(), 10),
                    essential: true,
                    duration: 1200,
                  });
                }
              }
            }}
            isSidebarOpen={isSidebarOpen}
          />
        )}

        {/* Selected Nepal Airport Details Panel (Immediately next to sidebar) */}
        {selectedAirportIdent && (
          <AirportDetailsPanel
            airportIdent={selectedAirportIdent}
            onClose={() => setSelectedAirportIdent(null)}
            onCenterAirport={(apt) => {
              if (typeof window !== "undefined") {
                const map = (window as unknown as { __map?: import("maplibre-gl").Map }).__map;
                if (map && apt.latitude_deg && apt.longitude_deg) {
                  map.flyTo({
                    center: [apt.longitude_deg, apt.latitude_deg],
                    zoom: Math.max(map.getZoom(), 11),
                    essential: true,
                    duration: 1200,
                  });
                }
              }
            }}
            isSidebarOpen={isSidebarOpen}
          />
        )}

        {/* Flight Explorer & Search Drawer (When requested via sidebar) */}
        {isSearchOpen && (
          <FlightSearchDrawer
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            flights={flights}
            selectedFlightId={selectedFlight?.id ?? null}
            onSelectFlight={(flight) => {
              setSelectedFlight(flight);
              setSelectedAirportIdent(null);
            }}
            loading={loading}
          />
        )}

        {/* Interactive Airspace Map (Primary visual surface) */}
        <main className="flex-1 min-w-0 h-full relative overflow-hidden">
          <DynamicFlightMap
            flights={flights}
            airports={airports}
            selectedFlightId={selectedFlight?.id ?? null}
            onSelectFlight={handleSelectFlight}
            selectedAirportIdent={selectedAirportIdent}
            onSelectAirport={handleSelectAirport}
            onBoundsChange={handleBoundsChange}
            syncViewport={syncViewport}
            onToggleSyncViewport={handleToggleSyncViewport}
            isSidebarOpen={isSidebarOpen}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
            activeTileStyle={activeTileStyle}
            onCycleTileStyle={handleCycleTileStyle}
          />

          {/* Bottom Right Telemetry Drawer / Slider */}
          <BottomStatsSlider
            totalFlights={stats.total}
            nepalFlights={stats.nepalRegistered}
            refreshing={refreshing}
            onRefresh={refetch}
            cacheAge={cacheAge}
            rateLimitRemaining={rateLimitRemaining}
            isDetailedMode={isDetailedMode}
            onToggleDetailedMode={handleToggleDetailedMode}
            detailedRemainingSeconds={detailedRemainingSeconds}
            detailedResetCountdown={detailedResetCountdown}
            isDetailedQuotaExhausted={isDetailedQuotaExhausted}
            isMonthlyQuotaExhausted={isAeroApiMonthlyExhausted}
            monthlyQuotaMessage={aeroApiNotice}
          />

          {/* AeroAPI Monthly Quota Exceeded Notice Banner */}
          {aeroApiNotice && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#160b0b]/95 px-4 py-2 rounded-full text-xs text-rose-300 flex items-center space-x-2.5 shadow-2xl backdrop-blur-xl border border-rose-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="font-medium">{aeroApiNotice}</span>
              <button
                onClick={() => setAeroApiNotice(null)}
                className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-[10px] font-semibold transition-colors cursor-pointer ml-1"
                aria-label="Dismiss notice"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Connection Notice Pill */}
          {error && !aeroApiNotice && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/95 px-3.5 py-1.5 rounded-full text-xs text-amber-300 flex items-center space-x-2.5 shadow-2xl backdrop-blur-xl border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Connection notice: {getUserFriendlyErrorMessage(error, "live_flights")}</span>
              <button
                onClick={() => refetch()}
                className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-[10px] font-semibold transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Mobile View Directory Toggle Button */}
          <div className="absolute bottom-4 left-4 z-20 md:hidden">
            <button
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs font-bold text-neutral-200 shadow-2xl cursor-pointer"
            >
              <List className="w-4 h-4 text-white" />
              <span>Flights ({flights.length})</span>
            </button>
          </div>
        </main>
      </div>

      {/* Global HeroUI Authentication Modal */}
      <AuthModal />
    </div>
  );
}
