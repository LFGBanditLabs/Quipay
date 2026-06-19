import express from "express";
import { dlqWorker } from "./workers/dlqWorker.js";
import { dlqManager } from "./db/dlq.js";
import { webhookDelivery } from "./delivery.js";
import { logger } from "./utils/logger.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "quipay-webhook-service",
    timestamp: new Date().toISOString(),
  });
});

// DLQ management endpoints
app.get("/api/dlq/stats", async (req, res) => {
  try {
    const stats = await dlqManager.getStats();
    const workerStatus = await dlqWorker.getWorkerStatus();

    res.json({
      dlq: stats,
      worker: workerStatus,
    });
  } catch (error) {
    logger.error("Failed to get DLQ stats:", error);
    res.status(500).json({ error: "Failed to get DLQ statistics" });
  }
});

app.get("/api/dlq/failed", async (req, res) => {
  try {
    const failedEntries = await dlqManager.getPermanentlyFailedEntries();
    res.json({ failed: failedEntries });
  } catch (error) {
    logger.error("Failed to get failed entries:", error);
    res.status(500).json({ error: "Failed to get failed entries" });
  }
});

app.post("/api/dlq/retry-all", async (req, res) => {
  try {
    const summary = await dlqWorker.processAllPendingRetries();
    res.json({ success: true, summary });
  } catch (error) {
    logger.error("Failed to process manual retries:", error);
    res.status(500).json({ error: "Failed to process retries" });
  }
});

app.post("/api/dlq/worker/start", (req, res) => {
  try {
    dlqWorker.start();
    res.json({ success: true, message: "DLQ worker started" });
  } catch (error) {
    logger.error("Failed to start DLQ worker:", error);
    res.status(500).json({ error: "Failed to start DLQ worker" });
  }
});

app.post("/api/dlq/worker/stop", (req, res) => {
  try {
    dlqWorker.stop();
    res.json({ success: true, message: "DLQ worker stopped" });
  } catch (error) {
    logger.error("Failed to stop DLQ worker:", error);
    res.status(500).json({ error: "Failed to stop DLQ worker" });
  }
});

// Webhook delivery endpoint (for testing and manual triggers)
app.post("/api/webhooks/send", async (req, res) => {
  try {
    const { targetUrl, payload, options } = req.body;

    if (!targetUrl || !payload) {
      return res
        .status(400)
        .json({ error: "targetUrl and payload are required" });
    }

    const result = await webhookDelivery.deliverWebhook(
      targetUrl,
      payload,
      options,
    );

    if (result.success) {
      res.json({ success: true, message: "Webhook delivered successfully" });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error("Failed to send webhook:", error);
    res.status(500).json({ error: "Failed to send webhook" });
  }
});

// Payroll event endpoints (examples of webhook triggers)
app.post("/api/payroll/events/completed", async (req, res) => {
  try {
    const { payrollData, webhookUrl } = req.body;

    if (webhookUrl) {
      await webhookDelivery.deliverPayrollEvent(
        webhookUrl,
        "completed",
        payrollData,
      );
    }

    res.json({ success: true, message: "Payroll completion processed" });
  } catch (error) {
    logger.error("Failed to process payroll completion:", error);
    res.status(500).json({ error: "Failed to process payroll completion" });
  }
});

app.post("/api/payroll/events/failed", async (req, res) => {
  try {
    const { payrollData, webhookUrl } = req.body;

    if (webhookUrl) {
      await webhookDelivery.deliverPayrollEvent(
        webhookUrl,
        "failed",
        payrollData,
      );
    }

    res.json({ success: true, message: "Payroll failure processed" });
  } catch (error) {
    logger.error("Failed to process payroll failure:", error);
    res.status(500).json({ error: "Failed to process payroll failure" });
  }
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  },
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Quipay webhook service listening on port ${PORT}`);

  // Start DLQ worker by default
  dlqWorker.start();
  logger.info("DLQ retry worker started automatically");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");

  dlqWorker.stop();

  server.close(() => {
    logger.info("Server closed");
    dlqManager.close().then(() => {
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");

  dlqWorker.stop();

  server.close(() => {
    logger.info("Server closed");
    dlqManager.close().then(() => {
      process.exit(0);
    });
  });
});

export { app };
