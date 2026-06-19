import axios, { AxiosError } from "axios";
import { dlqManager } from "./db/dlq.js";
import { auditEvents } from "./utils/auditEvents.js";
import { logger } from "./utils/logger.js";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
  id?: string;
}

export interface DeliveryOptions {
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export class WebhookDeliveryService {
  private defaultTimeout = 10000; // 10 seconds
  private defaultMaxRetries = 5;

  async deliverWebhook(
    targetUrl: string,
    payload: WebhookPayload,
    options: DeliveryOptions = {},
  ): Promise<{ success: boolean; error?: string }> {
    const {
      timeout = this.defaultTimeout,
      maxRetries = this.defaultMaxRetries,
      headers = {},
    } = options;

    const requestPayload = {
      ...payload,
      id: payload.id || this.generateWebhookId(),
      timestamp: payload.timestamp || new Date().toISOString(),
    };

    const requestConfig = {
      timeout,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Quipay-Webhook-Delivery/1.0",
        ...headers,
      },
      // Don't follow redirects for webhooks
      maxRedirects: 0,
      validateStatus: (status: number) => status >= 200 && status < 300,
    };

    try {
      logger.info("Attempting webhook delivery", {
        targetUrl,
        event: requestPayload.event,
        webhookId: requestPayload.id,
      });

      const response = await axios.post(
        targetUrl,
        requestPayload,
        requestConfig,
      );

      logger.info("Webhook delivery successful", {
        targetUrl,
        event: requestPayload.event,
        webhookId: requestPayload.id,
        statusCode: response.status,
        responseTime: response.headers["x-response-time"] || "unknown",
      });

      return { success: true };
    } catch (error) {
      const errorMessage = this.formatError(error);

      logger.warn("Webhook delivery failed, adding to DLQ", {
        targetUrl,
        event: requestPayload.event,
        webhookId: requestPayload.id,
        error: errorMessage,
      });

      // Add to DLQ for retry processing
      try {
        const entryId = await dlqManager.addEntry(
          requestPayload,
          targetUrl,
          maxRetries,
        );

        // Emit audit event
        await auditEvents.emitWebhookAddedToDLQ(
          entryId,
          targetUrl,
          errorMessage,
        );

        return {
          success: false,
          error: `Webhook delivery failed: ${errorMessage}. Added to DLQ for retry (ID: ${entryId})`,
        };
      } catch (dlqError) {
        logger.error("Failed to add webhook to DLQ", {
          targetUrl,
          event: requestPayload.event,
          webhookId: requestPayload.id,
          originalError: errorMessage,
          dlqError: String(dlqError),
        });

        return {
          success: false,
          error: `Webhook delivery failed: ${errorMessage}. DLQ storage also failed: ${dlqError}`,
        };
      }
    }
  }

  async retryWebhookFromDLQ(
    entryId: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const entry = await dlqManager.getEntryById(entryId);
      if (!entry) {
        throw new Error(`DLQ entry ${entryId} not found`);
      }

      if (entry.retryCount >= entry.maxRetries) {
        throw new Error(`DLQ entry ${entryId} has exceeded max retries`);
      }

      logger.info("Retrying webhook from DLQ", {
        entryId,
        targetUrl: entry.targetUrl,
        retryCount: entry.retryCount + 1,
        maxRetries: entry.maxRetries,
      });

      const payload = JSON.parse(entry.payload);

      // Attempt direct delivery without adding back to DLQ
      const response = await axios.post(entry.targetUrl, payload, {
        timeout: this.defaultTimeout,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Quipay-Webhook-Retry/1.0",
          "X-Retry-Count": String(entry.retryCount + 1),
        },
        maxRedirects: 0,
        validateStatus: (status: number) => status >= 200 && status < 300,
      });

      // Success - update DLQ entry
      await dlqManager.updateRetryAttempt(entryId, true);
      await auditEvents.emitWebhookRetrySuccess(
        entryId,
        entry.targetUrl,
        entry.retryCount + 1,
      );

      logger.info("Webhook retry successful", {
        entryId,
        targetUrl: entry.targetUrl,
        retryCount: entry.retryCount + 1,
        statusCode: response.status,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = this.formatError(error);

      // Update DLQ entry with failure
      await dlqManager.updateRetryAttempt(entryId, false, errorMessage);

      // Check if this was the final attempt
      const updatedEntry = await dlqManager.getEntryById(entryId);
      if (updatedEntry && updatedEntry.status === "failed") {
        await auditEvents.emitWebhookPermanentlyFailed(
          entryId,
          updatedEntry.targetUrl,
          updatedEntry.retryCount,
          errorMessage,
        );
      } else {
        await auditEvents.emitWebhookRetryFailed(
          entryId,
          updatedEntry?.targetUrl || "unknown",
          updatedEntry?.retryCount || 0,
          errorMessage,
        );
      }

      logger.warn("Webhook retry failed", {
        entryId,
        error: errorMessage,
        retryCount: updatedEntry?.retryCount,
      });

      return { success: false, error: errorMessage };
    }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === "ECONNABORTED") {
        return "Request timeout";
      }

      if (axiosError.code === "ENOTFOUND" || axiosError.code === "EAI_AGAIN") {
        return "DNS resolution failed";
      }

      if (axiosError.code === "ECONNREFUSED") {
        return "Connection refused";
      }

      if (axiosError.response) {
        return `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
      }

      if (axiosError.request) {
        return "No response received";
      }

      return axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private generateWebhookId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Convenience methods for common webhook events
  async deliverPayrollEvent(
    targetUrl: string,
    eventType: string,
    payrollData: Record<string, any>,
  ): Promise<{ success: boolean; error?: string }> {
    return this.deliverWebhook(targetUrl, {
      event: `payroll.${eventType}`,
      timestamp: new Date().toISOString(),
      data: payrollData,
    });
  }

  async deliverStreamEvent(
    targetUrl: string,
    eventType: string,
    streamData: Record<string, any>,
  ): Promise<{ success: boolean; error?: string }> {
    return this.deliverWebhook(targetUrl, {
      event: `stream.${eventType}`,
      timestamp: new Date().toISOString(),
      data: streamData,
    });
  }

  async deliverWithdrawalEvent(
    targetUrl: string,
    eventType: string,
    withdrawalData: Record<string, any>,
  ): Promise<{ success: boolean; error?: string }> {
    return this.deliverWebhook(targetUrl, {
      event: `withdrawal.${eventType}`,
      timestamp: new Date().toISOString(),
      data: withdrawalData,
    });
  }
}

// Export singleton instance
export const webhookDelivery = new WebhookDeliveryService();
