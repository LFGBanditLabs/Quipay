import axios from "axios";
import { webhookStore, WebhookSubscription } from "./webhooks";
import { metricsManager } from "./metrics";
import crypto from "crypto";
import {
  createWebhookOutboundEvent,
  getWebhookOutboundEventById,
  insertWebhookOutboundAttempt,
  updateWebhookOutboundEventAfterAttempt,
} from "./db/queries";
import { getPool } from "./db/pool";
import { createCircuitBreaker } from "./utils/circuitBreaker";
import { pushToDLQ } from "./db/dlq";

const webhookBreaker = createCircuitBreaker(axios.post, {
  name: "webhook_delivery",
  timeout: 7000,
  errorThresholdPercentage: 50,
  resetTimeout: 60000,
});

webhookBreaker.fallback((url: string) => {
  console.warn(`[Webhooks] Circuit breaker fallback triggered for ${url}`);
  return {
    status: 503,
    data: { error: "Service Unavailable (Circuit Breaker)" },
  };
});

// One initial attempt plus five retries with backoff: 1s, 2s, 4s, 8s, 16s.
const MAX_RETRY_ATTEMPTS = 5;
const MAX_ATTEMPTS = MAX_RETRY_ATTEMPTS + 1;

const computeBackoffMs = (attemptNumber: number): number => {
  const baseMs = 1_000;
  const maxMs = 10 * 60 * 1_000;
  const exponential = Math.pow(2, Math.max(0, attemptNumber - 1)) * baseMs;
  return Math.min(exponential, maxMs);
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const getHttpStatusFromAxiosError = (err: any): number | null => {
  const status = err?.response?.status;
  return typeof status === "number" ? status : null;
};

const getResponseBodyFromAxiosError = (err: any): string | null => {
  const data = err?.response?.data;
  if (data === undefined || data === null) return null;
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
};

const isRetryableServerFailure = (
  statusCode: number | null,
  err: any,
): boolean => {
  if (statusCode !== null) {
    return statusCode >= 500;
  }
  // Network / timeout / DNS errors etc. Treat as retryable.
  return Boolean(err);
};

const buildOutgoingPayload = (
  sub: WebhookSubscription,
  eventType: string,
  payload: any,
): any => {
  let outgoingPayload: any = {
    event: eventType,
    data: payload,
    timestamp: new Date().toISOString(),
  };

  if (sub.url.includes("discord.com/api/webhooks")) {
    outgoingPayload = {
      embeds: [
        {
          title: `Quipay Notification: ${eventType.toUpperCase()}`,
          description: `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
          color: 0x5865f2,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } else if (sub.url.includes("hooks.slack.com")) {
    outgoingPayload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `Quipay Notification: ${eventType.toUpperCase()}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "```" + JSON.stringify(payload, null, 2) + "```",
          },
        },
      ],
    };
  }

  return outgoingPayload;
};

const computeQuipayWebhookSignatureHex = (
  rawBody: Buffer,
  signingSecret: string,
): string => {
  return crypto
    .createHmac("sha256", signingSecret)
    .update(rawBody)
    .digest("hex");
};

const attemptDeliveryOnce = async (params: {
  eventId: string;
  url: string;
  eventType: string;
  outgoingPayload: any;
  attemptNumber: number;
}): Promise<void> => {
  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  let rawError: any = null;

  try {
    const signingSecret = process.env.QUIPAY_WEBHOOK_SIGNING_SECRET;

    const requestBodyString = JSON.stringify(params.outgoingPayload);
    const signatureHex = signingSecret
      ? computeQuipayWebhookSignatureHex(
          Buffer.from(requestBodyString, "utf8"),
          signingSecret,
        )
      : null;

    const response: any = await webhookBreaker.fire(
      params.url,
      params.outgoingPayload,
      {
        timeout: 5000,
        validateStatus: () => true,
        headers: signatureHex
          ? {
              "X-Quipay-Signature": signatureHex,
            }
          : undefined,
      },
    );
    statusCode = response.status;
    if (response.data !== undefined) {
      responseBody =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
    }
  } catch (err: any) {
    rawError = err;
    statusCode = getHttpStatusFromAxiosError(err);
    responseBody = getResponseBodyFromAxiosError(err);
    errorMessage = getErrorMessage(err);
  }

  const durationMs = Date.now() - startTime;
  const succeeded =
    statusCode !== null && statusCode >= 200 && statusCode < 300;
  const retryable =
    !succeeded && isRetryableServerFailure(statusCode, rawError);
  const hasMoreRetries = params.attemptNumber < MAX_ATTEMPTS;
  const nextRetryAt =
    retryable && hasMoreRetries
      ? new Date(Date.now() + computeBackoffMs(params.attemptNumber))
      : null;

  if (getPool()) {
    await insertWebhookOutboundAttempt({
      eventId: params.eventId,
      attemptNumber: params.attemptNumber,
      responseCode: statusCode,
      responseBody,
      errorMessage,
      durationMs,
    });

    await updateWebhookOutboundEventAfterAttempt({
      eventId: params.eventId,
      status: succeeded ? "success" : nextRetryAt ? "pending" : "failed",
      attemptCount: params.attemptNumber,
      lastResponseCode: statusCode,
      lastError: errorMessage,
      nextRetryAt,
    });
  }

  if (succeeded) {
    metricsManager.trackTransaction("success", durationMs / 1000);
    console.log(
      `[Webhooks] ✅ Successfully delivered '${params.eventType}' to ${params.url}`,
    );
    return;
  }

  if (retryable && hasMoreRetries) {
    console.error(
      `[Webhooks] ❌ Delivery failed '${params.eventType}' to ${params.url}. Scheduled retry ${params.attemptNumber}/${MAX_ATTEMPTS} at ${nextRetryAt?.toISOString()}.`,
    );
    metricsManager.trackTransaction("failure", 0);
    return;
  }

  console.error(
    `[Webhooks] 🚫 Delivery permanently failed '${params.eventType}' to ${params.url} after ${params.attemptNumber}/${MAX_ATTEMPTS}.`,
  );
  if (getPool()) {
    await pushToDLQ(
      "webhook_delivery",
      {
        eventId: params.eventId,
        url: params.url,
        eventType: params.eventType,
        requestPayload: params.outgoingPayload,
      },
      errorMessage ?? responseBody ?? "Webhook delivery failed",
      {
        attemptNumber: params.attemptNumber,
        statusCode,
      },
    );
  }
  metricsManager.trackTransaction("failure", 0);
};

import { enqueueJob } from "./queue/asyncQueue";

/**
 * Sends a notification payload to all webhook URLs subscribed to the event type.
 */
export const sendWebhookNotification = async (
  eventType: string,
  payload: any,
) => {
  const subscriptions = Array.from(webhookStore.values()).filter((sub) =>
    sub.events.includes(eventType),
  );

  if (subscriptions.length === 0) {
    return;
  }

  console.log(
    `[Webhooks] Enqueueing event '${eventType}' to ${subscriptions.length} subscribers...`,
  );

  const deliveryPromises = subscriptions.map(async (sub) => {
    const outgoingPayload = buildOutgoingPayload(sub, eventType, payload);
    const eventId = crypto.randomUUID();

    if (getPool()) {
      await createWebhookOutboundEvent({
        id: eventId,
        ownerId: sub.ownerId,
        subscriptionId: sub.id,
        url: sub.url,
        eventType,
        requestPayload: outgoingPayload,
      });
    }

    return attemptDeliveryOnce({
      eventId,
      url: sub.url,
      eventType,
      outgoingPayload,
      attemptNumber: 1,
    });
  });
  await Promise.allSettled(deliveryPromises);
};

export const retryWebhookEvent = async (eventId: string): Promise<void> => {
  if (!getPool()) {
    throw new Error("Database not configured");
  }
  const ev = await getWebhookOutboundEventById(eventId);
  if (!ev) {
    throw new Error("Webhook event not found");
  }

  // Re-resolve subscription at runtime; if missing, mark failed.
  const sub = webhookStore.get(ev.subscription_id);
  if (!sub) {
    await updateWebhookOutboundEventAfterAttempt({
      eventId,
      status: "failed",
      attemptCount: ev.attempt_count,
      lastResponseCode: ev.last_response_code,
      lastError: "Subscription not found (deleted or not loaded)",
      nextRetryAt: null,
    });
    await pushToDLQ(
      "webhook_delivery",
      {
        eventId,
        url: ev.url,
        eventType: ev.event_type,
        requestPayload: ev.request_payload,
      },
      "Subscription not found (deleted or not loaded)",
      {
        attemptCount: ev.attempt_count,
      },
    );
    return;
  }

  const attemptNumber = (ev.attempt_count ?? 0) + 1;
  await attemptDeliveryOnce({
    eventId,
    url: ev.url,
    eventType: ev.event_type,
    outgoingPayload: ev.request_payload,
    attemptNumber,
  });
};
