/**
 * Audit Logging System - Type Definitions
 * 
 * This module defines all TypeScript interfaces and types for the structured audit logging system.
 */

/**
 * Log severity levels
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

/**
 * Action types that can be logged
 */
export type ActionType = 
  | 'stream_creation' 
  | 'contract_interaction' 
  | 'monitoring' 
  | 'scheduling' 
  | 'system';

/**
 * Core log entry structure
 */
export interface LogEntry {
  id?: number;
  timestamp: string; // ISO 8601 format
  log_level: LogLevel;
  message: string;
  action_type: ActionType;
  employer?: string;
  context: LogContext;
  transaction_hash?: string;
  block_number?: number;
  error_message?: string;
  error_code?: string;
  error_stack?: string;
  created_at?: string;
}

/**
 * Context object containing metadata for log entries
 */
export interface LogContext {
  // Stream creation context
  worker?: string;
  token?: string;
  amount?: string;
  duration?: number;
  stream_id?: number;

  // Contract interaction context
  contract_address?: string;
  function_name?: string;
  parameters?: Record<string, unknown>;

  // Monitoring context
  balance?: number;
  liabilities?: number;
  runway_days?: number | null;
  daily_burn_rate?: number;
  alert_sent?: boolean;
  check_type?: 'routine' | 'triggered';

  // Scheduling context
  schedule_id?: number;
  cron_expression?: string;
  execution_time?: number;
  task_name?: string;

  // Performance metrics
  duration_ms?: number;
  status_code?: number;
  result?: unknown;

  // Additional metadata
  [key: string]: unknown;
}

/**
 * Parameters for logging stream creation events
 */
export interface StreamCreationParams {
  employer: string;
  worker: string;
  token: string;
  amount: string;
  duration: number;
  streamId?: number;
  transactionHash?: string;
  blockNumber?: number;
  success: boolean;
  error?: Error;
}

/**
 * Parameters for logging contract interaction events
 */
export interface ContractInteractionParams {
  contractAddress: string;
  functionName: string;
  parameters: Record<string, unknown>;
  employer?: string;
  transactionHash?: string;
  blockNumber?: number;
  success: boolean;
  durationMs: number;
  error?: Error;
}

/**
 * Scheduler event actions
 */
export type SchedulerAction = 'task_started' | 'task_completed' | 'task_failed';

/**
 * Parameters for logging scheduler events
 */
export interface SchedulerEventParams {
  scheduleId: number;
  action: SchedulerAction;
  taskName: string;
  employer?: string;
  executionTime?: number;
  error?: Error;
}

/**
 * Parameters for logging monitor events
 */
export interface MonitorEventParams {
  employer: string;
  balance: number;
  liabilities: number;
  dailyBurnRate: number;
  runwayDays: number | null;
  alertSent: boolean;
  checkType: 'routine' | 'triggered';
}

/**
 * Configuration for the audit logger
 */
export interface AuditLoggerConfig {
  minLogLevel: LogLevel;
  asyncWrites: boolean;
  maxQueueSize: number;
  flushIntervalMs: number;
  rotation: RotationConfig;
  redaction: RedactionConfig;
  performance: PerformanceConfig;
}

/**
 * Log rotation configuration
 */
export interface RotationConfig {
  enabled: boolean;
  maxSizeBytes: number;
  retentionDays: number;
  compressionEnabled: boolean;
}

/**
 * Redaction configuration
 */
export interface RedactionConfig {
  enabled: boolean;
  customFields: string[];
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  maxWriteTimeMs: number;
  bufferSize: number;
}

/**
 * Filters for querying logs
 */
export interface LogQueryFilters {
  startDate?: Date;
  endDate?: Date;
  logLevel?: LogLevel;
  employer?: string;
  actionType?: ActionType;
  limit?: number;
  offset?: number;
}

/**
 * Filters for exporting logs
 */
export interface ExportFilters extends LogQueryFilters {
  format?: 'json' | 'csv';
}
