"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NormalizedFlight, FlightCollectionResponse } from "@/types/flight";
import { fetchLiveFlights, FetchLiveFlightsOptions } from "@/lib/api";

const DEFAULT_POLL_INTERVAL = parseInt(
  process.env.NEXT_PUBLIC_FLIGHT_POLL_INTERVAL_MS || "10000",
  10
);

export function useLiveFlights(options: FetchLiveFlightsOptions = {}) {
  const [data, setData] = useState<FlightCollectionResponse | null>(null);
  const [flights, setFlights] = useState<NormalizedFlight[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(Math.round(DEFAULT_POLL_INTERVAL / 1000));

  const pollIntervalMs = DEFAULT_POLL_INTERVAL;
  const isMountedRef = useRef<boolean>(true);
  const lastFetchTimeRef = useRef<number>(0);

  const loadFlights = useCallback(
    async (isManual: boolean = false) => {
      // Debounce manual triggers to at least 2 seconds
      const now = Date.now();
      if (isManual && now - lastFetchTimeRef.current < 2000) {
        return;
      }
      lastFetchTimeRef.current = now;

      if (isManual) {
        setRefreshing(true);
      }

      try {
        const response = await fetchLiveFlights(options);
        if (!isMountedRef.current) return;

        setData(response);
        setFlights(response.flights || []);
        setError(null);
        setLastUpdated(new Date());
        setCountdown(Math.round(pollIntervalMs / 1000));
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const msg = err instanceof Error ? err.message : "Failed to load flights";
        setError(msg);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      options.nepalOnly,
      options.filterGround,
      options.source,
      options.enriched,
      options.lamin,
      options.lomin,
      options.lamax,
      options.lomax,
      pollIntervalMs,
    ]
  );

  // Initial load and periodic polling
  useEffect(() => {
    isMountedRef.current = true;
    loadFlights(false);

    const interval = setInterval(() => {
      loadFlights(false);
    }, pollIntervalMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [loadFlights, pollIntervalMs]);

  // Second-by-second countdown timer for UI freshness indicator
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : Math.round(pollIntervalMs / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [pollIntervalMs]);

  const nepalRegisteredCount = flights.filter(
    (f) => f.identification.is_nepal_registered
  ).length;

  return {
    flights,
    data,
    loading,
    refreshing,
    error,
    lastUpdated,
    cacheAge: data?.cache_age_seconds ?? null,
    rateLimitRemaining: data?.rate_limit_remaining ?? null,
    countdown,
    stats: {
      total: data?.total ?? flights.length,
      airborne: flights.filter((f) => !f.position.on_ground).length,
      ground: flights.filter((f) => f.position.on_ground).length,
      nepalRegistered: nepalRegisteredCount,
    },
    refetch: () => loadFlights(true),
  };
}
