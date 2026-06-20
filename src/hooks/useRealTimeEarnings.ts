import { useState, useEffect } from "react";
import { WorkerStream } from "./useStreams";

/** Earnings snapshot for a single stream at the current tick. */
export interface StreamEarning {
  /** On-chain stream ID. */
  id: string;
  /** Display name for the stream's employer. */
  name: string;
  /**
   * Amount vested so far in token units, capped at `totalAmount`.
   *
   * Vesting accrues from `startTime` and is independent of the cliff — it is
   * what the worker has *conceptually* earned, even while it is still locked.
   */
  vesting: number;
  /**
   * Amount the worker can actually withdraw right now in token units.
   *
   * Equal to `vesting` once the cliff has passed, and `0` before it. A
   * `cliffTime` of `0` means "no cliff", so `withdrawable === vesting` from
   * `startTime`.
   */
  withdrawable: number;
  /**
   * `true` when `withdrawable` is `0` *specifically because the cliff has not
   * been reached yet* (as opposed to nothing having accrued). Lets the UI
   * distinguish a cliff lock from an empty stream.
   */
  cliffLocked: boolean;
  /**
   * Whole seconds remaining until the cliff unlocks. `0` once unlocked (or when
   * there is no cliff). Recomputed every tick so a countdown stays live.
   */
  secondsUntilCliff: number;
  /** Flow rate in token units per second. */
  flowRate: number;
  /** Token symbol, e.g. `"USDC"`. */
  symbol: string;
}

/** Aggregate earnings data returned by {@link useRealTimeEarnings}. */
export interface EarningsBreakdown {
  /**
   * Sum of vested amounts across all streams in token units.
   *
   * @deprecated Prefer {@link EarningsBreakdown.totalVesting}. Retained as an
   * alias so existing consumers keep working; it always equals `totalVesting`.
   */
  totalEarned: number;
  /** Sum of vested amounts across all streams in token units. */
  totalVesting: number;
  /**
   * Sum of currently-withdrawable amounts across all streams in token units.
   *
   * Each stream is bucketed independently against its own cliff before being
   * summed, so a mix of locked and unlocked streams aggregates correctly.
   */
  totalWithdrawable: number;
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
 * Builds a fresh, zeroed {@link EarningsBreakdown}. Returns a new object (with a
 * new `streamEarned` array) on every call so callers can never mutate a shared
 * reference.
 */
const createEmptyBreakdown = (): EarningsBreakdown => ({
  totalEarned: 0,
  totalVesting: 0,
  totalWithdrawable: 0,
  streamEarned: [],
  hourlyRate: 0,
  dailyRate: 0,
  projectedOneHour: 0,
  projectedTwentyFourHours: 0,
  activeStreamsCount: 0,
});

/**
 * Computes the cliff-aware earnings snapshot for a single stream at time `now`.
 *
 * Vesting accrues from `startTime`; the cliff only gates *withdrawal*. The
 * withdrawal gate matches the on-chain `get_withdrawable` semantics used across
 * the worker UI (see `WithdrawPage.tsx` / `WorkerDashboard.tsx`): funds unlock
 * when `now >= cliffTime` (i.e. inclusive `>=`, not strict `>`). A `cliffTime`
 * of `0` means "no cliff", so funds are withdrawable from `startTime`.
 *
 * @param stream - The worker stream to evaluate.
 * @param now - Current time as a Unix timestamp in seconds.
 * @returns The per-stream {@link StreamEarning} snapshot.
 */
export const computeStreamEarning = (
  stream: WorkerStream,
  now: number,
): StreamEarning => {
  const elapsed = Math.max(0, now - stream.startTime);
  const vesting = Math.min(elapsed * stream.flowRate, stream.totalAmount);

  // cliffTime === 0 means "no cliff" → withdrawable from startTime.
  const cliffPassed = stream.cliffTime === 0 || now >= stream.cliffTime;
  const withdrawable = cliffPassed ? vesting : 0;

  // Locked *because of the cliff* — distinct from "nothing has accrued yet".
  const cliffLocked = !cliffPassed;
  const secondsUntilCliff = cliffPassed
    ? 0
    : Math.max(0, Math.ceil(stream.cliffTime - now));

  return {
    id: stream.id,
    name: stream.employerName,
    vesting,
    withdrawable,
    cliffLocked,
    secondsUntilCliff,
    flowRate: stream.flowRate,
    symbol: stream.tokenSymbol,
  };
};

/**
 * Builds the aggregate {@link EarningsBreakdown} from a set of streams at time
 * `now`. Each stream is bucketed against its own cliff (via
 * {@link computeStreamEarning}) before `vesting` and `withdrawable` are summed,
 * so a mix of locked and unlocked streams aggregates correctly.
 *
 * Pure and side-effect free — {@link useRealTimeEarnings} simply calls it on a
 * timer.
 *
 * @param streams - Worker streams to aggregate.
 * @param now - Current time as a Unix timestamp in seconds.
 * @returns The aggregated {@link EarningsBreakdown} snapshot.
 */
export const computeEarningsBreakdown = (
  streams: WorkerStream[],
  now: number,
): EarningsBreakdown => {
  if (streams.length === 0) return createEmptyBreakdown();

  let totalVesting = 0;
  let totalWithdrawable = 0;
  let totalFlowRate = 0;
  let activeStreamsCount = 0;
  const breakdown: StreamEarning[] = [];

  streams.forEach((stream) => {
    const earning = computeStreamEarning(stream, now);

    totalVesting += earning.vesting;
    totalWithdrawable += earning.withdrawable;

    // Only count active streams for projections (those that haven't reached
    // their limit). Projections track accrual, so they key off vesting.
    if (earning.vesting < stream.totalAmount) {
      totalFlowRate += stream.flowRate;
      activeStreamsCount += 1;
    }

    breakdown.push(earning);
  });

  const hourlyRate = totalFlowRate * 3600;
  const dailyRate = hourlyRate * 24;

  return {
    totalEarned: totalVesting,
    totalVesting,
    totalWithdrawable,
    streamEarned: breakdown,
    hourlyRate,
    dailyRate,
    projectedOneHour: hourlyRate,
    projectedTwentyFourHours: dailyRate,
    activeStreamsCount,
  };
};

/**
 * Calculates real-time earnings from an array of worker streams.
 *
 * Recalculates on a fixed interval using wall-clock elapsed time and each
 * stream's `flowRate`. For every stream it tracks two distinct values:
 *
 * - `vesting` — accrued from `startTime`, capped at `totalAmount`, ignoring the
 *   cliff. This is the amount conceptually earned.
 * - `withdrawable` — what the worker can actually claim now: equal to `vesting`
 *   once the stream's cliff has passed (`now >= cliffTime`, or `cliffTime === 0`
 *   meaning no cliff), otherwise `0`.
 *
 * Each stream is bucketed against its *own* cliff before the aggregate
 * `totalVesting` / `totalWithdrawable` are summed, so a mix of locked and
 * unlocked streams aggregates correctly. The cliff transition happens in
 * real time on the regular tick — `withdrawable` jumps from `0` to the full
 * vested amount the instant `now >= cliffTime`, no page refresh required.
 *
 * Only streams that have not yet reached their cap contribute to the projected
 * rates.
 *
 * @param streams - Array of resolved worker streams from {@link useStreams}.
 * @param refreshInterval - Tick interval in milliseconds. Defaults to `100`.
 * @returns Live {@link EarningsBreakdown} updated every `refreshInterval` ms.
 *
 * @example
 * ```tsx
 * const earnings = useRealTimeEarnings(streams, 100);
 * console.log(earnings.totalVesting);      // accrued, may still be locked
 * console.log(earnings.totalWithdrawable); // claimable right now
 * ```
 */
export const useRealTimeEarnings = (
  streams: WorkerStream[],
  refreshInterval: number = 100,
) => {
  const [earnings, setEarnings] =
    useState<EarningsBreakdown>(createEmptyBreakdown);

  useEffect(() => {
    if (streams.length === 0) {
      setTimeout(() => {
        setEarnings(createEmptyBreakdown());
      }, 0);
      return;
    }

    const calculate = () => {
      setEarnings(computeEarningsBreakdown(streams, Date.now() / 1000));
    };

    calculate();
    const interval = setInterval(calculate, refreshInterval);

    return () => clearInterval(interval);
  }, [streams, refreshInterval]);

  return earnings;
};
