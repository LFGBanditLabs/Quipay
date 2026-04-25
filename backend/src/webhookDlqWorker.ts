import {
  DLQItem,
  listDueWebhookDLQItems,
  patchDLQItemContext,
  updateDLQItemStatus,
} from "./db/dlq";
import { getPool, query } from "./db/pool";
import {
  WEBHOOK_DLQ_MAX_RETRIES,
  computeWebhookDlqNextRetryAtMs,
  deliverWebhookRequest,
} from "./delivery";

interface WebhookDLQPayload {
  eventId?: string;
  eventType?: string;
  targetUrl?: string;
  url?: string;
  requestPayload?: unknown;
  originalPayload?: unknown;
  payload?: unknown;
}

interface WebhookDLQContext {
  retryCount?: unknown;
  targetUrl?: unknown;
}

const PERMANENT_FAILURE_AUDIT_EVENT = "webhook.permanently_failed";

const toNonNegativeInt = (value: unknown, fallback = 0): number => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const resolveTargetUrl = (
  payload: WebhookDLQPayload,
  context: WebhookDLQContext,
): string | null => {
  const fromPayload = payload.targetUrl || payload.url;
  if (typeof fromPayload === "string" && fromPayload.length > 0) {
    return fromPayload;
  }

  if (typeof context.targetUrl === "string" && context.targetUrl.length > 0) {
    return context.targetUrl;
  }

  return null;
};

const resolveRequestPayload = (payload: WebhookDLQPayload): unknown => {
  if (payload.requestPayload !== undefined) return payload.requestPayload;
  if (payload.originalPayload !== undefined) return payload.originalPayload;
  return payload.payload;
};

const insertPermanentFailureAuditEvent = async (params: {
  dlqId: string;
  eventId?: string;
  eventType?: string;
  targetUrl?: string | null;
  retryCount: number;
  statusCode: number | null;
  errorMessage: string;
}): Promise<void> => {
  if (!getPool()) return;

  await query(
    `INSERT INTO audit_logs (
      timestamp, log_level, message, action_type, context, error_message, created_at
    ) VALUES (NOW(), 'ERROR', $1, 'system', $2, $3, NOW())`,
    [
      PERMANENT_FAILURE_AUDIT_EVENT,
      JSON.stringify({
        event: PERMANENT_FAILURE_AUDIT_EVENT,
        dlq_id: params.dlqId,
        event_id: params.eventId,
        event_type: params.eventType,
        target_url: params.targetUrl,
        retry_count: params.retryCount,
        status_code: params.statusCode,
      }),
      params.errorMessage,
    ],
  );
};

const processWebhookDLQItem = async (item: DLQItem): Promise<void> => {
  const payload = (item.payload || {}) as WebhookDLQPayload;
  const context = (item.context || {}) as WebhookDLQContext;
  const currentRetryCount = toNonNegativeInt(context.retryCount, 0);
  const targetUrl = resolveTargetUrl(payload, context);
  const requestPayload = resolveRequestPayload(payload);

  if (!targetUrl || requestPayload === undefined) {
    const reason = "Invalid webhook DLQ payload (missing target URL or payload)";
    await updateDLQItemStatus(item.id, "discarded");
    await patchDLQItemContext(
      item.id,
      {
        retryCount: currentRetryCount,
        nextRetryAtMs: null,
        lastStatusCode: null,
        lastAttemptAtMs: Date.now(),
      },
      reason,
    );
    await insertPermanentFailureAuditEvent({
      dlqId: item.id,
      eventId: payload.eventId,
      eventType: payload.eventType,
      targetUrl,
      retryCount: currentRetryCount,
      statusCode: null,
      errorMessage: reason,
    });
    return;
  }

  if (currentRetryCount >= WEBHOOK_DLQ_MAX_RETRIES) {
    const reason = "Maximum DLQ webhook retry attempts already exhausted";
    await updateDLQItemStatus(item.id, "discarded");
    await patchDLQItemContext(
      item.id,
      {
        retryCount: currentRetryCount,
        nextRetryAtMs: null,
        lastStatusCode: null,
        lastAttemptAtMs: Date.now(),
      },
      reason,
    );
    await insertPermanentFailureAuditEvent({
      dlqId: item.id,
      eventId: payload.eventId,
      eventType: payload.eventType,
      targetUrl,
      retryCount: currentRetryCount,
      statusCode: null,
      errorMessage: reason,
    });
    return;
  }

  const result = await deliverWebhookRequest(targetUrl, requestPayload);
  if (result.succeeded) {
    await updateDLQItemStatus(item.id, "replayed");
    await patchDLQItemContext(item.id, {
      retryCount: currentRetryCount,
      nextRetryAtMs: null,
      lastStatusCode: result.statusCode,
      lastAttemptAtMs: Date.now(),
      deliveredAtMs: Date.now(),
    });
    return;
  }

  const failureReason =
    result.errorMessage ??
    (result.statusCode !== null ? `HTTP ${result.statusCode}` : null) ??
    result.responseBody ??
    "Webhook delivery failed";
  const nextRetryCount = currentRetryCount + 1;

  if (nextRetryCount >= WEBHOOK_DLQ_MAX_RETRIES) {
    await updateDLQItemStatus(item.id, "discarded");
    await patchDLQItemContext(
      item.id,
      {
        retryCount: nextRetryCount,
        nextRetryAtMs: null,
        lastStatusCode: result.statusCode,
        lastAttemptAtMs: Date.now(),
      },
      failureReason,
    );

    await insertPermanentFailureAuditEvent({
      dlqId: item.id,
      eventId: payload.eventId,
      eventType: payload.eventType,
      targetUrl,
      retryCount: nextRetryCount,
      statusCode: result.statusCode,
      errorMessage: failureReason,
    });
    return;
  }

  await patchDLQItemContext(
    item.id,
    {
      retryCount: nextRetryCount,
      nextRetryAtMs: computeWebhookDlqNextRetryAtMs(nextRetryCount),
      lastStatusCode: result.statusCode,
      lastAttemptAtMs: Date.now(),
    },
    failureReason,
  );
};

export const runWebhookDLQRetryBatch = async (
  batchSize: number = 50,
): Promise<number> => {
  if (!getPool()) return 0;

  const items = await listDueWebhookDLQItems(batchSize);
  if (items.length === 0) return 0;

  for (const item of items) {
    try {
      await processWebhookDLQItem(item);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[WebhookDLQWorker] Failed to process DLQ item ${item.id}: ${message}`,
      );
    }
  }

  return items.length;
};

