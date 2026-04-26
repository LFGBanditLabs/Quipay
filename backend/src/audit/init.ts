/**
 * Audit Logger Initialization
 *
 * Singleton instance of the audit logger for use throughout the application.
 */

import { AuditLogger } from "./auditLogger";
import { loadConfig } from "./config";

let auditLoggerInstance: AuditLogger | null = null;

/**
 * Initialize the audit logger (call once at application startup)
 */
export function initAuditLogger(): AuditLogger {
  if (auditLoggerInstance) {
    console.warn(
      "[AuditLogger] Already initialized, returning existing instance",
    );
    return auditLoggerInstance;
  }

  const config = loadConfig();
  auditLoggerInstance = new AuditLogger(config);

  console.log("[AuditLogger] ✅ Initialized with config:", {
    minLogLevel: config.minLogLevel,
    asyncWrites: config.asyncWrites,
    redactionEnabled: config.redaction.enabled,
  });

  return auditLoggerInstance;
}

/**
 * Get the audit logger instance (must be initialized first)
 */
export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    throw new Error(
      "AuditLogger not initialized. Call initAuditLogger() first.",
    );
  }
  return auditLoggerInstance;
}

/**
 * Check if audit logger is initialized
 */
export function isAuditLoggerInitialized(): boolean {
  return auditLoggerInstance !== null;
}
