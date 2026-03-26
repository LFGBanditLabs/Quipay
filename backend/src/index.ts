import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { metricsManager } from "./metrics";
import { webhookRouter } from "./webhooks";
import { slackRouter } from "./slack";
import { discordRouter } from "./discord";
import { aiRouter } from "./ai";
import { adminRouter } from "./adminRouter";
import { analyticsRouter } from "./analytics";
import { docsRouter } from "./swagger";
import { proofsRouter } from "./routes/proofs";
import { startStellarListener } from "./stellarListener";
import { startScheduler, getSchedulerStatus } from "./scheduler/scheduler";
import { startMonitor, runMonitorCycle } from "./monitor/monitor";
import { NonceManager } from "./services/nonceManager";
import { initAuditLogger, getAuditLogger } from "./audit/init";
import {
  createLoggingMiddleware,
  createErrorLoggingMiddleware,
} from "./audit/middleware";
import { initDb } from "./db/pool";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { strictRateLimiter } from "./middleware/rateLimiter";
import { getPool } from "./db/pool";
import Redis from "ioredis";
import { rpc } from "@stellar/stellar-sdk";
import { secretsBootstrap } from "./services/secretsBootstrap";
import { requireMonitorStatusAdminToken } from "./middleware/monitorStatusAuth";
import { getHealthResponse } from "./health";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(
  express.json({
    limit: "1mb",
    verify: (req: any, res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
); // Limit payload size to prevent memory exhaustion
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    verify: (req: any, res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
); // For Slack form data

// Initialize database and audit logger
async function initializeServices() {
  await secretsBootstrap.initialize();
  await initDb();
  const auditLogger = initAuditLogger();

  // Add audit logging middleware for contract interactions
  app.use(createLoggingMiddleware(auditLogger));

  return auditLogger;
}

// Interactive API documentation (Swagger UI)
app.use("/api-docs", docsRouter);
// Backwards-compatible alias
app.use("/docs", docsRouter);

app.use("/webhooks", webhookRouter);
app.use("/slack", slackRouter);
// Note: discordRouter utilizes native express payloads natively bypassing body buffers mapping local examples
app.use("/discord", discordRouter);
app.use("/ai", aiRouter);
app.use("/admin", adminRouter); // RBAC-protected admin endpoints
app.use("/analytics", analyticsRouter);
app.use("/proofs", proofsRouter);

// Start time for uptime calculation
const startTime = Date.now();

// Default testing account (Note: in production, each employer/caller would have their own or share a global treasury sequence pool)
const HOT_WALLET_ACCOUNT = process.env.HOT_WALLET_ACCOUNT || "";
if (
  process.env.NODE_ENV !== "development" &&
  (!HOT_WALLET_ACCOUNT || HOT_WALLET_ACCOUNT.startsWith("GAXXX"))
) {
  console.error(
    "FATAL: HOT_WALLET_ACCOUNT is not set or is a placeholder. Set a valid Stellar account address.",
  );
  process.exit(1);
}
export const nonceManager = new NonceManager(
  HOT_WALLET_ACCOUNT,
  "https://horizon-testnet.stellar.org",
);

// We intentionally do not await initialization here so as not to block express startup,
// the nonceManager natively awaits itself inside getNonce if not initialized.

/**
 * @api {get} /health Health check endpoint
 * @apiDescription Returns the status and heartbeat of the automation engine.
 */
app.get("/health", async (req, res) => {
  const { httpStatus, body } = await getHealthResponse(startTime);
  res.status(httpStatus).json(body);
});

/**
 * @api {get} /metrics Metrics endpoint
 * @apiDescription Exports data on processed transactions, success rates, and latency in Prometheus format.
 */
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", metricsManager.register.contentType);
    res.end(await metricsManager.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

/**
 * @api {get} /secrets/status Vault secrets management status
 * @apiDescription Returns the status of the secrets management system.
 */
app.get("/secrets/status", async (req, res) => {
  const vaultHealthy = secretsBootstrap.isVaultHealthy();
  res.json({
    status: vaultHealthy ? "ok" : "degraded",
    vaultAvailable: vaultHealthy,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @api {post} /secrets/refresh Refresh secrets from Vault
 * @apiDescription Manually trigger a refresh of secrets from Vault.
 */
app.post("/secrets/refresh", async (req, res) => {
  try {
    await secretsBootstrap.refreshAllSecrets();
    res.json({
      status: "ok",
      message: "Secrets refreshed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Mock endpoint to simulate transaction processing for testing metrics
app.post("/test/simulate-tx", (req, res) => {
  const { status, latency } = req.body;
  metricsManager.trackTransaction(
    status || "success",
    latency || Math.random() * 2,
  );
  res.json({ message: "Transaction tracked" });
});

/**
 * @api {get} /scheduler/status Scheduler status endpoint
 * @apiDescription Returns the status of the payroll scheduler including active jobs.
 */
app.get("/scheduler/status", (req, res) => {
  const status = getSchedulerStatus();
  res.json({
    status: "ok",
    ...status,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @api {get} /monitor/status Treasury monitor status endpoint
 * @apiDescription Runs one monitor cycle. Protected by strict rate limiting and optional bearer token auth.
 */
app.get(
  "/monitor/status",
  strictRateLimiter,
  requireMonitorStatusAdminToken,
  async (req, res) => {
    try {
      const statuses = await runMonitorCycle();
      res.json({
        status: "ok",
        employers: statuses,
        timestamp: new Date().toISOString(),
      });
    } catch (ex: any) {
      res.status(500).json({ error: ex.message });
    }
  },
);

/**
 * @api {post} /test/concurrent-tx Simulated high-throughput endpoint
 * @apiDescription Requests 50 concurrent nonces to demonstrate the Nonce Manager bottleneck fix.
 */
app.post("/test/concurrent-tx", async (req, res) => {
  try {
    const start = Date.now();
    // Fire 50 simultaneous requests
    const promises = Array.from({ length: 50 }).map(() =>
      nonceManager.getNonce(),
    );

    // Await them all concurrently
    const nonces = await Promise.all(promises);
    const durationMs = Date.now() - start;

    metricsManager.trackTransaction("success", durationMs / 1000);

    res.json({
      status: "success",
      message: "Successfully generated 50 concurrent sequence numbers.",
      durationMs,
      nonces,
    });
  } catch (ex: any) {
    metricsManager.trackTransaction("failure", 0);
    res.status(500).json({ error: ex.message });
  }
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

/**
 * Main application startup function.
 * Ensures all services are initialized before accepting requests.
 */
async function main() {
  let auditLogger: ReturnType<typeof getAuditLogger>;

  try {
    // Initialize all services before starting the server
    auditLogger = await initializeServices();
    console.log("[Backend] ✅ Services initialized");

    // Add error logging middleware after initialization
    app.use(
      (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        if (auditLogger) {
          createErrorLoggingMiddleware(auditLogger)(err, req, res, next);
        } else {
          next(err);
        }
      },
    );

    // Start the server and only start background services after it's listening
    const server = app.listen(port, () => {
      console.log(
        `🚀 Quipay Automation Engine Status API listening at http://localhost:${port}`,
      );
    });

    // Start background services after server is listening
    startStellarListener();
    startScheduler();
    startMonitor();

    // Handle server errors
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[Backend] Port ${port} is already in use`);
        process.exit(1);
      }
      console.error("[Backend] Server error:", err);
      process.exit(1);
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (err) => {
      console.error("[Backend] Uncaught Exception:", err);
      if (auditLogger) {
        auditLogger.error("Uncaught exception", err, { action_type: "system" });
      }
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error(
        "[Backend] Unhandled Rejection at:",
        promise,
        "reason:",
        reason,
      );
      if (auditLogger) {
        auditLogger.error(
          "Unhandled rejection",
          reason instanceof Error ? reason : new Error(String(reason)),
          { action_type: "system" },
        );
      }
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("[Backend] SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        console.log("[Backend] HTTP server closed");
        if (auditLogger) {
          auditLogger.shutdown().then(() => {
            console.log("[Backend] Audit logger closed");
            process.exit(0);
          });
        } else {
          process.exit(0);
        }
      });
    });
  } catch (err) {
    console.error("[Backend] Failed to initialize services:", err);
    process.exit(1);
  }
}

// Start the application
main();
