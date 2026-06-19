import cron from "node-cron";
import { dlqManager } from "../db/dlq.js";
import { webhookDelivery } from "../delivery.js";
import { logger } from "../utils/logger.js";
import { auditEvents } from "../utils/auditEvents.js";

export class DLQRetryWorker {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private maxConcurrentRetries = 5;

  constructor() {
    logger.info("DLQ Retry Worker initialized");
  }

  start(): void {
    if (this.isRunning) {
      logger.warn("DLQ Retry Worker already running");
      return;
    }

    // Run every minute to check for retryable entries
    this.cronJob = cron.schedule(
      "* * * * *",
      async () => {
        await this.processRetries();
      },
      {
        scheduled: false,
        name: "dlq-retry-worker",
      },
    );

    this.cronJob.start();
    this.isRunning = true;

    logger.info("DLQ Retry Worker started - checking for retries every minute");
  }

  stop(): void {
    if (!this.isRunning || !this.cronJob) {
      logger.warn("DLQ Retry Worker not running");
      return;
    }

    this.cronJob.stop();
    this.cronJob = null;
    this.isRunning = false;

    logger.info("DLQ Retry Worker stopped");
  }

  async processRetries(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.debug("Checking for retryable DLQ entries");

      const retryableEntries = await dlqManager.getRetryableEntries();

      if (retryableEntries.length === 0) {
        logger.debug("No DLQ entries ready for retry");
        return;
      }

      logger.info(
        `Found ${retryableEntries.length} DLQ entries ready for retry`,
      );

      // Process retries in batches to avoid overwhelming the system
      const batches = this.chunkArray(
        retryableEntries,
        this.maxConcurrentRetries,
      );

      for (const batch of batches) {
        await Promise.allSettled(
          batch.map((entry) => this.processSingleRetry(entry)),
        );

        // Small delay between batches to prevent overwhelming target servers
        if (batches.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      logger.error("Error processing DLQ retries:", error);
    }
  }

  private async processSingleRetry(entry: any): Promise<void> {
    try {
      logger.info("Processing DLQ retry", {
        entryId: entry.id,
        targetUrl: entry.targetUrl,
        retryCount: entry.retryCount + 1,
        maxRetries: entry.maxRetries,
      });

      await webhookDelivery.retryWebhookFromDLQ(entry.id);
    } catch (error) {
      logger.error("Failed to process DLQ retry", {
        entryId: entry.id,
        error: String(error),
      });
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async getWorkerStatus(): Promise<{
    isRunning: boolean;
    stats: {
      pending: number;
      retrying: number;
      success: number;
      failed: number;
    };
    nextScheduledRun?: string;
  }> {
    const stats = await dlqManager.getStats();

    return {
      isRunning: this.isRunning,
      stats,
      nextScheduledRun: this.cronJob?.nextDates(1)?.[0]?.toISOString(),
    };
  }

  async processAllPendingRetries(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    logger.info("Processing all pending DLQ retries (manual trigger)");

    const retryableEntries = await dlqManager.getRetryableEntries();
    let successful = 0;
    let failed = 0;

    for (const entry of retryableEntries) {
      try {
        const result = await webhookDelivery.retryWebhookFromDLQ(entry.id!);
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        logger.error("Manual retry failed", {
          entryId: entry.id,
          error: String(error),
        });
      }
    }

    const summary = {
      processed: retryableEntries.length,
      successful,
      failed,
    };

    logger.info("Manual DLQ processing completed", summary);

    return summary;
  }
}

// Export singleton instance
export const dlqWorker = new DLQRetryWorker();

// If running directly, start the worker
if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info("Starting DLQ Worker in standalone mode");

  dlqWorker.start();

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down DLQ Worker");
    dlqWorker.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down DLQ Worker");
    dlqWorker.stop();
    process.exit(0);
  });
}
