import { getPool } from "../db/pool";
import {
  getTreasuryBalances,
  getActiveLiabilities,
  logMonitorEvent,
  TreasuryBalance,
  TreasuryLiability,
  getStreamsByEmployer,
  StreamRecord,
} from "../db/queries";
import { sendTreasuryAlert } from "../notifier/notifier";

// ─── Config ─────────────────────────────────────────────────────────────────

/**
 * Minimum runway days before an alert is fired.
 * Defaults to 7 days.
 * Override via TREASURY_RUNWAY_ALERT_DAYS env var.
 */
const RUNWAY_ALERT_DAYS = parseInt(
  process.env.TREASURY_RUNWAY_ALERT_DAYS || "7",
  10,
);

/**
 * How often the monitor cycle runs (milliseconds).
 * Defaults to 300_000 ms (5 minutes).
 */
const POLL_INTERVAL_MS = parseInt(
  process.env.MONITOR_INTERVAL_MS || "300000",
  10,
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmployerTreasuryStatus {
  employer: string;
  balance: number; // stroops
  liabilities: number; // stroops
  daily_burn_rate: number; // stroops per day
  runway_days: number | null; // null = unlimited (no active streams)
  funds_exhaustion_date: string | null; // ISO date string
  alert_sent: boolean;
}

// ─── Core logic ──────────────────────────────────────────────────────────────

/**
 * Calculates the daily burn rate based on active streams.
 *
 * For each active stream, we calculate how much is being paid per day:
 *   daily_rate = remaining_amount / remaining_days
 *
 * Total burn rate = sum of all active stream daily rates
 *
 * @param streams Array of active streams with their details
 * @returns Daily burn rate in stroops
 */
export const calculateDailyBurnRate = (
  streams: Array<{
    total_amount: number;
    withdrawn_amount: number;
    start_ts: number;
    end_ts: number;
  }>,
): number => {
  const now = Math.floor(Date.now() / 1000); // current unix timestamp
  let totalDailyBurn = 0;

  for (const stream of streams) {
    const remaining = stream.total_amount - stream.withdrawn_amount;
    if (remaining <= 0) continue;

    const remainingSeconds = Math.max(0, stream.end_ts - now);
    if (remainingSeconds === 0) continue;

    const remainingDays = remainingSeconds / 86400; // seconds per day
    const dailyRate = remaining / remainingDays;
    totalDailyBurn += dailyRate;
  }

  return totalDailyBurn;
};

/**
 * Calculates the runway in days and funds exhaustion date.
 *
 * Runway = balance / daily burn rate
 * Exhaustion Date = current date + runway days
 */
export const calculateRunwayDays = (
  balance: number,
  dailyBurnRate: number,
): number | null => {
  if (dailyBurnRate <= 0) return null; // no active burn → unlimited runway
  return balance / dailyBurnRate;
};

export const calculateExhaustionDate = (
  runwayDays: number | null,
): string | null => {
  if (runwayDays === null) return null;
  const exhaustionDate = new Date();
  exhaustionDate.setDate(exhaustionDate.getDate() + runwayDays);
  return exhaustionDate.toISOString();
};

/**
 * Queries the DB for all employer treasury balances and active streams,
 * calculates accurate burn rates, and returns a status snapshot per employer.
 */
export const computeTreasuryStatus = async (): Promise<
  EmployerTreasuryStatus[]
> => {
  const [balances, liabilities] = await Promise.all([
    getTreasuryBalances(),
    getActiveLiabilities(),
  ]);

  // Build lookup maps
  const balanceMap = new Map<string, number>(
    balances.map((b: TreasuryBalance) => [b.employer, parseFloat(b.balance)]),
  );
  const liabilityMap = new Map<string, number>(
    liabilities.map((l: TreasuryLiability) => [
      l.employer,
      parseFloat(l.liabilities),
    ]),
  );

  // Union of all known employers
  const employers = new Set<string>([
    ...balanceMap.keys(),
    ...liabilityMap.keys(),
  ]);

  const statuses: EmployerTreasuryStatus[] = [];

  for (const employer of employers) {
    const balance = balanceMap.get(employer) ?? 0;
    const liab = liabilityMap.get(employer) ?? 0;

    // Fetch active streams for this employer to calculate accurate burn rate
    const activeStreams = await getStreamsByEmployer(employer, "active", 1000);

    const streamData = activeStreams.map((s: StreamRecord) => ({
      total_amount: parseFloat(s.total_amount),
      withdrawn_amount: parseFloat(s.withdrawn_amount),
      start_ts: s.start_ts,
      end_ts: s.end_ts,
    }));

    const daily_burn_rate = calculateDailyBurnRate(streamData);
    const runway_days = calculateRunwayDays(balance, daily_burn_rate);
    const funds_exhaustion_date = calculateExhaustionDate(runway_days);

    statuses.push({
      employer,
      balance,
      liabilities: liab,
      daily_burn_rate,
      runway_days,
      funds_exhaustion_date,
      alert_sent: false,
    });
  }

  return statuses;
};

/**
 * Runs one monitoring cycle:
 * 1. Fetches and computes treasury status for all employers.
 * 2. Logs every entry to treasury_monitor_log.
 * 3. Sends an alert when runway < RUNWAY_ALERT_DAYS.
 *
 * Returns the full status snapshot (useful for the API endpoint).
 */
export const runMonitorCycle = async (): Promise<EmployerTreasuryStatus[]> => {
  console.log("[Monitor] 🔍 Running treasury monitor cycle…");

  let statuses: EmployerTreasuryStatus[];

  try {
    statuses = await computeTreasuryStatus();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Monitor] Failed to compute treasury status: ${msg}`);
    return [];
  }

  if (statuses.length === 0) {
    console.log("[Monitor] ℹ️  No employer treasury data found.");
    return [];
  }

  for (const status of statuses) {
    // Alert when runway is less than threshold (default 7 days)
    const alertNeeded =
      status.runway_days !== null && status.runway_days < RUNWAY_ALERT_DAYS;

    // Fire alert first so we can mark it before logging
    if (alertNeeded) {
      console.warn(
        `[Monitor] ⚠️  Employer ${status.employer} has low runway: ` +
          `${status.runway_days?.toFixed(1)} days (threshold: ${RUNWAY_ALERT_DAYS} days), ` +
          `balance: ${status.balance} stroops, ` +
          `daily burn: ${status.daily_burn_rate.toFixed(2)} stroops/day, ` +
          `exhaustion date: ${status.funds_exhaustion_date}`,
      );
      try {
        await sendTreasuryAlert({
          employer: status.employer,
          balance: status.balance,
          liabilities: status.liabilities,
          dailyBurnRate: status.daily_burn_rate,
          runwayDays: status.runway_days,
          exhaustionDate: status.funds_exhaustion_date,
          alertThresholdDays: RUNWAY_ALERT_DAYS,
        });
        status.alert_sent = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[Monitor] Alert delivery failed for ${status.employer}: ${msg}`,
        );
      }
    }

    // Persist to DB regardless of alert status
    try {
      await logMonitorEvent({
        employer: status.employer,
        balance: status.balance,
        liabilities: status.liabilities,
        runwayDays: status.runway_days,
        alertSent: status.alert_sent,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[Monitor] Failed to log event for ${status.employer}: ${msg}`,
      );
    }
  }

  console.log(
    `[Monitor] ✅ Cycle complete — checked ${statuses.length} employer(s)`,
  );
  return statuses;
};

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Starts the periodic treasury monitoring loop.
 * No-ops gracefully when the DB is not configured.
 */
export const startMonitor = async (): Promise<void> => {
  if (!getPool()) {
    console.warn(
      "[Monitor] ⚠️  Database not configured — treasury monitor disabled.",
    );
    return;
  }

  console.log(
    `[Monitor] 🏦 Treasury monitor started (interval: ${POLL_INTERVAL_MS}ms, ` +
      `runway alert threshold: ${RUNWAY_ALERT_DAYS} days)`,
  );

  const tick = async () => {
    try {
      await runMonitorCycle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Monitor] Unhandled error in monitor cycle: ${msg}`);
    }
    setTimeout(tick, POLL_INTERVAL_MS);
  };

  await tick();
};
