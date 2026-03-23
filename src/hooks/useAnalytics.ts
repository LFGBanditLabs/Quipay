import { useState, useEffect } from "react";

const API_BASE = "http://localhost:3001";

export interface TrendPoint {
  bucket: string;
  volume: string;
  stream_count: number;
  withdrawal_count: number;
}

export interface AnalyticsData {
  trends: TrendPoint[];
  loading: boolean;
  error: string | null;
}

export function useAnalytics(address?: string): AnalyticsData {
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);

        let url = `${API_BASE}/analytics/trends?granularity=daily`;
        if (address) {
          url += `&address=${address}`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch analytics: ${res.statusText}`);
        }

        const json = await res.json();
        if (json.ok) {
          setTrends(json.data);
        } else {
          throw new Error(json.error || "Unknown error fetching analytics");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    void fetchAnalytics();
  }, [address]);

  return { trends, loading, error };
}
