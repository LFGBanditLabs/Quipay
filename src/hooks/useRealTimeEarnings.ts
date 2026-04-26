import { useState, useEffect } from "react";
import { WorkerStream } from "./useStreams";

/** Earnings snapshot for a single stream at the current tick. */
export interface StreamEarning {
  /** On-chain stream ID. */
  id: string;
  /** Display name for the stream's employer. */
  name: string;
  /** Total amount earned so far in token units, capped at `totalAmount`. */
  earned: number;
  /** Flow rate in token units per second. */
  flowRate: number;
  /** Token symbol, e.g. `"USDC"`. */
  symbol: string;
}

/** Aggregate earnings data returned by {@link useRealTimeEarnings}. */
export interface EarningsBreakdown {
  /** Sum of earned amounts across all streams in token units. */
  totalEarned: number;
  /** Per-stream breakdown of earnings. */
  streamEarned: StreamEarning[];
  /** Combined flow rate of all still-active streams in token units per hour. */
  hourlyRate: number;
  /** Combined flow rate of all still-active streams in token units per day. */
  dailyRate: number;
  /** Projected additional earnings over the next hour at the current flow rate. */
  projectedOneHour: number;
  /** Projected additional earnings over the next 24 hours at the current flow rate. */
  projectedTwentyFourHours: number;
  /** Number of streams that have not yet reached their `totalAmount`. */
  activeStreamsCount: number;
}

/**
 * Calculates real-time earnings from an array of worker streams.
 *
 * Recalculates on a fixed interval using wall-clock elapsed time and each
 * stream's `flowRate`. Earnings are capped at `totalAmount` for streams that
 * have fully vested. Only streams that have not yet reached their cap
 * contribute to the projected rates.
 *
 * @param streams - Array of resolved worker streams from {@link useStreams}.
 * @param refreshInterval - Tick interval in milliseconds. Defaults to `100`.
 * @returns Live {@link EarningsBreakdown} updated every `refreshInterval` ms.
 *
 * @example
 * ```tsx
 * const earnings = useRealTimeEarnings(streams, 100);
 * console.log(earnings.totalEarned); // e.g. 12.3456
 * ```
 */
export const useRealTimeEarnings = (
  streams: WorkerStream[],
  refreshInterval: number = 100,
) => {
  const [earnings, setEarnings] = useState<EarningsBreakdown>({
    totalEarned: 0,
    streamEarned: [],
    hourlyRate: 0,
    dailyRate: 0,
    projectedOneHour: 0,
    projectedTwentyFourHours: 0,
    activeStreamsCount: 0,
  });

  useEffect(() => {
    if (streams.length === 0) {
      setTimeout(() => {
        setEarnings({
          totalEarned: 0,
          streamEarned: [],
          hourlyRate: 0,
          dailyRate: 0,
          projectedOneHour: 0,
          projectedTwentyFourHours: 0,
          activeStreamsCount: 0,
        });
      }, 0);
      return;
    }

    const calculate = () => {
      const now = Date.now() / 1000;
      let total = 0;
      let totalFlowRate = 0;
      const breakdown: StreamEarning[] = [];

      streams.forEach((stream) => {
        const elapsed = Math.max(0, now - stream.startTime);
        const earned = Math.min(elapsed * stream.flowRate, stream.totalAmount);

        total += earned;

        // Only count active streams for projections (those that haven't reached their limit)
        if (earned < stream.totalAmount) {
          totalFlowRate += stream.flowRate;
        }

        breakdown.push({
          id: stream.id,
          name: stream.employerName,
          earned,
          flowRate: stream.flowRate,
          symbol: stream.tokenSymbol,
        });
      });

      const hourlyRate = totalFlowRate * 3600;
      const dailyRate = hourlyRate * 24;

      setEarnings({
        totalEarned: total,
        streamEarned: breakdown,
        hourlyRate,
        dailyRate,
        projectedOneHour: hourlyRate,
        projectedTwentyFourHours: dailyRate,
        activeStreamsCount: streams.filter((s) => {
          const elapsed = Math.max(0, now - s.startTime);
          return elapsed * s.flowRate < s.totalAmount;
        }).length,
      });
    };

    calculate();
    const interval = setInterval(calculate, refreshInterval);

    return () => clearInterval(interval);
  }, [streams, refreshInterval]);

  return earnings;
};
