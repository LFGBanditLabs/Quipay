import axios from "axios";
import { DatabaseError, NotFoundError } from "./errors/AppError";
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

export const WEBHOOK_DLQ_MAX_RETRIES = 5;
export const WEBHOOK_DLQ_BACKOFF_SCHEDULE_MS = [
  30_000,
  2 * 60_000,
  10 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export const computeWebhookDlqNextRetryAtMs = (
  retryCount: number,
): number | null => {
  if (
    retryCount < 0 ||
    retryCount >= WEBHOOK_DLQ_BACKOFF_SCHEDULE_MS.length
  ) {
    return null;
  }

  return Date.now() + WEBHOOK_DLQ_BACKOFF_SCHEDULE_MS[retryCount];
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

export interface WebhookDeliveryResult {
  statusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number;
  succeeded: boolean;
}

export const deliverWebhookRequest = async (
  url: string,
  outgoingPayload: unknown,
): Promise<WebhookDeliveryResult> => {
  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;

  try {
    const signingSecret = process.env.QUIPAY_WEBHOOK_SIGNING_SECRET;

    const requestBodyString = JSON.stringify(outgoingPayload);
    const signatureHex = signingSecret
      ? computeQuipayWebhookSignatureHex(
          Buffer.from(requestBodyString, "utf8"),
          signingSecret,
        )
      : null;

    const response: any = await webhookBreaker.fire(url, outgoingPayload, {
      timeout: 5000,
      validateStatus: () => true,
      headers: signatureHex
        ? {
            "X-Quipay-Signature": signatureHex,
          }
        : undefined,
    });
    statusCode = response.status;
    if (response.data !== undefined) {
      responseBody =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
    }
  } catch (err: any) {
    statusCode = getHttpStatusFromAxiosError(err);
    responseBody = getResponseBodyFromAxiosError(err);
    errorMessage = getErrorMessage(err);
  }

  const durationMs = Date.now() - startTime;
  const succeeded =
    statusCode !== null && statusCode >= 200 && statusCode < 300;

  return {
    statusCode,
    responseBody,
    errorMessage,
    durationMs,
    succeeded,
  };
};

const attemptDeliveryOnce = async (params: {
  eventId: string;
  url: string;
  eventType: string;
  outgoingPayload: any;
  attemptNumber: number;
}): Promise<void> => {
  const result = await deliverWebhookRequest(params.url, params.outgoingPayload);
  const failureReason = result.succeeded
    ? null
    : result.errorMessage ??
      (result.statusCode !== null ? `HTTP ${result.statusCode}` : null) ??
      result.responseBody ??
      "Webhook delivery failed";

  if (getPool()) {
    await insertWebhookOutboundAttempt({
      eventId: params.eventId,
      attemptNumber: params.attemptNumber,
      responseCode: result.statusCode,
      responseBody: result.responseBody,
      errorMessage: result.errorMessage,
      durationMs: result.durationMs,
    });

    await updateWebhookOutboundEventAfterAttempt({
      eventId: params.eventId,
      status: result.succeeded ? "success" : "failed",
      attemptCount: params.attemptNumber,
      lastResponseCode: result.statusCode,
      lastError: failureReason,
      nextRetryAt: null,
    });
  }

  if (result.succeeded) {
    metricsManager.trackTransaction("success", result.durationMs / 1000);
    console.log(
      `[Webhooks] ✅ Successfully delivered '${params.eventType}' to ${params.url}`,
    );
    return;
  }

  console.error(
    `[Webhooks] 🚫 Delivery failed '${params.eventType}' to ${params.url}. Enqueued for DLQ retries.`,
  );
  if (getPool()) {
    const nextRetryAtMs = computeWebhookDlqNextRetryAtMs(0);
    await pushToDLQ(
      "webhook_delivery",
      {
        eventId: params.eventId,
        targetUrl: params.url,
        eventType: params.eventType,
        requestPayload: params.outgoingPayload,
      },
      failureReason ?? "Webhook delivery failed",
      {
        targetUrl: params.url,
        retryCount: 0,
        nextRetryAtMs,
        statusCode: result.statusCode,
        attemptNumber: params.attemptNumber,
      },
    );
  }
  metricsManager.trackTransaction("failure", 0);
};

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
    throw new DatabaseError("Database not configured");
  }
  const ev = await getWebhookOutboundEventById(eventId);
  if (!ev) {
    throw new NotFoundError(`Webhook event ${eventId}`);
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
        targetUrl: ev.url,
        eventType: ev.event_type,
        requestPayload: ev.request_payload,
      },
      "Subscription not found (deleted or not loaded)",
      {
        targetUrl: ev.url,
        retryCount: 0,
        nextRetryAtMs: computeWebhookDlqNextRetryAtMs(0),
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
