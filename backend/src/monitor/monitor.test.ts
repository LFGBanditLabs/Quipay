import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  calculateDailyBurnRate,
  calculateRunwayDays,
  calculateExhaustionDate,
} from "./monitor";

describe("Treasury Monitor", () => {
  describe("calculateDailyBurnRate", () => {
    it("should calculate burn rate for a single active stream", () => {
      const now = Math.floor(Date.now() / 1000);
      const streams = [
        {
          total_amount: 30_000_000, // 3 tokens (in stroops)
          withdrawn_amount: 0,
          start_ts: now - 86400, // started 1 day ago
          end_ts: now + 86400 * 29, // ends in 29 days (30 days total)
        },
      ];

      const burnRate = calculateDailyBurnRate(streams);
      // Should be approximately 1_000_000 stroops/day (0.1 tokens/day)
      expect(burnRate).toBeCloseTo(1_034_482, -3); // ~1.03M stroops/day
    });

    it("should calculate burn rate for multiple active streams", () => {
      const now = Math.floor(Date.now() / 1000);
      const streams = [
        {
          total_amount: 30_000_000,
          withdrawn_amount: 0,
          start_ts: now - 86400,
          end_ts: now + 86400 * 29,
        },
        {
          total_amount: 60_000_000,
          withdrawn_amount: 10_000_000,
          start_ts: now - 86400 * 5,
          end_ts: now + 86400 * 25,
        },
      ];

      const burnRate = calculateDailyBurnRate(streams);
      // Stream 1: ~1.03M/day, Stream 2: 50M/25 days = 2M/day
      // Total: ~3.03M/day
      expect(burnRate).toBeGreaterThan(2_500_000);
      expect(burnRate).toBeLessThan(3_500_000);
    });

    it("should return 0 for streams with no remaining balance", () => {
      const now = Math.floor(Date.now() / 1000);
      const streams = [
        {
          total_amount: 30_000_000,
          withdrawn_amount: 30_000_000, // fully withdrawn
          start_ts: now - 86400,
          end_ts: now + 86400 * 29,
        },
      ];

      const burnRate = calculateDailyBurnRate(streams);
      expect(burnRate).toBe(0);
    });

    it("should return 0 for expired streams", () => {
      const now = Math.floor(Date.now() / 1000);
      const streams = [
        {
          total_amount: 30_000_000,
          withdrawn_amount: 0,
          start_ts: now - 86400 * 40,
          end_ts: now - 86400 * 10, // ended 10 days ago
        },
      ];

      const burnRate = calculateDailyBurnRate(streams);
      expect(burnRate).toBe(0);
    });

    it("should handle empty stream array", () => {
      const burnRate = calculateDailyBurnRate([]);
      expect(burnRate).toBe(0);
    });
  });

  describe("calculateRunwayDays", () => {
    it("should calculate runway correctly", () => {
      const balance = 100_000_000; // 10 tokens
      const dailyBurn = 10_000_000; // 1 token/day

      const runway = calculateRunwayDays(balance, dailyBurn);
      expect(runway).toBe(10); // 10 days
    });

    it("should return null for zero burn rate", () => {
      const balance = 100_000_000;
      const dailyBurn = 0;

      const runway = calculateRunwayDays(balance, dailyBurn);
      expect(runway).toBeNull();
    });

    it("should return null for negative burn rate", () => {
      const balance = 100_000_000;
      const dailyBurn = -1000;

      const runway = calculateRunwayDays(balance, dailyBurn);
      expect(runway).toBeNull();
    });

    it("should handle fractional runway days", () => {
      const balance = 15_000_000;
      const dailyBurn = 10_000_000;

      const runway = calculateRunwayDays(balance, dailyBurn);
      expect(runway).toBe(1.5);
    });
  });

  describe("calculateExhaustionDate", () => {
    it("should calculate exhaustion date correctly", () => {
      const runwayDays = 7;
      const exhaustionDate = calculateExhaustionDate(runwayDays);

      expect(exhaustionDate).not.toBeNull();
      if (exhaustionDate) {
        const date = new Date(exhaustionDate);
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() + 7);

        // Check if dates are within 1 second of each other
        expect(Math.abs(date.getTime() - expectedDate.getTime())).toBeLessThan(
          1000,
        );
      }
    });

    it("should return null for null runway", () => {
      const exhaustionDate = calculateExhaustionDate(null);
      expect(exhaustionDate).toBeNull();
    });

    it("should handle fractional days", () => {
      const runwayDays = 7.5;
      const exhaustionDate = calculateExhaustionDate(runwayDays);

      expect(exhaustionDate).not.toBeNull();
      if (exhaustionDate) {
        const date = new Date(exhaustionDate);
        expect(date.getTime()).toBeGreaterThan(Date.now());
      }
    });
  });

  describe("Integration scenarios", () => {
    it("should correctly identify low runway scenario", () => {
      const now = Math.floor(Date.now() / 1000);
      const streams = [
        {
          total_amount: 70_000_000, // 7 tokens
          withdrawn_amount: 0,
          start_ts: now,
          end_ts: now + 86400 * 7, // 7 days
        },
      ];

      const balance = 50_000_000; // 5 tokens
      const burnRate = calculateDailyBurnRate(streams);
      const runway = calculateRunwayDays(balance, burnRate);

      // Burn rate: 7 tokens / 7 days = 1 token/day = 10M stroops/day
      // Runway: 5 tokens / 1 token/day = 5 days
      expect(runway).not.toBeNull();
      if (runway !== null) {
        expect(runway).toBeLessThan(7); // Should trigger alert
        expect(runway).toBeCloseTo(5, 0);
      }
    });

    it("should correctly identify healthy treasury", () => {
      const now = Math.floor(Date.now() / 1000);
      const streams = [
        {
          total_amount: 30_000_000, // 3 tokens
          withdrawn_amount: 0,
          start_ts: now,
          end_ts: now + 86400 * 30, // 30 days
        },
      ];

      const balance = 100_000_000; // 10 tokens
      const burnRate = calculateDailyBurnRate(streams);
      const runway = calculateRunwayDays(balance, burnRate);

      // Burn rate: 3 tokens / 30 days = 0.1 token/day = 1M stroops/day
      // Runway: 10 tokens / 0.1 token/day = 100 days
      expect(runway).not.toBeNull();
      if (runway !== null) {
        expect(runway).toBeGreaterThan(7); // Should NOT trigger alert
        expect(runway).toBeGreaterThan(50);
      }
    });
  });
});
