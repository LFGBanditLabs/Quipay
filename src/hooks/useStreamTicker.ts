import { useState, useEffect, useRef, useCallback } from "react";
import { WorkerStream } from "./useStreams";

/** Stellar uses 7 decimal places (10^7 stroops = 1 token unit). */
const STROOPS_PER_UNIT = 1e7;

export interface StreamTickSnapshot {
  /** Stream ID */
  id: string;
  /** Employer display name */
  employerName: string;
  /** Token symbol (e.g. "USDC", "XLM") */
  tokenSymbol: string;
  /** Total amount earned so far (in token units, capped at totalAmount) */
  earned: number;
  /** Current flow rate in token units per second */
  flowRate: number;
  /** Total allocated amount in token units */
  totalAmount: number;
  /** Completion fraction in [0, 1] */
  progress: number;
  /** True when this stream has reached its total allocation */
  isComplete: boolean;
}

export interface StreamTickerResult {
  /** Per-stream snapshots, updated every tick */
  snapshots: StreamTickSnapshot[];
  /** Aggregate earned across all active streams (token units) */
  totalEarned: number;
  /** Combined flow rate of all non-complete streams (token units/sec) */
  totalFlowRate: number;
  /** Number of streams still actively accruing */
  activeCount: number;
  /** Whether the ticker is currently paused (tab hidden) */
  paused: boolean;
}

/**
 * Client-side real-time ticker for payroll streams.
 *
 * Recalculates earned amounts every `intervalMs` milliseconds using elapsed
 * wall-clock time and each stream's flow rate. Automatically pauses when the
 * browser tab is hidden (Page Visibility API) to avoid unnecessary CPU work and
 * resumes seamlessly when the tab becomes visible again.
 *
 * @param streams - Array of worker streams returned by `useStreams`.
 * @param intervalMs - Tick interval in milliseconds. Defaults to 100.
 * @returns Per-stream snapshots and aggregate totals, updated on every tick.
 *
 * @example
 * ```tsx
 * const { snapshots, totalEarned, paused } = useStreamTicker(streams);
 * ```
 */
export const useStreamTicker = (
  streams: WorkerStream[],
  intervalMs = 100,
): StreamTickerResult => {
  const [result, setResult] = useState<StreamTickerResult>({
    snapshots: [],
    totalEarned: 0,
    totalFlowRate: 0,
    activeCount: 0,
    paused: false,
  });

  const pausedRef = useRef(false);

  const compute = useCallback(() => {
    const nowSec = Date.now() / 1000;
    let totalEarned = 0;
    let totalFlowRate = 0;
    let activeCount = 0;

    const snapshots: StreamTickSnapshot[] = streams.map((stream) => {
      const flowRateUnits = Number(stream.flowRate);
      const totalAmountUnits = Number(stream.totalAmount);
      const elapsed = Math.max(0, nowSec - stream.startTime);
      const earned = Math.min(elapsed * flowRateUnits, totalAmountUnits);
      const isComplete = earned >= totalAmountUnits;
      const progress = totalAmountUnits > 0 ? earned / totalAmountUnits : 0;

      totalEarned += earned;

      if (!isComplete) {
        totalFlowRate += flowRateUnits;
        activeCount += 1;
      }

      return {
        id: stream.id,
        employerName: stream.employerName,
        tokenSymbol: stream.tokenSymbol,
        earned,
        flowRate: flowRateUnits,
        totalAmount: totalAmountUnits,
        progress,
        isComplete,
      };
    });

    setResult({
      snapshots,
      totalEarned,
      totalFlowRate,
      activeCount,
      paused: pausedRef.current,
    });
  }, [streams]);

  useEffect(() => {
    compute();

    if (streams.length === 0) return;

    const handleVisibilityChange = () => {
      pausedRef.current = document.hidden;
      if (!document.hidden) {
        compute();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const id = setInterval(() => {
      if (!pausedRef.current) {
        compute();
      }
    }, intervalMs);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [streams, intervalMs, compute]);

  return result;
};

/**
 * Formats a stream's earned amount as a human-readable string.
 *
 * @param earned - Raw earned amount in token units.
 * @param decimals - Number of decimal places to display. Defaults to 4.
 * @returns Formatted string, e.g. `"12.3456"`.
 */
export const formatEarned = (earned: number, decimals = 4): string =>
  earned.toFixed(decimals);

/**
 * Converts a per-second flow rate to a per-hour rate.
 *
 * @param flowRatePerSec - Flow rate in token units per second.
 * @returns Flow rate in token units per hour.
 */
export const flowRateToHourly = (flowRatePerSec: number): number =>
  flowRatePerSec * 3600;

/**
 * Converts a stroops-per-second value to token-units-per-second.
 *
 * @param stroopsPerSec - Flow rate expressed in stroops per second.
 * @returns Equivalent rate in token units per second.
 */
export const stroopsToUnitsPerSec = (stroopsPerSec: number): number =>
  stroopsPerSec / STROOPS_PER_UNIT;
