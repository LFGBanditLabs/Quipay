/**
 * Audit Logger - Core Logging System
 *
 * Provides structured JSON logging for all automated actions in the backend agent.
 */

import {
  LogLevel,
  LogEntry,
  LogContext,
  AuditLoggerConfig,
  StreamCreationParams,
  ContractInteractionParams,
  SchedulerEventParams,
  MonitorEventParams,
  LogQueryFilters,
  ExportFilters,
} from "./types";
import { getPool } from "../db/pool";
import { RedactionEngine } from "./redactionEngine";
import { LogQueryService } from "./queryService";

/**
 * AuditLogger class - Core logging service
 */
export class AuditLogger {
  private minLogLevel: LogLevel;
  private writeQueue: LogEntry[] = [];
  private config: AuditLoggerConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private redactionEngine: RedactionEngine;
  private queryService: LogQueryService | null = null;

  constructor(config: AuditLoggerConfig) {
    this.config = config;
    this.minLogLevel = config.minLogLevel;
    this.redactionEngine = new RedactionEngine(config.redaction);

    // Initialize query service if database is available
    const pool = getPool();
    if (pool) {
      this.queryService = new LogQueryService(pool);
    }

    // Start periodic flush if async writes are enabled
    if (config.asyncWrites && config.flushIntervalMs > 0) {
      this.startPeriodicFlush();
    }
  }

  /**
   * Core logging method - logs a message with specified level and context
   */
  async log(
    level: LogLevel,
    message: string,
    context: LogContext,
  ): Promise<LogEntry> {
    // Check if log level meets minimum threshold
    if (!this.shouldLog(level)) {
      // Return a dummy entry but don't persist it
      return this.formatLogEntry({
        log_level: level,
        message,
        context,
        action_type: "system",
      });
    }

    const entry = this.formatLogEntry({
      log_level: level,
      message,
      context,
      action_type: context.action_type || "system",
    });

    // Validate JSON structure
    this.validateLogEntry(entry);

    // Enqueue for async write
    if (this.config.asyncWrites) {
      this.enqueueWrite(entry);
    }

    return entry;
  }

  /**
   * Log an INFO level message
   */
  async info(message: string, context: LogContext): Promise<LogEntry> {
    return this.log("INFO", message, context);
  }

  /**
   * Log a WARN level message
   */
  async warn(message: string, context: LogContext): Promise<LogEntry> {
    return this.log("WARN", message, context);
  }

  /**
   * Log an ERROR level message with error details
   */
  async error(
    message: string,
    error: Error,
    context: LogContext,
  ): Promise<LogEntry> {
    const errorContext = {
      ...context,
      error_message: error.message,
      error_code: (error as any).code,
      error_stack: error.stack,
    };

    const entry = await this.log("ERROR", message, errorContext);

    // Add error details to the entry
    entry.error_message = error.message;
    entry.error_code = (error as any).code;
    entry.error_stack = error.stack;

    return entry;
  }

  /**
   * Log stream creation event
   */
  async logStreamCreation(params: StreamCreationParams): Promise<void> {
    const level: LogLevel = params.success ? "INFO" : "ERROR";
    const message = params.success
      ? "Payroll stream created successfully"
      : "Payroll stream creation failed";

    const context: LogContext = {
      worker: params.worker,
      token: params.token,
      amount: params.amount,
      duration: params.duration,
      stream_id: params.streamId,
    };

    const entry = await this.log(level, message, context);
    entry.action_type = "stream_creation";
    entry.employer = params.employer;
    entry.transaction_hash = params.transactionHash;
    entry.block_number = params.blockNumber;

    if (!params.success && params.error) {
      entry.error_message = params.error.message;
      entry.error_stack = params.error.stack;
    }
  }

  /**
   * Log contract interaction event
   */
  async logContractInteraction(
    params: ContractInteractionParams,
  ): Promise<void> {
    const level: LogLevel = params.success ? "INFO" : "ERROR";
    const message = params.success
      ? "Contract interaction completed"
      : "Contract interaction failed";

    const context: LogContext = {
      contract_address: params.contractAddress,
      function_name: params.functionName,
      parameters: params.parameters,
      duration_ms: params.durationMs,
    };

    const entry = await this.log(level, message, context);
    entry.action_type = "contract_interaction";
    entry.employer = params.employer;
    entry.transaction_hash = params.transactionHash;
    entry.block_number = params.blockNumber;

    if (!params.success && params.error) {
      entry.error_message = params.error.message;
      entry.error_stack = params.error.stack;
    }
  }

  /**
   * Log scheduler event
   */
  async logSchedulerEvent(params: SchedulerEventParams): Promise<void> {
    const level: LogLevel = params.action === "task_failed" ? "ERROR" : "INFO";
    const message = `Scheduled task ${params.action.replace("_", " ")}`;

    const context: LogContext = {
      schedule_id: params.scheduleId,
      task_name: params.taskName,
      execution_time: params.executionTime,
    };

    const entry = await this.log(level, message, context);
    entry.action_type = "scheduling";
    entry.employer = params.employer;

    if (params.error) {
      entry.error_message = params.error.message;
      entry.error_stack = params.error.stack;
    }
  }

  /**
   * Log monitor event
   */
  async logMonitorEvent(params: MonitorEventParams): Promise<void> {
    const level: LogLevel = params.alertSent ? "WARN" : "INFO";
    const message = params.alertSent
      ? "Monitoring check detected issue"
      : "Monitoring check completed";

    const context: LogContext = {
      balance: params.balance,
      liabilities: params.liabilities,
      daily_burn_rate: params.dailyBurnRate,
      runway_days: params.runwayDays,
      alert_sent: params.alertSent,
      check_type: params.checkType,
    };

    const entry = await this.log(level, message, context);
    entry.action_type = "monitoring";
    entry.employer = params.employer;
  }

  /**
   * Query logs with filters
   */
  async query(filters: LogQueryFilters): Promise<LogEntry[]> {
    if (!this.queryService) {
      console.warn(
        "[AuditLogger] Query service not available (database not initialized)",
      );
      return [];
    }
    return this.queryService.query(filters);
  }

  /**
   * Export logs for an employer
   */
  async export(employerId: string, filters: ExportFilters): Promise<string> {
    if (!this.queryService) {
      console.warn(
        "[AuditLogger] Query service not available (database not initialized)",
      );
      return JSON.stringify([]);
    }
    return this.queryService.export(employerId, filters);
  }

  /**
   * Set minimum log level at runtime
   */
  setMinLogLevel(level: LogLevel): void {
    this.minLogLevel = level;
  }

  /**
   * Format a log entry with required fields
   */
  private formatLogEntry(entry: Partial<LogEntry>): LogEntry {
    const timestamp = entry.timestamp || new Date().toISOString();

    // Validate timestamp format
    if (!this.isValidISO8601(timestamp)) {
      console.warn("[AuditLogger] Invalid timestamp, using current time");
    }

    return {
      timestamp: this.isValidISO8601(timestamp)
        ? timestamp
        : new Date().toISOString(),
      log_level: this.isValidLogLevel(entry.log_level)
        ? entry.log_level!
        : "INFO",
      message: entry.message || "No message provided",
      action_type: entry.action_type || "system",
      context: entry.context || {},
      employer: entry.employer,
      transaction_hash: entry.transaction_hash,
      block_number: entry.block_number,
      error_message: entry.error_message,
      error_code: entry.error_code,
      error_stack: entry.error_stack,
    };
  }

  /**
   * Validate that a log entry is well-formed JSON
   */
  private validateLogEntry(entry: LogEntry): void {
    try {
      const serialized = JSON.stringify(entry);
      JSON.parse(serialized);
    } catch (error) {
      console.error("[AuditLogger] Invalid log entry JSON structure:", error);
      throw new Error("Log entry must be valid JSON");
    }
  }

  /**
   * Check if a log level should be logged based on minimum threshold
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["INFO", "WARN", "ERROR"];
    const minIndex = levels.indexOf(this.minLogLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Validate log level
   */
  private isValidLogLevel(level: any): level is LogLevel {
    return level === "INFO" || level === "WARN" || level === "ERROR";
  }

  /**
   * Validate ISO 8601 timestamp format
   */
  private isValidISO8601(timestamp: string): boolean {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return iso8601Regex.test(timestamp);
  }

  /**
   * Add log entry to write queue
   */
  private enqueueWrite(entry: LogEntry): void {
    // Apply redaction before adding to queue
    if (this.config.redaction.enabled) {
      entry.context = this.redactionEngine.redact(
        entry.context,
      ) as typeof entry.context;
      entry.message = this.redactionEngine.redact(entry.message) as string;

      if (entry.error_message) {
        entry.error_message = this.redactionEngine.redact(
          entry.error_message,
        ) as string;
      }
      if (entry.error_stack) {
        entry.error_stack = this.redactionEngine.redact(
          entry.error_stack,
        ) as string;
      }
    }

    if (this.writeQueue.length < this.config.maxQueueSize) {
      this.writeQueue.push(entry);
    } else {
      // Queue full - log to console as fallback
      console.error("[AuditLogger] Queue full, dropping entry:", entry);
    }
  }

  /**
   * Flush write queue to database
   */
  private async flushQueue(): Promise<void> {
    if (this.writeQueue.length === 0) return;

    const pool = getPool();
    if (!pool) {
      // Database not available - keep in queue or log to console
      console.warn(
        "[AuditLogger] Database not available, keeping entries in queue",
      );
      return;
    }

    // Take a snapshot of current queue and clear it
    const entriesToWrite = [...this.writeQueue];
    this.writeQueue = [];

    try {
      // Write all entries in a single transaction for performance
      await pool.query("BEGIN");

      for (const entry of entriesToWrite) {
        await this.writeToDatabase(entry);
      }

      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");

      // Put entries back in queue for retry
      this.writeQueue.unshift(...entriesToWrite);

      // If queue is too large, drop oldest entries
      if (this.writeQueue.length > this.config.maxQueueSize) {
        const dropped = this.writeQueue.splice(
          0,
          this.writeQueue.length - this.config.maxQueueSize,
        );
        console.error(
          `[AuditLogger] Queue overflow, dropped ${dropped.length} entries`,
        );
      }

      console.error("[AuditLogger] Failed to flush queue:", error);
    }
  }

  /**
   * Write a single log entry to the database
   */
  private async writeToDatabase(entry: LogEntry): Promise<void> {
    const pool = getPool();
    if (!pool) {
      throw new Error("Database pool not initialized");
    }

    const query = `
      INSERT INTO audit_logs (
        timestamp, log_level, message, action_type, employer,
        context, transaction_hash, block_number,
        error_message, error_code, error_stack
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    const values = [
      entry.timestamp,
      entry.log_level,
      entry.message,
      entry.action_type,
      entry.employer || null,
      JSON.stringify(entry.context),
      entry.transaction_hash || null,
      entry.block_number || null,
      entry.error_message || null,
      entry.error_code || null,
      entry.error_stack || null,
    ];

    await pool.query(query, values);
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        this.flushQueue().catch((err) => {
          console.error("[AuditLogger] Periodic flush error:", err);
        });
      }
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop periodic flush and flush remaining entries
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flushQueue();
  }
}
