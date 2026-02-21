import { getPool } from "../db/pool";
import {
  getTreasuryBalances,
  getActiveLiabilities,
  logMonitorEvent,
  TreasuryBalance,
  TreasuryLiability,
} from "../db/queries";
import { sendTreasuryAlert } from "../notifier/notifier";

// ─── Config ─────────────────────────────────────────────────────────────────

/**
 * Minimum balance (in stroops) before an alert is fired.
 * Defaults to 5_000_000 stroops (0.5 XLM equivalent).
 * Override via TREASURY_ALERT_THRESHOLD env var.
 */
const ALERT_THRESHOLD = parseInt(
  process.env.TREASURY_ALERT_THRESHOLD || "5000000",
  10,
);

/**
 * How often the monitor cycle runs (milliseconds).
 * Defaults to 60 000 ms (1 minute).
 */
const POLL_INTERVAL_MS = parseInt(
  process.env.MONITOR_INTERVAL_MS || "60000",
  10,
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmployerTreasuryStatus {
  employer: string;
  balance: number; // stroops
  liabilities: number; // stroops
  runway_days: number | null; // null = unlimited (no active streams)
  alert_sent: boolean;
}

// ─── Core logic ──────────────────────────────────────────────────────────────

/**
 * Calculates the runway in days for a given employer.
 *
 * Runway = balance / daily burn rate
 *
 * Daily burn rate is approximated as:
 *   totalLiabilities / avgStreamDurationDays
 *
 * For simplicity (without per-stream duration data readily available here),
 * we use a safe conservative formula:
 *   daily burn = liabilities / 30   (assumes avg 30-day stream)
 *
 * This is overridable via MONITOR_BURN_WINDOW_DAYS env var.
 */
const BURN_WINDOW_DAYS = parseInt(
  process.env.MONITOR_BURN_WINDOW_DAYS || "30",
  10,
);

export const calculateRunwayDays = (
  balance: number,
  liabilities: number,
): number | null => {
  if (liabilities <= 0) return null; // no active streams → unlimited runway
  const dailyBurn = liabilities / BURN_WINDOW_DAYS;
  if (dailyBurn <= 0) return null;
  return balance / dailyBurn;
};

/**
 * Queries the DB for all employer treasury balances and liabilities,
 * merges them, and returns a status snapshot per employer.
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

  return Array.from(employers).map((employer) => {
    const balance = balanceMap.get(employer) ?? 0;
    const liab = liabilityMap.get(employer) ?? 0;
    const runway_days = calculateRunwayDays(balance, liab);
    return {
      employer,
      balance,
      liabilities: liab,
      runway_days,
      alert_sent: false,
    };
  });
};

/**
 * Runs one monitoring cycle:
 * 1. Fetches and computes treasury status for all employers.
 * 2. Logs every entry to treasury_monitor_log.
 * 3. Sends an alert when balance < ALERT_THRESHOLD.
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
    const alertNeeded = status.balance < ALERT_THRESHOLD;

    // Fire alert first so we can mark it before logging
    if (alertNeeded) {
      console.warn(
        `[Monitor] ⚠️  Employer ${status.employer} has low balance: ` +
          `${status.balance} stroops (threshold: ${ALERT_THRESHOLD}), ` +
          `runway: ${status.runway_days?.toFixed(1) ?? "∞"} days`,
      );
      try {
        await sendTreasuryAlert(
          status.employer,
          status.balance,
          status.liabilities,
          status.runway_days,
          ALERT_THRESHOLD,
        );
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
      `threshold: ${ALERT_THRESHOLD} stroops)`,
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
