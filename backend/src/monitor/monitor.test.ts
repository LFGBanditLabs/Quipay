/**
 * Tests for src/monitor/monitor.ts
 *
 * All DB + notifier dependencies are mocked.
 */

process.env.TREASURY_RUNWAY_ALERT_DAYS = "7";

// ─── Mock DB pool ─────────────────────────────────────────────────────────────
jest.mock("../db/pool", () => ({
  getPool: jest.fn(() => ({})), // simulate DB configured
}));

jest.mock("../utils/lock", () => ({
  withAdvisoryLock: jest.fn(async (_lockId, fn) => {
    await fn();
  }),
}));

// ─── Mock query helpers ───────────────────────────────────────────────────────
jest.mock("../db/queries", () => ({
  getTreasuryBalances: jest.fn(),
  getActiveLiabilities: jest.fn(),
  getStreamsByEmployer: jest.fn(),
  logMonitorEvent: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock notifier ────────────────────────────────────────────────────────────
jest.mock("../notifier/notifier", () => ({
  sendTreasuryAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../audit/init", () => ({
  getAuditLogger: jest.fn(() => ({
    logMonitorEvent: jest.fn().mockResolvedValue(undefined),
  })),
  isAuditLoggerInitialized: jest.fn(() => false),
}));

jest.mock("../audit/serviceLogger", () => ({
  serviceLogger: {
    info: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
  },
}));

import { getPool } from "../db/pool";
import {
  getTreasuryBalances,
  getActiveLiabilities,
  getStreamsByEmployer,
  logMonitorEvent,
} from "../db/queries";
import { sendTreasuryAlert } from "../notifier/notifier";
import { serviceLogger } from "../audit/serviceLogger";
import {
  calculateDailyBurnRate,
  calculateRunwayDays,
  runMonitorCycle,
  computeTreasuryStatus,
  startMonitor,
} from "./monitor";

const mockGetPool = getPool as jest.Mock;
const mockGetBalances = getTreasuryBalances as jest.Mock;
const mockGetLiabilities = getActiveLiabilities as jest.Mock;
const mockGetStreamsByEmployer = getStreamsByEmployer as jest.Mock;
const mockLogEvent = logMonitorEvent as jest.Mock;
const mockAlert = sendTreasuryAlert as jest.Mock;
const mockServiceLogger = serviceLogger as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

const fixedNowSeconds = 1_700_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPool.mockReturnValue({}); // DB configured by default
  mockGetStreamsByEmployer.mockResolvedValue([]);
  jest.spyOn(Date, "now").mockReturnValue(fixedNowSeconds * 1000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── calculateDailyBurnRate ──────────────────────────────────────────────────

describe("calculateDailyBurnRate", () => {
  it("computes daily burn from remaining amount and remaining duration", () => {
    const burnRate = calculateDailyBurnRate([
      {
        total_amount: 2_000_000,
        withdrawn_amount: 1_000_000,
        start_ts: fixedNowSeconds - 1_000,
        end_ts: fixedNowSeconds + 86_400,
      },
    ]);

    expect(burnRate).toBeCloseTo(1_000_000, 4);
  });
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
    const runway = calculateRunwayDays(3_000_000, 200_000);
    expect(runway).toBeCloseTo(15, 2);
  });

  it("returns 0 when balance is 0", () => {
    expect(calculateRunwayDays(0, 200_000)).toBe(0);
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
    mockGetStreamsByEmployer
      .mockResolvedValueOnce([
        {
          total_amount: "1000000",
          withdrawn_amount: "0",
          start_ts: fixedNowSeconds - 100,
          end_ts: fixedNowSeconds + 86_400,
        },
      ])
      .mockResolvedValueOnce([]);

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
    mockGetStreamsByEmployer.mockResolvedValue([
      {
        total_amount: "5000000",
        withdrawn_amount: "0",
        start_ts: fixedNowSeconds - 100,
        end_ts: fixedNowSeconds + 86_400,
      },
    ]);

    const results = await computeTreasuryStatus();
    const c = results.find((r) => r.employer === "EMP_C")!;
    expect(c.balance).toBe(0);
    expect(c.liabilities).toBe(5_000_000);
  });
});

// ─── runMonitorCycle ─────────────────────────────────────────────────────────

describe("runMonitorCycle", () => {
  it("sends alert and logs a warning when runway is below threshold", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_LOW", balance: "1000000" },
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_LOW", liabilities: "1000000" },
    ]);
    mockGetStreamsByEmployer.mockResolvedValue([
      {
        total_amount: "1000000",
        withdrawn_amount: "0",
        start_ts: fixedNowSeconds - 100,
        end_ts: fixedNowSeconds + 86_400,
      },
    ]);

    const statuses = await runMonitorCycle();

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        employer: "EMP_LOW",
        balance: 1_000_000,
        liabilities: 1_000_000,
        alertThresholdDays: 7,
      }),
    );
    expect(statuses[0].alert_sent).toBe(true);
    expect(mockServiceLogger.warn).toHaveBeenCalledWith(
      "Monitor",
      "Employer runway below threshold",
      expect.objectContaining({
        employer: "EMP_LOW",
        alert_threshold_days: 7,
      }),
    );
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ employer: "EMP_LOW", alertSent: true }),
    );
  });

  it("does NOT send alert when runway is at or above threshold", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_OK", balance: "10000000" },
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_OK", liabilities: "1000000" },
    ]);
    mockGetStreamsByEmployer.mockResolvedValue([
      {
        total_amount: "1000000",
        withdrawn_amount: "0",
        start_ts: fixedNowSeconds - 100,
        end_ts: fixedNowSeconds + 864_000,
      },
    ]);

    const statuses = await runMonitorCycle();

    expect(mockAlert).not.toHaveBeenCalled();
    expect(statuses[0].alert_sent).toBe(false);
    expect(mockServiceLogger.warn).not.toHaveBeenCalled();
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
    expect(mockServiceLogger.info).toHaveBeenCalledWith(
      "Monitor",
      "No employer treasury data found",
    );
  });

  it("still logs even when alert delivery fails", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_ERR", balance: "500" },
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_ERR", liabilities: "2000000" },
    ]);
    mockGetStreamsByEmployer.mockResolvedValue([
      {
        total_amount: "2000000",
        withdrawn_amount: "0",
        start_ts: fixedNowSeconds - 100,
        end_ts: fixedNowSeconds + 86_400,
      },
    ]);
    mockAlert.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw
    await expect(runMonitorCycle()).resolves.toBeDefined();
    // Log should still be called
    expect(mockLogEvent).toHaveBeenCalled();
    expect(mockServiceLogger.error).toHaveBeenCalledWith(
      "Monitor",
      "Alert delivery failed",
      expect.any(Error),
      expect.objectContaining({ employer: "EMP_ERR" }),
    );
  });

  it("handles multiple employers correctly", async () => {
    mockGetBalances.mockResolvedValue([
      { employer: "EMP_1", balance: "2000000" },
      { employer: "EMP_2", balance: "20000000" },
    ]);
    mockGetLiabilities.mockResolvedValue([
      { employer: "EMP_1", liabilities: "5000000" },
      { employer: "EMP_2", liabilities: "5000000" },
    ]);
    mockGetStreamsByEmployer
      .mockResolvedValueOnce([
        {
          total_amount: "5000000",
          withdrawn_amount: "0",
          start_ts: fixedNowSeconds - 100,
          end_ts: fixedNowSeconds + 86_400,
        },
      ])
      .mockResolvedValueOnce([
        {
          total_amount: "5000000",
          withdrawn_amount: "0",
          start_ts: fixedNowSeconds - 100,
          end_ts: fixedNowSeconds + 2_592_000,
        },
      ]);

    const statuses = await runMonitorCycle();
    expect(statuses).toHaveLength(2);
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0][0].employer).toBe("EMP_1");
  });
});

// ─── startMonitor no-op when DB absent ──────────────────────────────────────

describe("startMonitor", () => {
  it("does not start when DB pool is not configured", async () => {
    mockGetPool.mockReturnValue(null);
    // Should complete without errors
    await expect(startMonitor()).resolves.toBeUndefined();
    // No monitor cycle should have run (no DB calls)
    expect(mockGetBalances).not.toHaveBeenCalled();
    expect(mockServiceLogger.warn).toHaveBeenCalledWith(
      "Monitor",
      "Database not configured — treasury monitor disabled",
    );
  });
});
