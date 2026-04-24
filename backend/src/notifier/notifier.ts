import axios from "axios";
import { createCircuitBreaker } from "../utils/circuitBreaker";
import { sendWebhookNotification } from "../delivery";

const notifierBreaker = createCircuitBreaker(axios.post, {
  name: "notifier_alerts",
  timeout: 5000,
});

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";
const ALERT_EMAIL_ENABLED = process.env.ALERT_EMAIL_ENABLED === "true";
const ALERT_SLACK_ENABLED = process.env.ALERT_SLACK_ENABLED === "true";

export interface TreasuryAlertPayload {
  event: "treasury_low_runway";
  employer: string;
  balance: number;
  liabilities: number;
  daily_burn_rate: number;
  runway_days: number | null;
  funds_exhaustion_date: string | null;
  alert_threshold_days: number;
  timestamp: string;
}

/**
 * Sends a treasury low-runway alert via multiple channels:
 * - Webhook (if ALERT_WEBHOOK_URL is set)
 * - Email (if ALERT_EMAIL_ENABLED is true)
 * - Slack (if ALERT_SLACK_ENABLED is true)
 */
export const sendTreasuryAlert = async (params: {
  employer: string;
  balance: number;
  liabilities: number;
  dailyBurnRate: number;
  runwayDays: number | null;
  exhaustionDate: string | null;
  alertThresholdDays: number;
}): Promise<void> => {
  const payload: TreasuryAlertPayload = {
    event: "treasury_low_runway",
    employer: params.employer,
    balance: params.balance,
    liabilities: params.liabilities,
    daily_burn_rate: params.dailyBurnRate,
    runway_days: params.runwayDays,
    funds_exhaustion_date: params.exhaustionDate,
    alert_threshold_days: params.alertThresholdDays,
    timestamp: new Date().toISOString(),
  };

  const promises: Promise<void>[] = [];

  // Send via webhook
  if (ALERT_WEBHOOK_URL) {
    promises.push(sendWebhookAlert(payload));
  }

  // Send via Slack
  if (ALERT_SLACK_ENABLED) {
    promises.push(sendSlackAlert(payload));
  }

  // Send via Email (placeholder - would integrate with email service)
  if (ALERT_EMAIL_ENABLED) {
    promises.push(sendEmailAlert(payload));
  }

  // Send via generic webhook system
  promises.push(
    sendWebhookNotification("treasury_low_runway", payload).catch((err) => {
      console.error(`[Notifier] Webhook notification failed: ${err.message}`);
    }),
  );

  if (promises.length === 0) {
    console.warn(
      `[Notifier] ⚠️  No alert channels configured — skipping alert for employer ${params.employer}`,
    );
    return;
  }

  await Promise.allSettled(promises);
  console.log(
    `[Notifier] 🚨 Alert sent for employer ${params.employer} — ` +
      `runway ${params.runwayDays?.toFixed(1) ?? "∞"} days, ` +
      `exhaustion date: ${params.exhaustionDate ?? "N/A"}`,
  );
};

/**
 * Sends alert to configured webhook URL
 */
const sendWebhookAlert = async (
  payload: TreasuryAlertPayload,
): Promise<void> => {
  try {
    await notifierBreaker.fire(ALERT_WEBHOOK_URL, payload, { timeout: 5_000 });
    console.log(`[Notifier] ✅ Webhook alert sent to ${ALERT_WEBHOOK_URL}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Notifier] ❌ Webhook alert failed: ${msg}`);
    throw err;
  }
};

/**
 * Sends alert to Slack
 */
const sendSlackAlert = async (payload: TreasuryAlertPayload): Promise<void> => {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl) {
    console.warn(
      "[Notifier] ⚠️  SLACK_WEBHOOK_URL not set — skipping Slack alert",
    );
    return;
  }

  const runwayText =
    payload.runway_days !== null
      ? `${payload.runway_days.toFixed(1)} days`
      : "unlimited";
  const exhaustionText = payload.funds_exhaustion_date
    ? new Date(payload.funds_exhaustion_date).toLocaleDateString()
    : "N/A";

  const slackPayload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⚠️ Treasury Low Runway Alert",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Employer:*\n${payload.employer}`,
          },
          {
            type: "mrkdwn",
            text: `*Runway:*\n${runwayText}`,
          },
          {
            type: "mrkdwn",
            text: `*Balance:*\n${(payload.balance / 1e7).toFixed(2)} tokens`,
          },
          {
            type: "mrkdwn",
            text: `*Daily Burn Rate:*\n${(payload.daily_burn_rate / 1e7).toFixed(2)} tokens/day`,
          },
          {
            type: "mrkdwn",
            text: `*Liabilities:*\n${(payload.liabilities / 1e7).toFixed(2)} tokens`,
          },
          {
            type: "mrkdwn",
            text: `*Exhaustion Date:*\n${exhaustionText}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Alert triggered when runway < ${payload.alert_threshold_days} days`,
          },
        ],
      },
    ],
  };

  try {
    await notifierBreaker.fire(slackWebhookUrl, slackPayload, {
      timeout: 5_000,
    });
    console.log(`[Notifier] ✅ Slack alert sent`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Notifier] ❌ Slack alert failed: ${msg}`);
    throw err;
  }
};

/**
 * Sends alert via email.
 *
 * Requires ALERT_EMAIL_ENABLED=true and an email provider integration.
 * Supported providers: SendGrid (SENDGRID_API_KEY), AWS SES (AWS_SES_*).
 * Until a provider is configured this channel logs and is a no-op.
 */
const sendEmailAlert = async (payload: TreasuryAlertPayload): Promise<void> => {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) {
    console.warn(
      `[Notifier] ⚠️  SENDGRID_API_KEY not set — email alert skipped for employer ${payload.employer}. ` +
        "Set SENDGRID_API_KEY and ALERT_EMAIL_TO to enable email notifications.",
    );
    return;
  }
  // Email provider integration goes here (SendGrid / AWS SES).
  console.warn(
    `[Notifier] Email delivery not yet implemented. Skipping alert for ${payload.employer}.`,
  );
};

// ==================== Worker Notification Types ====================

export interface WorkerNotificationPayload {
  event: "cliff_unlock" | "stream_ending" | "low_runway";
  worker: string;
  stream_id: number;
  employer: string;
  token: string;
  amount?: number;
  cliff_date?: string;
  stream_end_date?: string;
  runway_days?: number;
  threshold_days?: number;
  timestamp: string;
}

export const sendWorkerNotification = async (params: {
  event: "cliff_unlock" | "stream_ending" | "low_runway";
  worker: string;
  streamId: number;
  employer: string;
  token: string;
  amount?: number;
  cliffDate?: string;
  streamEndDate?: string;
  runwayDays?: number;
  thresholdDays?: number;
}): Promise<void> => {
  const payload: WorkerNotificationPayload = {
    event: params.event,
    worker: params.worker,
    stream_id: params.streamId,
    employer: params.employer,
    token: params.token,
    amount: params.amount,
    cliff_date: params.cliffDate,
    stream_end_date: params.streamEndDate,
    runway_days: params.runwayDays,
    threshold_days: params.thresholdDays,
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[Notifier] 📬 Worker notification sent to ${params.worker} - ` +
      `event: ${params.event}, stream: ${params.streamId}`,
  );

  await sendWebhookNotification("worker_notification", payload).catch((err) => {
    console.error(
      `[Notifier] Worker notification webhook failed: ${err.message}`,
    );
  });
};

export const sendCliffUnlockNotification = async (params: {
  worker: string;
  streamId: number;
  employer: string;
  token: string;
  cliffDate: string;
}): Promise<void> => {
  await sendWorkerNotification({
    event: "cliff_unlock",
    worker: params.worker,
    streamId: params.streamId,
    employer: params.employer,
    token: params.token,
    cliffDate: params.cliffDate,
  });
};

export const sendStreamEndingNotification = async (params: {
  worker: string;
  streamId: number;
  employer: string;
  token: string;
  streamEndDate: string;
  amount: number;
}): Promise<void> => {
  await sendWorkerNotification({
    event: "stream_ending",
    worker: params.worker,
    streamId: params.streamId,
    employer: params.employer,
    token: params.token,
    amount: params.amount,
    streamEndDate: params.streamEndDate,
  });
};

export const sendWorkerLowRunwayNotification = async (params: {
  worker: string;
  streamId: number;
  employer: string;
  token: string;
  runwayDays: number;
  thresholdDays: number;
}): Promise<void> => {
  await sendWorkerNotification({
    event: "low_runway",
    worker: params.worker,
    streamId: params.streamId,
    employer: params.employer,
    token: params.token,
    runwayDays: params.runwayDays,
    thresholdDays: params.thresholdDays,
  });
};
