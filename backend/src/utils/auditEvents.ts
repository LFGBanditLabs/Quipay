import { logger } from "./logger.js";

export interface AuditEvent {
  eventType: string;
  timestamp: string;
  data: Record<string, any>;
  severity: "info" | "warn" | "error";
}

export class AuditEventEmitter {
  async emit(
    eventType: string,
    data: Record<string, any>,
    severity: "info" | "warn" | "error" = "info",
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      eventType,
      timestamp: new Date().toISOString(),
      data,
      severity,
    };

    // Log the audit event
    logger[severity]("Audit event emitted", auditEvent);

    // In a production system, you might also:
    // - Send to an audit database
    // - Send to monitoring systems (DataDog, New Relic, etc.)
    // - Send to SIEM systems
    // - Publish to message queues

    // For now, we'll just log it with appropriate severity
    if (severity === "error") {
      logger.error(`AUDIT: ${eventType}`, data);
    } else if (severity === "warn") {
      logger.warn(`AUDIT: ${eventType}`, data);
    } else {
      logger.info(`AUDIT: ${eventType}`, data);
    }
  }

  async emitWebhookPermanentlyFailed(
    entryId: number,
    targetUrl: string,
    retryCount: number,
    lastError: string,
  ): Promise<void> {
    await this.emit(
      "webhook.permanently_failed",
      {
        entryId,
        targetUrl,
        retryCount,
        lastError,
        description:
          "Webhook delivery permanently failed after maximum retry attempts",
      },
      "error",
    );
  }

  async emitWebhookRetrySuccess(
    entryId: number,
    targetUrl: string,
    retryCount: number,
  ): Promise<void> {
    await this.emit(
      "webhook.retry_success",
      {
        entryId,
        targetUrl,
        retryCount,
        description: "Webhook delivery succeeded after retry",
      },
      "info",
    );
  }

  async emitWebhookRetryFailed(
    entryId: number,
    targetUrl: string,
    retryCount: number,
    error: string,
  ): Promise<void> {
    await this.emit(
      "webhook.retry_failed",
      {
        entryId,
        targetUrl,
        retryCount,
        error,
        description: "Webhook delivery retry attempt failed",
      },
      "warn",
    );
  }

  async emitWebhookAddedToDLQ(
    entryId: number,
    targetUrl: string,
    originalError: string,
  ): Promise<void> {
    await this.emit(
      "webhook.added_to_dlq",
      {
        entryId,
        targetUrl,
        originalError,
        description: "Webhook delivery failed and added to DLQ for retry",
      },
      "warn",
    );
  }
}

// Export singleton instance
export const auditEvents = new AuditEventEmitter();
