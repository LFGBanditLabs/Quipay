import { computeStreamTickerResult } from "../useStreamTicker";
import type { WorkerStream } from "../useStreams";

const makeStream = (overrides: Partial<WorkerStream> = {}): WorkerStream => ({
  id: "1",
  employerName: "Acme",
  employerAddress: "GEMPLOYER",
  flowRate: 1,
  tokenSymbol: "USDC",
  startTime: 1000,
  endTime: 2000,
  cliffTime: 0,
  totalAmount: 1000,
  claimedAmount: 0,
  status: 0,
  closedAt: 0,
  ...overrides,
});

describe("computeStreamTickerResult", () => {
  it("keeps active streams accruing and included in the live flow rate", () => {
    const result = computeStreamTickerResult([makeStream()], 1100);

    expect(result.snapshots[0].earned).toBe(100);
    expect(result.totalEarned).toBe(100);
    expect(result.totalFlowRate).toBe(1);
    expect(result.activeCount).toBe(1);
  });

  it("freezes cancelled streams at closedAt and excludes them from active totals", () => {
    const result = computeStreamTickerResult(
      [makeStream({ status: 1, closedAt: 1300 })],
      1800,
    );

    expect(result.snapshots[0].earned).toBe(300);
    expect(result.snapshots[0].progress).toBe(0.3);
    expect(result.totalEarned).toBe(300);
    expect(result.totalFlowRate).toBe(0);
    expect(result.activeCount).toBe(0);
  });

  it("freezes paused streams at closedAt and excludes them from active totals", () => {
    const result = computeStreamTickerResult(
      [makeStream({ status: 3, closedAt: 1250 })],
      1800,
    );

    expect(result.snapshots[0].earned).toBe(250);
    expect(result.snapshots[0].progress).toBe(0.25);
    expect(result.totalEarned).toBe(250);
    expect(result.totalFlowRate).toBe(0);
    expect(result.activeCount).toBe(0);
  });
});
