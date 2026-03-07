/**
 * Integration Tests for Analytics
 * Tests database queries and caching with real PostgreSQL
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
} from "@jest/globals";
import {
  setupTestDatabase,
  cleanTestDatabase,
  teardownTestDatabase,
  TestDatabase,
} from "../helpers/testcontainer";
import {
  upsertStream,
  recordWithdrawal,
  getOverallStats,
  getStreamsByEmployer,
  getStreamsByWorker,
  getAddressStats,
  getPayrollTrends,
} from "../../db/queries";
import { Pool } from "pg";

describe("Analytics Integration Tests", () => {
  let testDb: TestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    // Start PostgreSQL container and initialize db/pool module
    testDb = await setupTestDatabase();
    pool = testDb.getPool();
  }, 60000);

  afterEach(async () => {
    // Clean database between tests
    await cleanTestDatabase();
  });

  afterAll(async () => {
    // Stop container
    await teardownTestDatabase();
  }, 30000);

  describe("Stream Operations", () => {
    it("should insert and retrieve stream data", async () => {
      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: BigInt(1000000000), // 1000 USDC (7 decimals)
        withdrawnAmount: BigInt(0),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1000,
      });

      const result = await pool.query(
        "SELECT * FROM payroll_streams WHERE stream_id = $1",
        [1],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].employer).toBe("GEMPLOYER1");
      expect(result.rows[0].worker).toBe("GWORKER1");
      expect(result.rows[0].status).toBe("active");
      expect(result.rows[0].total_amount).toBe("1000000000");
    });

    it("should update existing stream on conflict", async () => {
      // Insert initial stream
      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: BigInt(1000000000),
        withdrawnAmount: BigInt(0),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1000,
      });

      // Update with withdrawal
      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: BigInt(1000000000),
        withdrawnAmount: BigInt(500000000),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1000,
      });

      const result = await pool.query(
        "SELECT * FROM payroll_streams WHERE stream_id = $1",
        [1],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].withdrawn_amount).toBe("500000000");
    });

    it("should record withdrawal events", async () => {
      // Create stream first
      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: BigInt(1000000000),
        withdrawnAmount: BigInt(0),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1000,
      });

      // Record withdrawal
      await recordWithdrawal({
        streamId: 1,
        worker: "GWORKER1",
        amount: BigInt(100000000),
        ledger: 1001,
        ledgerTs: Math.floor(Date.now() / 1000),
      });

      const result = await pool.query(
        "SELECT * FROM withdrawals WHERE stream_id = $1",
        [1],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].worker).toBe("GWORKER1");
      expect(result.rows[0].amount).toBe("100000000");
      expect(Number(result.rows[0].ledger)).toBe(1001);
    });
  });

  describe("Analytics Queries", () => {
    beforeEach(async () => {
      // Insert test data
      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: BigInt(1000000000),
        withdrawnAmount: BigInt(200000000),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1000,
      });

      await upsertStream({
        streamId: 2,
        employer: "GEMPLOYER1",
        worker: "GWORKER2",
        totalAmount: BigInt(2000000000),
        withdrawnAmount: BigInt(500000000),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 60,
        status: "active",
        ledger: 1001,
      });

      await upsertStream({
        streamId: 3,
        employer: "GEMPLOYER2",
        worker: "GWORKER3",
        totalAmount: BigInt(3000000000),
        withdrawnAmount: BigInt(3000000000),
        startTs: Math.floor(Date.now() / 1000) - 86400 * 30,
        endTs: Math.floor(Date.now() / 1000),
        status: "completed",
        ledger: 1002,
      });

      await upsertStream({
        streamId: 4,
        employer: "GEMPLOYER2",
        worker: "GWORKER4",
        totalAmount: BigInt(1500000000),
        withdrawnAmount: BigInt(0),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 15,
        status: "cancelled",
        closedAt: Math.floor(Date.now() / 1000),
        ledger: 1003,
      });
    });

    it("should calculate overall stats correctly", async () => {
      const stats = await getOverallStats();

      expect(stats.total_streams).toBe(4);
      expect(stats.active_streams).toBe(2);
      expect(stats.completed_streams).toBe(1);
      expect(stats.cancelled_streams).toBe(1);
      expect(stats.total_volume).toBe("7500000000");
      expect(stats.total_withdrawn).toBe("3700000000");
    });

    it("should filter streams by employer", async () => {
      const streams = await getStreamsByEmployer("GEMPLOYER1");

      expect(streams).toHaveLength(2);
      expect(streams[0].employer).toBe("GEMPLOYER1");
      expect(streams[1].employer).toBe("GEMPLOYER1");
    });

    it("should filter streams by worker", async () => {
      const streams = await getStreamsByWorker("GWORKER1");

      expect(streams).toHaveLength(1);
      expect(streams[0].worker).toBe("GWORKER1");
    });

    it("should filter streams by status", async () => {
      const activeStreams = await getStreamsByEmployer("GEMPLOYER1", "active");

      expect(activeStreams).toHaveLength(2);
      activeStreams.forEach((stream) => {
        expect(stream.status).toBe("active");
      });
    });

    it("should support pagination", async () => {
      const page1 = await getStreamsByEmployer("GEMPLOYER1", undefined, 1, 0);
      const page2 = await getStreamsByEmployer("GEMPLOYER1", undefined, 1, 1);

      expect(page1).toHaveLength(1);
      expect(page2).toHaveLength(1);
      expect(page1[0].stream_id).not.toBe(page2[0].stream_id);
    });

    it("should calculate address stats for employer", async () => {
      const stats = await getAddressStats("GEMPLOYER1");

      expect(stats.asEmployer.total_streams).toBe(2);
      expect(stats.asEmployer.active_streams).toBe(2);
      expect(stats.asEmployer.total_volume).toBe("3000000000");
      expect(stats.asEmployer.total_withdrawn).toBe("700000000");
    });

    it("should calculate address stats for worker", async () => {
      const stats = await getAddressStats("GWORKER1");

      expect(stats.asWorker.total_streams).toBe(1);
      expect(stats.asWorker.active_streams).toBe(1);
      expect(stats.asWorker.total_volume).toBe("1000000000");
      expect(stats.asWorker.total_withdrawn).toBe("200000000");
    });

    it("should include recent withdrawals in address stats", async () => {
      // Record some withdrawals
      await recordWithdrawal({
        streamId: 1,
        worker: "GWORKER1",
        amount: BigInt(100000000),
        ledger: 1004,
        ledgerTs: Math.floor(Date.now() / 1000),
      });

      await recordWithdrawal({
        streamId: 1,
        worker: "GWORKER1",
        amount: BigInt(100000000),
        ledger: 1005,
        ledgerTs: Math.floor(Date.now() / 1000),
      });

      const stats = await getAddressStats("GWORKER1");

      expect(stats.recentWithdrawals).toHaveLength(2);
      expect(stats.recentWithdrawals[0].worker).toBe("GWORKER1");
    });

    it("should generate payroll trends", async () => {
      const trends = await getPayrollTrends(null, "daily");

      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]).toHaveProperty("bucket");
      expect(trends[0]).toHaveProperty("volume");
      expect(trends[0]).toHaveProperty("stream_count");
    });

    it("should filter trends by address", async () => {
      const trends = await getPayrollTrends("GEMPLOYER1", "daily");

      expect(trends.length).toBeGreaterThan(0);
      // All streams should be from GEMPLOYER1
      const totalVolume = trends.reduce(
        (sum, t) => sum + BigInt(t.volume),
        BigInt(0),
      );
      expect(totalVolume).toBe(BigInt(3000000000));
    });
  });

  describe("Database Indexes", () => {
    it("should use index for employer queries", async () => {
      // Insert many streams
      for (let i = 0; i < 100; i++) {
        await upsertStream({
          streamId: i,
          employer: i < 50 ? "GEMPLOYER1" : "GEMPLOYER2",
          worker: `GWORKER${i}`,
          totalAmount: BigInt(1000000000),
          withdrawnAmount: BigInt(0),
          startTs: Math.floor(Date.now() / 1000),
          endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
          status: "active",
          ledger: 1000 + i,
        });
      }

      // Query with EXPLAIN to check index usage
      const result = await pool.query(
        "EXPLAIN SELECT * FROM payroll_streams WHERE employer = $1",
        ["GEMPLOYER1"],
      );

      const plan = result.rows.map((r) => r["QUERY PLAN"]).join("\n");
      expect(plan).toContain("Index");
    });

    it("should use index for worker queries", async () => {
      // Insert test data
      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: BigInt(1000000000),
        withdrawnAmount: BigInt(0),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1000,
      });

      const result = await pool.query(
        "EXPLAIN SELECT * FROM payroll_streams WHERE worker = $1",
        ["GWORKER1"],
      );

      const plan = result.rows.map((r) => r["QUERY PLAN"]).join("\n");
      expect(plan).toContain("Index");
    });
  });

  describe("Data Integrity", () => {
    it("should enforce foreign key constraint on withdrawals", async () => {
      // Try to insert withdrawal without stream
      await expect(
        recordWithdrawal({
          streamId: 999,
          worker: "GWORKER1",
          amount: BigInt(100000000),
          ledger: 1000,
          ledgerTs: Math.floor(Date.now() / 1000),
        }),
      ).rejects.toThrow();
    });

    it("should handle large numeric values correctly", async () => {
      const largeAmount = BigInt("999999999999999999"); // Max safe value

      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: largeAmount,
        withdrawnAmount: BigInt(0),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1000,
      });

      const result = await pool.query(
        "SELECT total_amount FROM payroll_streams WHERE stream_id = $1",
        [1],
      );

      expect(result.rows[0].total_amount).toBe(largeAmount.toString());
    });

    it("should maintain data consistency across updates", async () => {
      // Create stream
      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: BigInt(1000000000),
        withdrawnAmount: BigInt(0),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1000,
      });

      // Record withdrawal
      await recordWithdrawal({
        streamId: 1,
        worker: "GWORKER1",
        amount: BigInt(100000000),
        ledger: 1001,
        ledgerTs: Math.floor(Date.now() / 1000),
      });

      // Update stream with new withdrawn amount
      await upsertStream({
        streamId: 1,
        employer: "GEMPLOYER1",
        worker: "GWORKER1",
        totalAmount: BigInt(1000000000),
        withdrawnAmount: BigInt(100000000),
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 86400 * 30,
        status: "active",
        ledger: 1001,
      });

      // Verify consistency
      const streamResult = await pool.query(
        "SELECT withdrawn_amount FROM payroll_streams WHERE stream_id = $1",
        [1],
      );

      const withdrawalResult = await pool.query(
        "SELECT SUM(amount) as total FROM withdrawals WHERE stream_id = $1",
        [1],
      );

      expect(streamResult.rows[0].withdrawn_amount).toBe(
        withdrawalResult.rows[0].total,
      );
    });
  });
});
