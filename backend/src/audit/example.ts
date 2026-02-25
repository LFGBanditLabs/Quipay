/**
 * Audit Logger Usage Example
 *
 * This file demonstrates how to integrate the audit logger into your services.
 */

import { AuditLogger, loadConfig } from "./index";

// Initialize the audit logger (typically done once at application startup)
const config = loadConfig();
const auditLogger = new AuditLogger(config);

/**
 * Example: Logging a stream creation event
 */
export async function exampleStreamCreation() {
  try {
    // Your stream creation logic here...
    const streamId = 123;
    const transactionHash = "0xabc...";
    const blockNumber = 456789;

    // Log successful stream creation
    await auditLogger.logStreamCreation({
      employer: "GEMPLOYER...",
      worker: "GWORKER...",
      token: "USDC",
      amount: "1000",
      duration: 30,
      streamId,
      transactionHash,
      blockNumber,
      success: true,
    });
  } catch (error) {
    // Log failed stream creation
    await auditLogger.logStreamCreation({
      employer: "GEMPLOYER...",
      worker: "GWORKER...",
      token: "USDC",
      amount: "1000",
      duration: 30,
      success: false,
      error: error as Error,
    });
  }
}

/**
 * Example: Logging a contract interaction
 */
export async function exampleContractInteraction() {
  const startTime = Date.now();

  try {
    // Your contract interaction logic here...
    const result = await callContract();

    const durationMs = Date.now() - startTime;

    // Log successful interaction
    await auditLogger.logContractInteraction({
      contractAddress: "CCONTRACT...",
      functionName: "transfer",
      parameters: { to: "GWORKER...", amount: "100" },
      employer: "GEMPLOYER...",
      transactionHash: "0xdef...",
      blockNumber: 456790,
      success: true,
      durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Log failed interaction
    await auditLogger.logContractInteraction({
      contractAddress: "CCONTRACT...",
      functionName: "transfer",
      parameters: { to: "GWORKER...", amount: "100" },
      success: false,
      durationMs,
      error: error as Error,
    });
  }
}

/**
 * Example: Logging a scheduler event
 */
export async function exampleSchedulerEvent() {
  const scheduleId = 456;
  const startTime = Date.now();

  // Log task started
  await auditLogger.logSchedulerEvent({
    scheduleId,
    action: "task_started",
    taskName: "monthly-payroll",
    employer: "GEMPLOYER...",
  });

  try {
    // Your scheduled task logic here...
    await runScheduledTask();

    const executionTime = Date.now() - startTime;

    // Log task completed
    await auditLogger.logSchedulerEvent({
      scheduleId,
      action: "task_completed",
      taskName: "monthly-payroll",
      employer: "GEMPLOYER...",
      executionTime,
    });
  } catch (error) {
    // Log task failed
    await auditLogger.logSchedulerEvent({
      scheduleId,
      action: "task_failed",
      taskName: "monthly-payroll",
      employer: "GEMPLOYER...",
      error: error as Error,
    });
  }
}

/**
 * Example: Logging a monitor event
 */
export async function exampleMonitorEvent() {
  const balance = 10000;
  const liabilities = 8000;
  const dailyBurnRate = 500;
  const runwayDays = (balance - liabilities) / dailyBurnRate;

  const alertSent = runwayDays < 7;

  await auditLogger.logMonitorEvent({
    employer: "GEMPLOYER...",
    balance,
    liabilities,
    dailyBurnRate,
    runwayDays,
    alertSent,
    checkType: "routine",
  });
}

/**
 * Example: Querying logs
 */
export async function exampleQueryLogs() {
  // Query all ERROR logs for an employer
  const errorLogs = await auditLogger.query({
    employer: "GEMPLOYER...",
    logLevel: "ERROR",
    limit: 100,
  });

  console.log(`Found ${errorLogs.length} error logs`);

  // Query logs within a date range
  const recentLogs = await auditLogger.query({
    startDate: new Date("2024-02-01"),
    endDate: new Date("2024-02-28"),
    actionType: "stream_creation",
  });

  console.log(`Found ${recentLogs.length} stream creation logs in February`);
}

/**
 * Example: Exporting logs
 */
export async function exampleExportLogs() {
  // Export as JSON
  const jsonExport = await auditLogger.export("GEMPLOYER...", {
    format: "json",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
  });

  console.log("JSON export:", jsonExport);

  // Export as CSV
  const csvExport = await auditLogger.export("GEMPLOYER...", {
    format: "csv",
    logLevel: "WARN",
  });

  console.log("CSV export:", csvExport);
}

/**
 * Example: Runtime log level adjustment
 */
export function exampleLogLevelAdjustment() {
  // Set to WARN to reduce verbosity
  auditLogger.setMinLogLevel("WARN");

  // INFO logs will no longer be recorded
  auditLogger.info("This will not be logged", {});

  // WARN and ERROR logs will still be recorded
  auditLogger.warn("This will be logged", {});
}

/**
 * Example: Graceful shutdown
 */
export async function exampleShutdown() {
  // Flush remaining logs before shutdown
  await auditLogger.shutdown();
  console.log("Audit logger shut down gracefully");
}

// Placeholder functions for examples
async function callContract() {
  return { success: true };
}

async function runScheduledTask() {
  return { success: true };
}

// Export the singleton logger instance
export { auditLogger };
