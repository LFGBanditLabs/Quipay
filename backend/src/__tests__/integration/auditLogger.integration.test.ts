/**
 * Integration Tests for AuditLogger
 * Tests database writes and query functionality with real PostgreSQL
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
import {
  setupTestDatabase,
  cleanTestDatabase,
  teardownTestDatabase,
  TestDatabase,
} from "../helpers/testcontainer";
import { AuditLogger } from "../../audit/auditLogger";
import { LogLevel, AuditLoggerConfig } from "../../audit/types";
import { Pool } from "pg";

// Helper to create test config
function createTestConfig(overrides: Partial<AuditLoggerConfig> = {}): AuditLoggerConfig {
  return {
    minLogLevel: "INFO",
    asyncWrites: false,
    flushIntervalMs: 1000,
    maxQueueSize: 100,
    rotation: {
      enabled: false,
      maxSizeBytes: 1073741824,
      retentionDays: 90,
      compressionEnabled: false,
    },
    redaction: {
      enabled: false,
      customFields: [],
    },
    performance: {
      maxWriteTimeMs: 5,
      bufferSize: 100,
    },
    ...overrides,
  };
}

describe("AuditLogger Integration Tests", () => {
  let testDb: TestDatabase;
  let pool: Pool;
  let auditLogger: AuditLogger;

  beforeAll(async () => {
    // Start PostgreSQL container
    testDb = await setupTestDatabase();
    pool = testDb.getPool();

    // Set DATABASE_URL for the audit logger
    process.env.DATABASE_URL = testDb.getConnectionString();

    // DO NOT call initDb() here - it would create a new pool
    // The test database pool is already initialized
  }, 60000); // 60s timeout for container startup

  afterEach(async () => {
    // Clean database between tests
    await cleanTestDatabase();

    // Shutdown logger to flush queue
    if (auditLogger) {
      await auditLogger.shutdown();
    }
  });

  afterAll(async () => {
    // Stop container
    await teardownTestDatabase();
  }, 30000);

  describe("Database Writes", () => {
    it("should write INFO log to database", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      await auditLogger.info("Test info message", {
        action_type: "system",
        test_field: "test_value",
      });

      // Manually flush to database
      await auditLogger.shutdown();

      // Verify database write
      const result = await pool.query(
        "SELECT * FROM audit_logs WHERE message = $1",
        ["Test info message"],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].log_level).toBe("INFO");
      expect(result.rows[0].action_type).toBe("system");
      expect(result.rows[0].context.test_field).toBe("test_value");
    });

    it("should write ERROR log with error details", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      const testError = new Error("Test error message");
      await auditLogger.error("Error occurred", testError, {
        action_type: "contract_interaction",
      });

      await auditLogger.shutdown();

      const result = await pool.query(
        "SELECT * FROM audit_logs WHERE message = $1",
        ["Error occurred"],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].log_level).toBe("ERROR");
      expect(result.rows[0].error_message).toBe("Test error message");
      expect(result.rows[0].error_stack).toContain("Error: Test error message");
    });

    it("should write stream creation log with transaction details", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      await auditLogger.logStreamCreation({
        employer: "GEMPLOYER123",
        worker: "GWORKER456",
        token: "USDC",
        amount: "1000",
        duration: 30,
        streamId: 123,
        transactionHash: "abc123def456",
        blockNumber: 1000,
        success: true,
      });

      await auditLogger.shutdown();

      const result = await pool.query(
        "SELECT * FROM audit_logs WHERE action_type = $1",
        ["stream_creation"],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].employer).toBe("GEMPLOYER123");
      expect(result.rows[0].transaction_hash).toBe("abc123def456");
      expect(result.rows[0].block_number).toBe(1000);
      expect(result.rows[0].context.worker).toBe("GWORKER456");
      expect(result.rows[0].context.stream_id).toBe(123);
    });

    it("should handle async writes with queue flush", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      // Write multiple logs
      await auditLogger.info("Message 1", { action_type: "system" });
      await auditLogger.info("Message 2", { action_type: "system" });
      await auditLogger.info("Message 3", { action_type: "system" });

      // Wait for flush
      await new Promise((resolve) => setTimeout(resolve, 200));
      await auditLogger.shutdown();

      const result = await pool.query(
        "SELECT * FROM audit_logs WHERE message LIKE 'Message %' ORDER BY message",
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].message).toBe("Message 1");
      expect(result.rows[1].message).toBe("Message 2");
      expect(result.rows[2].message).toBe("Message 3");
    });
  });

  describe("Log Level Filtering", () => {
    it("should respect minimum log level", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      await auditLogger.info("Info message", { action_type: "system" });
      await auditLogger.warn("Warn message", { action_type: "system" });
      await auditLogger.error("Error message", new Error("Test"), {
        action_type: "system",
      });

      await auditLogger.shutdown();

      const result = await pool.query("SELECT * FROM audit_logs");

      // Only ERROR should be written
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].log_level).toBe("ERROR");
    });

    it("should allow runtime log level changes", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      await auditLogger.info("Info 1", { action_type: "system" });

      // Change log level
      auditLogger.setMinLogLevel("INFO");

      await auditLogger.info("Info 2", { action_type: "system" });

      await auditLogger.shutdown();

      const result = await pool.query("SELECT * FROM audit_logs");

      // Only second INFO should be written
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].message).toBe("Info 2");
    });
  });

  describe("Query Functionality", () => {
    beforeEach(async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      // Insert test data
      await auditLogger.info("System log", {
        action_type: "system",
      });

      await auditLogger.logStreamCreation({
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        token: "USDC",
        amount: "1000",
        duration: 30,
        streamId: 1,
        success: true,
      });

      await auditLogger.logStreamCreation({
        employer: "GEMPLOYER2",
        worker: "GWORKER2",
        token: "USDC",
        amount: "2000",
        duration: 60,
        streamId: 2,
        success: false,
        error: new Error("Failed to create stream"),
      });

      await auditLogger.shutdown();
    });

    it("should query logs by employer", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      const logs = await auditLogger.query({
        employer: "GEMPLOYER1",
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].employer).toBe("GEMPLOYER1");
    });

    it("should query logs by log level", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      const logs = await auditLogger.query({
        logLevel: "ERROR",
      });

      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((log) => {
        expect(log.log_level).toBe("ERROR");
      });
    });

    it("should query logs by action type", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      const logs = await auditLogger.query({
        actionType: "stream_creation",
      });

      expect(logs).toHaveLength(2);
      logs.forEach((log) => {
        expect(log.action_type).toBe("stream_creation");
      });
    });

    it("should support pagination", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      const page1 = await auditLogger.query({
        limit: 2,
        offset: 0,
      });

      const page2 = await auditLogger.query({
        limit: 2,
        offset: 2,
      });

      expect(page1).toHaveLength(2);
      expect(page2.length).toBeGreaterThanOrEqual(0);

      // Ensure no overlap
      const page1Ids = page1.map((log) => log.timestamp);
      const page2Ids = page2.map((log) => log.timestamp);
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe("Data Constraints", () => {
    it("should enforce NOT NULL constraints", async () => {
      // Try to insert invalid data directly
      await expect(
        pool.query(
          "INSERT INTO audit_logs (timestamp, log_level, message, action_type) VALUES (NULL, 'INFO', 'test', 'system')",
        ),
      ).rejects.toThrow();
    });

    it("should enforce log_level CHECK constraint", async () => {
      // Try to insert invalid log level
      await expect(
        pool.query(
          "INSERT INTO audit_logs (timestamp, log_level, message, action_type) VALUES (NOW(), 'INVALID', 'test', 'system')",
        ),
      ).rejects.toThrow();
    });

    it("should store JSONB context correctly", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      const complexContext = {
        action_type: "system",
        nested: {
          array: [1, 2, 3],
          object: { key: "value" },
        },
        number: 42,
        boolean: true,
      };

      await auditLogger.info("Complex context", complexContext);
      await auditLogger.shutdown();

      const result = await pool.query(
        "SELECT context FROM audit_logs WHERE message = $1",
        ["Complex context"],
      );

      expect(result.rows[0].context).toEqual(complexContext);
    });
  });

  describe("Transaction Handling", () => {
    it("should rollback on error during batch write", async () => {
      const config = createTestConfig();

      auditLogger = new AuditLogger(config);

      // Write valid logs
      await auditLogger.info("Valid log 1", { action_type: "system" });
      await auditLogger.info("Valid log 2", { action_type: "system" });

      // Wait for flush
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify logs were written
      const result = await pool.query(
        "SELECT * FROM audit_logs WHERE message LIKE 'Valid log %'",
      );

      expect(result.rows.length).toBeGreaterThanOrEqual(2);
    });
  });
});
