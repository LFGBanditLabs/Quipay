import {
  computeStreamEarning,
  computeEarningsBreakdown,
} from "../useRealTimeEarnings";
import type { WorkerStream } from "../useStreams";

/** Builds a WorkerStream with sensible defaults, overridable per-test. */
const makeStream = (overrides: Partial<WorkerStream> = {}): WorkerStream => ({
  id: "1",
  employerName: "Acme",
  employerAddress: "GEMPLOYER",
  flowRate: 1, // 1 token unit per second
  tokenSymbol: "USDC",
  startTime: 1000,
  endTime: 1_000_000,
  cliffTime: 0,
  totalAmount: 1_000_000,
  claimedAmount: 0,
  status: 0,
  ...overrides,
});

describe("computeStreamEarning (per-stream cliff math)", () => {
  it("(a) before cliff: vests but is not withdrawable, flagged cliffLocked", () => {
    const stream = makeStream({ startTime: 1000, cliffTime: 2000 });
    const now = 1500; // 500s after start, 500s before cliff

    const result = computeStreamEarning(stream, now);

    expect(result.vesting).toBe(500); // 500s * flowRate 1
    expect(result.withdrawable).toBe(0); // locked by cliff
    expect(result.cliffLocked).toBe(true);
    expect(result.secondsUntilCliff).toBe(500);
  });

  it("(b) exactly at cliff: withdrawable equals vesting (inclusive >= gate)", () => {
    const stream = makeStream({ startTime: 1000, cliffTime: 2000 });
    const now = 2000; // now === cliffTime

    const result = computeStreamEarning(stream, now);

    expect(result.vesting).toBe(1000); // 1000s elapsed
    expect(result.withdrawable).toBe(1000); // unlocked at the exact cliff moment
    expect(result.cliffLocked).toBe(false);
    expect(result.secondsUntilCliff).toBe(0);
  });

  it("(c) after cliff: withdrawable equals vesting", () => {
    const stream = makeStream({ startTime: 1000, cliffTime: 2000 });
    const now = 2500; // 1500s after start, 500s after cliff

    const result = computeStreamEarning(stream, now);

    expect(result.vesting).toBe(1500);
    expect(result.withdrawable).toBe(1500);
    expect(result.cliffLocked).toBe(false);
    expect(result.secondsUntilCliff).toBe(0);
  });

  it("(d) cliffTime === 0 means no cliff: withdrawable from startTime", () => {
    const stream = makeStream({ startTime: 1000, cliffTime: 0 });
    const now = 1500;

    const result = computeStreamEarning(stream, now);

    expect(result.vesting).toBe(500);
    expect(result.withdrawable).toBe(500); // immediately withdrawable
    expect(result.cliffLocked).toBe(false);
    expect(result.secondsUntilCliff).toBe(0);
  });

  it("just before cliff (one second short) is still locked", () => {
    const stream = makeStream({ startTime: 1000, cliffTime: 2000 });

    const result = computeStreamEarning(stream, 1999.5);

    expect(result.withdrawable).toBe(0);
    expect(result.cliffLocked).toBe(true);
    expect(result.secondsUntilCliff).toBe(1); // ceil(0.5)
  });

  it("caps vesting and withdrawable at totalAmount", () => {
    const stream = makeStream({
      startTime: 1000,
      cliffTime: 0,
      totalAmount: 100,
    });

    const result = computeStreamEarning(stream, 5000); // would exceed cap

    expect(result.vesting).toBe(100);
    expect(result.withdrawable).toBe(100);
  });

  it("clamps elapsed to 0 before startTime", () => {
    const stream = makeStream({ startTime: 2000, cliffTime: 0 });

    const result = computeStreamEarning(stream, 1000); // before start

    expect(result.vesting).toBe(0);
    expect(result.withdrawable).toBe(0);
  });
});

describe("computeEarningsBreakdown (multi-stream aggregation)", () => {
  it("(e) buckets each stream independently then sums vesting/withdrawable", () => {
    const now = 1_000_000;

    const streams: WorkerStream[] = [
      // Unlocked (no cliff): vests + withdrawable.
      makeStream({
        id: "unlocked",
        startTime: now - 100,
        cliffTime: 0,
        flowRate: 1,
      }),
      // Locked by cliff: vests but NOT withdrawable.
      makeStream({
        id: "locked",
        startTime: now - 200,
        cliffTime: now + 1000,
        flowRate: 1,
      }),
      // Past-cliff: vests + withdrawable.
      makeStream({
        id: "past",
        startTime: now - 300,
        cliffTime: now - 50,
        flowRate: 1,
      }),
    ];

    const snap = computeEarningsBreakdown(streams, now);

    // Vesting sums ALL streams: 100 + 200 + 300.
    expect(snap.totalVesting).toBe(600);
    // Withdrawable excludes the cliff-locked stream: 100 + 300.
    expect(snap.totalWithdrawable).toBe(400);
    // Back-compat alias mirrors vesting.
    expect(snap.totalEarned).toBe(600);
    expect(snap.activeStreamsCount).toBe(3);

    const locked = snap.streamEarned.find((s) => s.id === "locked")!;
    expect(locked.vesting).toBe(200);
    expect(locked.withdrawable).toBe(0);
    expect(locked.cliffLocked).toBe(true);
    expect(locked.secondsUntilCliff).toBe(1000);

    const unlocked = snap.streamEarned.find((s) => s.id === "unlocked")!;
    expect(unlocked.withdrawable).toBe(100);
    expect(unlocked.cliffLocked).toBe(false);
  });

  it("withdrawable jumps from 0 to vesting exactly at the cliff moment", () => {
    const cliff = 1_000_000;
    const stream = makeStream({
      id: "soon",
      startTime: cliff - 10,
      cliffTime: cliff,
      flowRate: 1,
    });

    // One tick before the cliff: locked.
    const before = computeEarningsBreakdown([stream], cliff - 0.001);
    expect(before.totalWithdrawable).toBe(0);
    expect(before.streamEarned[0].cliffLocked).toBe(true);

    // Exactly at the cliff: fully withdrawable, no refresh needed.
    const at = computeEarningsBreakdown([stream], cliff);
    expect(at.totalWithdrawable).toBeGreaterThan(0);
    expect(at.totalWithdrawable).toBe(at.totalVesting);
    expect(at.streamEarned[0].cliffLocked).toBe(false);
  });

  it("returns an empty breakdown for no streams", () => {
    const snap = computeEarningsBreakdown([], 1_000_000);

    expect(snap.totalVesting).toBe(0);
    expect(snap.totalWithdrawable).toBe(0);
    expect(snap.streamEarned).toEqual([]);
    expect(snap.activeStreamsCount).toBe(0);
  });

  it("excludes fully-vested streams from projection rates", () => {
    const now = 1_000_000;
    const streams: WorkerStream[] = [
      // Fully vested → should not contribute to flow rate / projections.
      makeStream({
        id: "done",
        startTime: now - 10_000,
        cliffTime: 0,
        flowRate: 1,
        totalAmount: 100,
      }),
      // Still accruing.
      makeStream({
        id: "active",
        startTime: now - 50,
        cliffTime: 0,
        flowRate: 2,
        totalAmount: 1_000_000,
      }),
    ];

    const snap = computeEarningsBreakdown(streams, now);

    expect(snap.activeStreamsCount).toBe(1);
    expect(snap.hourlyRate).toBe(2 * 3600); // only the active stream's rate
    expect(snap.projectedTwentyFourHours).toBe(2 * 3600 * 24);
  });
});
