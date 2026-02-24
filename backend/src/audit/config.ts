/**
 * Audit Logger Configuration
 * 
 * Loads configuration from environment variables with sensible defaults.
 */

import { AuditLoggerConfig, LogLevel } from './types';

/**
 * Parse log level from string, with fallback to INFO
 */
function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) return 'INFO';
  
  const upper = value.toUpperCase();
  if (upper === 'INFO' || upper === 'WARN' || upper === 'ERROR') {
    return upper as LogLevel;
  }
  
  console.warn(`[AuditLogger] Invalid LOG_LEVEL "${value}", defaulting to INFO`);
  return 'INFO';
}

/**
 * Parse integer from environment variable with fallback
 */
function parseInteger(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    console.warn(`[AuditLogger] Invalid integer value "${value}", using default ${defaultValue}`);
    return defaultValue;
  }
  
  return parsed;
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  
  const lower = value.toLowerCase();
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false;
  }
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true;
  }
  
  return defaultValue;
}

/**
 * Load audit logger configuration from environment variables
 */
export function loadConfig(): AuditLoggerConfig {
  const config: AuditLoggerConfig = {
    minLogLevel: parseLogLevel(process.env.LOG_LEVEL),
    asyncWrites: parseBoolean(process.env.LOG_ASYNC_WRITES, true),
    maxQueueSize: parseInteger(process.env.LOG_QUEUE_SIZE, 1000),
    flushIntervalMs: parseInteger(process.env.LOG_FLUSH_INTERVAL, 1000),
    rotation: {
      enabled: parseBoolean(process.env.LOG_ROTATION_ENABLED, true),
      maxSizeBytes: parseInteger(process.env.LOG_MAX_SIZE, 1073741824), // 1GB default
      retentionDays: parseInteger(process.env.LOG_RETENTION_DAYS, 90),
      compressionEnabled: parseBoolean(process.env.LOG_COMPRESSION, true),
    },
    redaction: {
      enabled: parseBoolean(process.env.LOG_REDACTION_ENABLED, true),
      customFields: (process.env.LOG_REDACT_FIELDS || '')
        .split(',')
        .map(f => f.trim())
        .filter(Boolean),
    },
    performance: {
      maxWriteTimeMs: parseInteger(process.env.LOG_MAX_WRITE_TIME, 5),
      bufferSize: parseInteger(process.env.LOG_BUFFER_SIZE, 100),
    },
  };

  // Validate queue size
  if (config.maxQueueSize < 1) {
    console.warn('[AuditLogger] maxQueueSize must be at least 1, using default 1000');
    config.maxQueueSize = 1000;
  }

  // Validate flush interval
  if (config.flushIntervalMs < 100) {
    console.warn('[AuditLogger] flushIntervalMs must be at least 100ms, using default 1000ms');
    config.flushIntervalMs = 1000;
  }

  return config;
}

/**
 * Get default configuration (useful for testing)
 */
export function getDefaultConfig(): AuditLoggerConfig {
  return {
    minLogLevel: 'INFO',
    asyncWrites: true,
    maxQueueSize: 1000,
    flushIntervalMs: 1000,
    rotation: {
      enabled: true,
      maxSizeBytes: 1073741824, // 1GB
      retentionDays: 90,
      compressionEnabled: true,
    },
    redaction: {
      enabled: true,
      customFields: [],
    },
    performance: {
      maxWriteTimeMs: 5,
      bufferSize: 100,
    },
  };
}
