import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { metricsManager } from "./metrics";
import { webhookRouter } from "./webhooks";
import { slackRouter } from "./slack";
import { discordRouter } from "./discord";
import { aiRouter } from "./ai"; // Added aiRouter import
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

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database and audit logger
async function initializeServices() {
  await initDb();
  const auditLogger = initAuditLogger();

  // Add audit logging middleware for contract interactions
  app.use(createLoggingMiddleware(auditLogger));

  return auditLogger;
}

// Initialize services before starting routes
let auditLogger: ReturnType<typeof getAuditLogger>;
initializeServices()
  .then((logger) => {
    auditLogger = logger;
    console.log("[Backend] ✅ Services initialized");
  })
  .catch((err) => {
    console.error("[Backend] Failed to initialize services:", err);
  });

app.use("/webhooks", webhookRouter);
app.use("/slack", slackRouter);
// Note: discordRouter utilizes native express payloads natively bypassing body buffers mapping local examples
app.use("/discord", discordRouter);
app.use("/ai", aiRouter); // Added aiRouter use

// Error logging middleware (should be after routes)
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

// Start time for uptime calculation
const startTime = Date.now();

// Default testing account (Note: in production, each employer/caller would have their own or share a global treasury sequence pool)
const HOT_WALLET_ACCOUNT =
  process.env.HOT_WALLET_ACCOUNT ||
  "GAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
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
app.get("/health", (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    status: "ok",
    uptime: `${uptime}s`,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.0.1",
    service: "quipay-automation-engine",
  });
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
 * @apiDescription Returns the current treasury health status for all employers.
 */
app.get("/monitor/status", async (req, res) => {
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
});

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

app.listen(port, () => {
  console.log(
    `🚀 Quipay Automation Engine Status API listening at http://localhost:${port}`,
  );
  startStellarListener();
  startScheduler();
  startMonitor();
});
