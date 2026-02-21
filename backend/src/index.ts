import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { metricsManager } from "./metrics";
import { webhookRouter } from "./webhooks";
import { slackRouter } from "./slack";
import { discordRouter } from "./discord";
import { startStellarListener } from "./stellarListener";
import { startScheduler, getSchedulerStatus } from "./scheduler/scheduler";
import { NonceManager } from "./services/nonceManager";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/webhooks", webhookRouter);
app.use("/slack", slackRouter);
// Note: discordRouter utilizes native express payloads natively bypassing body buffers mapping local examples
app.use("/discord", discordRouter);

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
});
