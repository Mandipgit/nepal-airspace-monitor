"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NormalizedFlight, FlightCollectionResponse } from "@/types/flight";
import { fetchLiveFlights, FetchLiveFlightsOptions } from "@/lib/api";
import { getUserFriendlyErrorMessage } from "@/lib/errors";

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
  const activeRequestSeqRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Client-side cache for instant mode toggling between Nepal Corridors and All Traffic
  const modeCacheRef = useRef<{
    nepal?: FlightCollectionResponse;
    all?: FlightCollectionResponse;
  }>({});

  const loadFlights = useCallback(
    async (isManual: boolean = false) => {
      // Abort previous in-flight request to prevent race conditions and stale overwrites
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestSeq = ++activeRequestSeqRef.current;

      const now = Date.now();
      if (isManual) {
        // Prevent accidental rapid-click flooding
        if (now - lastFetchTimeRef.current < 800) {
          return;
        }
        setRefreshing(true);
      }
      lastFetchTimeRef.current = now;

      // Instant optimistic display from client cache if available for current mode
      const isNepalMode = options.nepalContextOnly !== false;
      const cachedResponse = isNepalMode ? modeCacheRef.current.nepal : modeCacheRef.current.all;
      if (cachedResponse && cachedResponse.flights?.length) {
        setData(cachedResponse);
        setFlights(cachedResponse.flights);
        setLoading(false);
      }

      try {
        const response = await fetchLiveFlights(options, controller.signal);
        // If this request was superseded by a newer one or unmounted, discard it
        if (!isMountedRef.current || requestSeq !== activeRequestSeqRef.current) {
          return;
        }

        // Cache the latest response for the active mode
        if (isNepalMode) {
          modeCacheRef.current.nepal = response;
        } else {
          modeCacheRef.current.all = response;
        }

        setData(response);
        setFlights(response.flights || []);
        setError(null);
        setLastUpdated(new Date());
        setCountdown(Math.round(pollIntervalMs / 1000));
      } catch (err: unknown) {
        if (!isMountedRef.current || requestSeq !== activeRequestSeqRef.current) {
          return;
        }
        // Ignore aborted fetches triggered by mode toggles
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const msg = getUserFriendlyErrorMessage(err, "live_flights");
        setError(msg);
      } finally {
        if (isMountedRef.current && requestSeq === activeRequestSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      options.nepalOnly,
      options.nepalContextOnly,
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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
