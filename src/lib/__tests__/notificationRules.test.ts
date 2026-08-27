import {
  checkAndTriggerMilestones,
  isVaultBalanceLow,
  isStreamEndingSoon,
  mapEventToNotification,
  formatRelativeTime,
  getMilestoneStorageKey,
  DEFAULT_MILESTONE_THRESHOLDS,
  type StreamEvent,
} from "../notificationRules";

const createMockStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    store,
  };
};

describe("notificationRules", () => {
  describe("checkAndTriggerMilestones", () => {
    it("triggers milestones as cumulative earnings cross thresholds (100, 500, 1000, 5000)", () => {
      const storage = createMockStorage();
      const worker = "GWORKER123";

      // 1. Crosses 100
      let newlyTriggered = checkAndTriggerMilestones(worker, 150, DEFAULT_MILESTONE_THRESHOLDS, storage);
      expect(newlyTriggered).toEqual([100]);

      // 2. Earnings increase to 400 (no new threshold crossed)
      newlyTriggered = checkAndTriggerMilestones(worker, 400, DEFAULT_MILESTONE_THRESHOLDS, storage);
      expect(newlyTriggered).toEqual([]);

      // 3. Earnings cross 500 and 1000 in one go
      newlyTriggered = checkAndTriggerMilestones(worker, 1200, DEFAULT_MILESTONE_THRESHOLDS, storage);
      expect(newlyTriggered).toEqual([500, 1000]);

      // 4. Earnings cross 5000
      newlyTriggered = checkAndTriggerMilestones(worker, 5500, DEFAULT_MILESTONE_THRESHOLDS, storage);
      expect(newlyTriggered).toEqual([5000]);

      // 5. Subsequent calls at same or higher amount do not re-trigger
      newlyTriggered = checkAndTriggerMilestones(worker, 6000, DEFAULT_MILESTONE_THRESHOLDS, storage);
      expect(newlyTriggered).toEqual([]);
    });

    it("isolates milestones by worker and month", () => {
      const storage = createMockStorage();
      const workerA = "GA111";
      const workerB = "GB222";

      const triggeredA = checkAndTriggerMilestones(workerA, 200, DEFAULT_MILESTONE_THRESHOLDS, storage);
      expect(triggeredA).toEqual([100]);

      const triggeredB = checkAndTriggerMilestones(workerB, 200, DEFAULT_MILESTONE_THRESHOLDS, storage);
      expect(triggeredB).toEqual([100]);

      const keyA = getMilestoneStorageKey(workerA);
      const keyB = getMilestoneStorageKey(workerB);
      expect(keyA).not.toEqual(keyB);
    });
  });

  describe("isVaultBalanceLow", () => {
    it("returns true when available balance is below 2 weeks (14 days) burn rate", () => {
      const monthlyBurnRate = 3000; // 100 per day -> 14 days = 1400
      expect(isVaultBalanceLow(1300, monthlyBurnRate)).toBe(true);
      expect(isVaultBalanceLow(1400, monthlyBurnRate)).toBe(false);
      expect(isVaultBalanceLow(2000, monthlyBurnRate)).toBe(false);
    });

    it("returns false if burn rate is zero or invalid", () => {
      expect(isVaultBalanceLow(100, 0)).toBe(false);
      expect(isVaultBalanceLow(100, -10)).toBe(false);
      expect(isVaultBalanceLow(NaN, 100)).toBe(false);
    });
  });

  describe("isStreamEndingSoon", () => {
    it("returns true if end date is within 7 days", () => {
      const now = Date.now();
      const in3Days = now + 3 * 24 * 60 * 60 * 1000;
      const in8Days = now + 8 * 24 * 60 * 60 * 1000;
      const pastDate = now - 1000;

      expect(isStreamEndingSoon(in3Days, 7)).toBe(true);
      expect(isStreamEndingSoon(in8Days, 7)).toBe(false);
      expect(isStreamEndingSoon(pastDate, 7)).toBe(false);
    });
  });

  describe("mapEventToNotification", () => {
    it("maps worker stream.started event", () => {
      const event: StreamEvent = {
        type: "stream.started",
        streamId: "42",
        employerAddress: "GEMPLOYER123456789",
        workerAddress: "GWORKER123456789",
        amount: "5000",
        token: "USDC",
        timestamp: Date.now(),
      };

      const notif = mapEventToNotification(event, { currentUserAddress: "GWORKER123456789" });
      expect(notif.title).toBe("Stream Started");
      expect(notif.message).toContain("started streaming 5,000 USDC/month to you");
      expect(notif.actionUrl).toBe("/stream/42");
    });

    it("maps employer stream.started event", () => {
      const event: StreamEvent = {
        type: "stream.started",
        streamId: "42",
        employerAddress: "GEMPLOYER123456789",
        workerAddress: "GWORKER123456789",
        amount: "5000",
        token: "USDC",
        timestamp: Date.now(),
      };

      const notif = mapEventToNotification(event, { currentUserAddress: "GEMPLOYER123456789" });
      expect(notif.title).toBe("Stream Started");
      expect(notif.message).toContain("Started streaming 5,000 USDC/month to");
      expect(notif.actionUrl).toBe("/stream/42");
    });

    it("maps stream.paused, stream.resumed, stream.cancelled", () => {
      const baseEvent = {
        streamId: "10",
        employerAddress: "GEMPLOYER",
        workerAddress: "GWORKER",
        timestamp: Date.now(),
      };

      const paused = mapEventToNotification({ ...baseEvent, type: "stream.paused" });
      expect(paused.title).toBe("Stream Paused");

      const resumed = mapEventToNotification({ ...baseEvent, type: "stream.resumed" });
      expect(resumed.title).toBe("Stream Resumed");

      const cancelled = mapEventToNotification({ ...baseEvent, type: "stream.cancelled" });
      expect(cancelled.title).toBe("Stream Cancelled");
      expect(cancelled.actionUrl).toBe("/stream/10");
    });

    it("maps earnings.milestone and vault.low_balance", () => {
      const milestone = mapEventToNotification({
        type: "earnings.milestone",
        amount: 1000,
        token: "USDC",
        timestamp: Date.now(),
      });
      expect(milestone.title).toBe("Earnings Milestone");
      expect(milestone.message).toBe("You've earned 1,000 USDC this month!");

      const lowBalance = mapEventToNotification({
        type: "vault.low_balance",
        timestamp: Date.now(),
      });
      expect(lowBalance.title).toBe("Vault Balance Low");
      expect(lowBalance.actionUrl).toBe("/treasury");
    });

    it("maps withdrawal.completed and deposit.confirmed", () => {
      const withdrawal = mapEventToNotification({
        type: "withdrawal.completed",
        amount: "2500",
        token: "USDC",
        timestamp: Date.now(),
      });
      expect(withdrawal.title).toBe("Withdrawal Completed");
      expect(withdrawal.message).toContain("Withdrew 2,500 USDC");
      expect(withdrawal.actionUrl).toBe("/withdraw");

      const deposit = mapEventToNotification(
        {
          type: "deposit.confirmed",
          amount: "100000",
          token: "USDC",
          employerAddress: "GEMPLOYER",
          timestamp: Date.now(),
        },
        { currentUserAddress: "GEMPLOYER" },
      );
      expect(deposit.title).toBe("Treasury Deposit Confirmed");
      expect(deposit.actionUrl).toBe("/treasury");
    });
  });

  describe("formatRelativeTime", () => {
    it("formats relative timestamps accurately", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 10 * 1000)).toBe("just now");
      expect(formatRelativeTime(now - 2 * 60 * 1000)).toBe("2m ago");
      expect(formatRelativeTime(now - 60 * 60 * 1000)).toBe("1h ago");
      expect(formatRelativeTime(now - 24 * 60 * 60 * 1000)).toBe("yesterday");
      expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000)).toBe("3d ago");
    });
  });
});
