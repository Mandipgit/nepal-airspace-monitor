"use client";

import { useState, useEffect } from "react";
import { AirportSummary } from "@/types/airport";
import { fetchNepalAirports } from "@/lib/api";
import { getUserFriendlyErrorMessage } from "@/lib/errors";

export function useAirports() {
  const [airports, setAirports] = useState<AirportSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAirports() {
      try {
        const response = await fetchNepalAirports();
        if (isMounted) {
          setAirports(response.airports || []);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = getUserFriendlyErrorMessage(err, "airports");
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAirports();

    return () => {
      isMounted = false;
    };
  }, []);

  return { airports, loading, error };
}
