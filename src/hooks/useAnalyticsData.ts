import { useEffect, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";
const REFRESH_MS = 60_000;

// ── Types matching backend responses ─────────────────────────────────────────

export interface VolumePoint {
  bucket: string;
  xlm_volume: string;
  usdc_volume: string;
  total_volume: string;
  stream_count: number;
}

export interface TopWorker {
  worker: string;
  total_earned: string;
  stream_count: number;
  last_withdrawal_at: string | null;
}

export interface StreamCreationPoint {
  bucket: string;
  streams_created: number;
}

export interface WithdrawalFrequencyPoint {
  bucket: string;
  withdrawal_count: number;
  total_withdrawn: string;
}

export interface OverallStats {
  total_streams: number;
  active_streams: number;
  completed_streams: number;
  cancelled_streams: number;
  total_volume: string;
  total_withdrawn: string;
}

export type Granularity = "daily" | "weekly";

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data as T;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface AnalyticsDashboardData {
  summary: OverallStats | null;
  volumeOverTime: VolumePoint[];
  topWorkers: TopWorker[];
  streamCreationRate: StreamCreationPoint[];
  withdrawalFrequency: WithdrawalFrequencyPoint[];
  granularity: Granularity;
  setGranularity: (g: Granularity) => void;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: Date;
  refreshIntervalMs: number;
  refresh: () => Promise<void>;
}

export function useAnalyticsData(): AnalyticsDashboardData {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [summary, setSummary] = useState<OverallStats | null>(null);
  const [volumeOverTime, setVolumeOverTime] = useState<VolumePoint[]>([]);
  const [topWorkers, setTopWorkers] = useState<TopWorker[]>([]);
  const [streamCreationRate, setStreamCreationRate] = useState<
    StreamCreationPoint[]
  >([]);
  const [withdrawalFrequency, setWithdrawalFrequency] = useState<
    WithdrawalFrequencyPoint[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const gran = granularity;
      const [sum, vol, workers, creation, withdrawals] = await Promise.all([
        fetchJson<OverallStats>("/analytics/summary"),
        fetchJson<VolumePoint[]>(
          `/analytics/volume-over-time?granularity=${gran}&days=30`,
        ),
        fetchJson<TopWorker[]>("/analytics/top-workers?limit=10"),
        fetchJson<StreamCreationPoint[]>(
          `/analytics/stream-creation-rate?granularity=${gran}&days=30`,
        ),
        fetchJson<WithdrawalFrequencyPoint[]>(
          `/analytics/withdrawal-frequency?granularity=${gran}&days=30`,
        ),
      ]);
      setSummary(sum);
      setVolumeOverTime(vol);
      setTopWorkers(workers);
      setStreamCreationRate(creation);
      setWithdrawalFrequency(withdrawals);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [granularity]);

  // Initial fetch + re-fetch when granularity changes
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // 60-second auto-refresh
  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchAll();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [fetchAll]);

  return {
    summary,
    volumeOverTime,
    topWorkers,
    streamCreationRate,
    withdrawalFrequency,
    granularity,
    setGranularity,
    loading,
    error,
    lastUpdatedAt,
    refreshIntervalMs: REFRESH_MS,
    refresh: fetchAll,
  };
}
