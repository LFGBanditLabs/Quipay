/**
 * Tests for src/monitor/monitor.ts
 *
 * All DB + notifier dependencies are mocked.
 */

// ─── Mock DB pool ─────────────────────────────────────────────────────────────
jest.mock("../../src/db/pool", () => ({
  getPool: jest.fn(() => ({})), // simulate DB configured
}));

// ─── Mock query helpers ───────────────────────────────────────────────────────
jest.mock("../../src/db/queries", () => ({
  getTreasuryBalances: jest.fn(),
  getActiveLiabilities: jest.fn(),
  logMonitorEvent: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock notifier ────────────────────────────────────────────────────────────
jest.mock("../../src/notifier/notifier", () => ({
  sendTreasuryAlert: jest.fn().mockResolvedValue(undefined),
}));

import { getPool } from "../../src/db/pool";
import {
  getTreasuryBalances,
  getActiveLiabilities,
  logMonitorEvent,
} from "../../src/db/queries";
import { sendTreasuryAlert } from "../../src/notifier/notifier";
import {
  calculateRunwayDays,
  runMonitorCycle,
  computeTreasuryStatus,
} from "../../src/monitor/monitor";

const mockGetPool = getPool as jest.Mock;
const mockGetBalances = getTreasuryBalances as jest.Mock;
const mockGetLiabilities = getActiveLiabilities as jest.Mock;
const mockLogEvent = logMonitorEvent as jest.Mock;
const mockAlert = sendTreasuryAlert as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPool.mockReturnValue({}); // DB configured by default
  // Set default threshold to known value for tests
  process.env.TREASURY_ALERT_THRESHOLD = "5000000";
});

// ─── calculateRunwayDays ─────────────────────────────────────────────────────

describe("calculateRunwayDays", () => {
  it("returns null when there are no liabilities (unlimited runway)", () => {
    expect(calculateRunwayDays(10_000_000, 0)).toBeNull();
  });

  it("returns null when liabilities is negative (guard)", () => {
    expect(calculateRunwayDays(10_000_000, -100)).toBeNull();
  });

  it("calculates runway correctly", () => {
    // balance=3_000_000, liabilities=6_000_000, burn window=30 days
    // dailyBurn = 6_000_000 / 30 = 200_000 / day
    // runway    = 3_000_000 / 200_000 = 15 days
    process.env.MONITOR_BURN_WINDOW_DAYS = "30";
    const runway = calculateRunwayDays(3_000_000, 6_000_000);
    expect(runway).toBeCloseTo(15, 2);
  });

  it("returns 0 when balance is 0", () => {
    process.env.MONITOR_BURN_WINDOW_DAYS = "30";
    expect(calculateRunwayDays(0, 6_000_000)).toBe(0);
  });
});

// ─── computeTreasuryStatus ───────────────────────────────────────────────────

describe("computeTreasuryStatus", () => {
  it("merges balance and liability maps correctly", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_A", balance: "10000000" },
      { employer: "EMP_B", balance: "3000000" },
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_A", liabilities: "6000000" },
    ]);

    const results = await computeTreasuryStatus();
    expect(results).toHaveLength(2);

    const a = results.find((r) => r.employer === "EMP_A")!;
    expect(a.balance).toBe(10_000_000);
    expect(a.liabilities).toBe(6_000_000);
    expect(a.runway_days).not.toBeNull();

    const b = results.find((r) => r.employer === "EMP_B")!;
    expect(b.balance).toBe(3_000_000);
    expect(b.liabilities).toBe(0); // no active streams
    expect(b.runway_days).toBeNull();
  });

  it("handles employer with liabilities but no balance entry", async () => {
    mockGetBalances.mockResolvedValue([]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_C", liabilities: "5000000" },
    ]);

    const results = await computeTreasuryStatus();
    const c = results.find((r) => r.employer === "EMP_C")!;
    expect(c.balance).toBe(0);
    expect(c.liabilities).toBe(5_000_000);
  });
});

// ─── runMonitorCycle ─────────────────────────────────────────────────────────

describe("runMonitorCycle", () => {
  it("sends alert when balance is below threshold", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_LOW", balance: "1000000" }, // < 5_000_000 threshold
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_LOW", liabilities: "3000000" },
    ]);

    const statuses = await runMonitorCycle();

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith(
      "EMP_LOW",
      1_000_000,
      3_000_000,
      expect.any(Number),
      5_000_000,
    );
    expect(statuses[0].alert_sent).toBe(true);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ employer: "EMP_LOW", alertSent: true }),
    );
  });

  it("does NOT send alert when balance is at or above threshold", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_OK", balance: "10000000" }, // > 5_000_000 threshold
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_OK", liabilities: "3000000" },
    ]);

    const statuses = await runMonitorCycle();

    expect(mockAlert).not.toHaveBeenCalled();
    expect(statuses[0].alert_sent).toBe(false);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ employer: "EMP_OK", alertSent: false }),
    );
  });

  it("returns empty array when no employer data exists", async () => {
    mockGetBalances.mockResolvedValue([]);
    mockGetLiabilities.mockResolvedValue([]);

    const statuses = await runMonitorCycle();
    expect(statuses).toHaveLength(0);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("still logs even when alert delivery fails", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_ERR", balance: "500" }, // low balance triggers alert
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_ERR", liabilities: "2000000" },
    ]);
    mockAlert.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw
    await expect(runMonitorCycle()).resolves.toBeDefined();
    // Log should still be called
    expect(mockLogEvent).toHaveBeenCalled();
  });

  it("handles multiple employers correctly", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_1", balance: "2000000" }, // low → alert
      { employer: "EMP_2", balance: "20000000" }, // fine
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_1", liabilities: "5000000" },
      { employer: "EMP_2", liabilities: "5000000" },
    ]);

    const statuses = await runMonitorCycle();
    expect(statuses).toHaveLength(2);
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0][0]).toBe("EMP_1");
  });
});

// ─── startMonitor no-op when DB absent ──────────────────────────────────────

describe("startMonitor", () => {
  it("does not start when DB pool is not configured", async () => {
    mockGetPool.mockReturnValue(null);
    const { startMonitor } = await import("../../src/monitor/monitor");
    // Should complete without errors
    await expect(startMonitor()).resolves.toBeUndefined();
    // No monitor cycle should have run (no DB calls)
    expect(mockGetBalances).not.toHaveBeenCalled();
  });
});
