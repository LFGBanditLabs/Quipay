import axios from "axios";

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";

export interface TreasuryAlertPayload {
  event: "treasury_low_balance";
  employer: string;
  balance: number;
  liabilities: number;
  runway_days: number | null;
  threshold: number;
  timestamp: string;
}

/**
 * Sends a treasury low-balance alert to the configured ALERT_WEBHOOK_URL.
 * Silently no-ops when the env var is not set (useful in tests / local dev).
 */
export const sendTreasuryAlert = async (
  employer: string,
  balance: number,
  liabilities: number,
  runwayDays: number | null,
  threshold: number,
): Promise<void> => {
  if (!ALERT_WEBHOOK_URL) {
    console.warn(
      `[Notifier] ⚠️  ALERT_WEBHOOK_URL not set — skipping alert for employer ${employer}`,
    );
    return;
  }

  const payload: TreasuryAlertPayload = {
    event: "treasury_low_balance",
    employer,
    balance,
    liabilities,
    runway_days: runwayDays,
    threshold,
    timestamp: new Date().toISOString(),
  };

  try {
    await axios.post(ALERT_WEBHOOK_URL, payload, { timeout: 5_000 });
    console.log(
      `[Notifier] 🚨 Alert sent for employer ${employer} — balance ${balance}, runway ${runwayDays?.toFixed(1) ?? "∞"} days`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Notifier] ❌ Failed to send alert for ${employer}: ${msg}`);
  }
};
