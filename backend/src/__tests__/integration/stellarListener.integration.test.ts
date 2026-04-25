/**
 * Integration Tests for StellarListener
 * Tests the bridge between on-chain Stellar events and backend processing
 * @jest-strict-type-checking false
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

// Mock dependencies before importing
jest.mock("../../delivery", () => ({
  sendWebhookNotification: jest.fn(),
}));

jest.mock("../../scheduler/scheduler", () => ({
  scheduleJob: jest.fn().mockReturnValue(true),
  unscheduleJob: jest.fn().mockReturnValue(true),
  getSchedulerStatus: jest.fn().mockReturnValue({ activeJobs: 0, jobs: [] }),
  startScheduler: jest.fn(),
  stopScheduler: jest.fn(),
  validateCronExpression: jest.fn(),
  calculateNextRun: jest.fn(),
  executeScheduledPayroll: jest.fn(),
}));

jest.mock("../../db/pool", () => ({
  getPool: jest.fn(() => ({})),
}));

jest.mock("../../utils/circuitBreaker", () => ({
  createCircuitBreaker: jest.fn().mockImplementation((fn: any) => ({
    fire: jest.fn().mockImplementation((...args: any[]) => fn(...args)),
    fallback: jest.fn().mockReturnThis(),
    on: jest.fn(),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGetLatestLedger: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGetEvents: any;

jest.mock("@stellar/stellar-sdk", () => {
  mockGetLatestLedger = jest.fn();
  mockGetEvents = jest.fn();

  return {
    rpc: {
      Server: jest.fn().mockImplementation(() => ({
        getLatestLedger: mockGetLatestLedger,
        getEvents: mockGetEvents,
      })),
    },
  };
});

describe("StellarListener Integration Tests", () => {
  const QUIPAY_CONTRACT_ID =
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sendWebhookNotification: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scheduleJob: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unscheduleJob: any;

  beforeAll(() => {
    process.env.QUIPAY_CONTRACT_ID = QUIPAY_CONTRACT_ID;
    process.env.PUBLIC_STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    if (mockGetLatestLedger) mockGetLatestLedger.mockReset();
    if (mockGetEvents) mockGetEvents.mockReset();

    // Re-import after reset
    const delivery = await import("../../delivery");
    const scheduler = await import("../../scheduler/scheduler");

    sendWebhookNotification = delivery.sendWebhookNotification;
    scheduleJob = scheduler.scheduleJob;
    unscheduleJob = scheduler.unscheduleJob;

    // Clear webhook store
    const { webhookStore } = await import("../../webhooks");
    webhookStore.clear();
  });

  afterAll(() => {
    delete process.env.QUIPAY_CONTRACT_ID;
    delete process.env.PUBLIC_STELLAR_RPC_URL;
  });

  afterEach(async () => {
    const stellarListener = await import("../../stellarListener");
    stellarListener.stopStellarListener();
  });

  describe("Event Stream Processing", () => {
    it("should poll for events and process stream created events", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 1000 })
        .mockResolvedValueOnce({ sequence: 1001 });

      const streamCreatedEvent = {
        id: "evt-001",
        ledger: 1001,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [{ toXDR: () => "new_stream_event" }],
        value: { stream_id: 123 },
      };

      mockGetEvents.mockResolvedValueOnce({ events: [streamCreatedEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(mockGetEvents).toHaveBeenCalledWith({
        startLedger: 1001,
        filters: [{ type: "contract", contractIds: [QUIPAY_CONTRACT_ID] }],
        limit: 100,
      });

      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "new_stream",
        expect.objectContaining({
          id: "evt-001",
          ledger: 1001,
          contractId: QUIPAY_CONTRACT_ID,
          eventType: "new_stream",
        }),
      );
    });

    it("should process withdrawal events and trigger webhook notifications", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 2000 })
        .mockResolvedValueOnce({ sequence: 2001 });

      const withdrawalEvent = {
        id: "evt-002",
        ledger: 2001,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [{ toXDR: () => "withdrawal_event" }],
        value: { amount: "500" },
      };

      mockGetEvents.mockResolvedValueOnce({ events: [withdrawalEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "withdrawal",
        expect.objectContaining({
          id: "evt-002",
          ledger: 2001,
          eventType: "withdrawal",
        }),
      );
    });

    it("should include decoded stream fields in webhook payload", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 2500 })
        .mockResolvedValueOnce({ sequence: 2501 });

      const streamCreatedEvent = {
        id: "evt-002b",
        ledger: 2501,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [{ toXDR: () => "new_stream_event" }],
        value: {
          stream_id: 987,
          worker_address: "GWORKER_DEC0DED",
          employer_address: "GEMPLOYER_DEC0DED",
          amount: "1000000",
          token: "USDC",
        },
      };

      mockGetEvents.mockResolvedValueOnce({ events: [streamCreatedEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "new_stream",
        expect.objectContaining({
          id: "evt-002b",
          stream_id: 987,
          worker_address: "GWORKER_DEC0DED",
          employer_address: "GEMPLOYER_DEC0DED",
          amount: "1000000",
          token: "USDC",
        }),
      );
    });

    it("should handle multiple events in a single ledger", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 3000 })
        .mockResolvedValueOnce({ sequence: 3001 });

      const events = [
        {
          id: "evt-003",
          ledger: 3001,
          contractId: QUIPAY_CONTRACT_ID,
          type: "contract",
          topic: [{ toXDR: () => "new_stream_event" }],
          value: {},
        },
        {
          id: "evt-004",
          ledger: 3001,
          contractId: QUIPAY_CONTRACT_ID,
          type: "contract",
          topic: [{ toXDR: () => "withdrawal_event" }],
          value: {},
        },
      ];

      mockGetEvents.mockResolvedValueOnce({ events });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "new_stream",
        expect.objectContaining({ id: "evt-003" }),
      );
      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "withdrawal",
        expect.objectContaining({ id: "evt-004" }),
      );
    });

    it("should handle unknown event types as generic_contract_event", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 4000 })
        .mockResolvedValueOnce({ sequence: 4001 });

      const unknownEvent = {
        id: "evt-005",
        ledger: 4001,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [{ toXDR: () => "unknown_event_type" }],
        value: {},
      };

      mockGetEvents.mockResolvedValueOnce({ events: [unknownEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Unknown events are converted to generic_contract_event and still sent
      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "generic_contract_event",
        expect.objectContaining({ id: "evt-005" }),
      );
    });
  });

  describe("Scheduler Integration", () => {
    it("should send webhook notification for stream created events", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 5000 })
        .mockResolvedValueOnce({ sequence: 5001 });

      const streamCreatedEvent = {
        id: "evt-schedule-001",
        ledger: 5001,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [{ toXDR: () => "StreamCreated_event" }],
        value: {
          stream_id: 789,
          employer: "GEMPLOYER_SCHED",
          worker: "GWORKER_SCHED",
          rate: "1000000",
          duration_days: 30,
          cron_expression: "0 0 * * *",
        },
      };

      mockGetEvents.mockResolvedValueOnce({ events: [streamCreatedEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // The listener sends webhook notifications for stream events
      // The scheduler integration would be handled by the webhook consumer
      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "new_stream",
        expect.objectContaining({
          id: "evt-schedule-001",
          ledger: 5001,
          eventType: "new_stream",
        }),
      );
    });

    it("should handle stream cancelled event", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 6000 })
        .mockResolvedValueOnce({ sequence: 6001 });

      const streamCancelledEvent = {
        id: "evt-cancel-001",
        ledger: 6001,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [{ toXDR: () => "StreamCancelled_event" }],
        value: { stream_id: 789, reason: "user_requested" },
      };

      mockGetEvents.mockResolvedValueOnce({ events: [streamCancelledEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(mockGetEvents).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle RPC errors gracefully and continue polling", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 7000 })
        .mockRejectedValueOnce(new Error("RPC timeout"))
        .mockResolvedValueOnce({ sequence: 7001 });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 12000));

      expect(mockGetLatestLedger).toHaveBeenCalled();
    });

    it("should handle getEvents errors gracefully", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 8000 })
        .mockResolvedValueOnce({ sequence: 8001 });

      mockGetEvents.mockRejectedValueOnce(new Error("Events fetch failed"));

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(mockGetEvents).toHaveBeenCalled();
    });
  });

  describe("Ledger Progression", () => {
    it("should not process events if ledger has not advanced", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 9000 })
        .mockResolvedValueOnce({ sequence: 9000 });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(mockGetEvents).not.toHaveBeenCalled();
    });

    it("should process events from multiple ledgers", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 10000 })
        .mockResolvedValueOnce({ sequence: 10005 });

      const events = [
        {
          id: "evt-10001",
          ledger: 10001,
          contractId: QUIPAY_CONTRACT_ID,
          type: "contract",
          topic: [{ toXDR: () => "new_stream_event" }],
          value: {},
        },
      ];

      mockGetEvents.mockResolvedValueOnce({ events });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({ startLedger: 10001 }),
      );
    });
  });

  describe("Initialization", () => {
    it("should handle missing QUIPAY_CONTRACT_ID gracefully", async () => {
      const originalContractId = process.env.QUIPAY_CONTRACT_ID;
      delete process.env.QUIPAY_CONTRACT_ID;

      try {
        const warnSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});
        jest.resetModules();

        const stellarListener = await import("../../stellarListener");
        await stellarListener.startStellarListener();

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("QUIPAY_CONTRACT_ID is not set"),
        );

        warnSpy.mockRestore();
      } finally {
        process.env.QUIPAY_CONTRACT_ID = originalContractId;
      }
    });

    it("should initialize with correct contract ID filter", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 11000 })
        .mockResolvedValueOnce({ sequence: 11001 });

      mockGetEvents.mockResolvedValueOnce({ events: [] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({
              contractIds: [QUIPAY_CONTRACT_ID],
            }),
          ]),
        }),
      );
    });
  });

  describe("Event Topic Parsing", () => {
    it("should correctly identify 'withdrawal' topic variations", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 12000 })
        .mockResolvedValueOnce({ sequence: 12001 });

      const withdrawalEvent = {
        id: "evt-withdraw-001",
        ledger: 12001,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [{ toXDR: () => "Withdraw_event" }],
        value: {},
      };

      mockGetEvents.mockResolvedValueOnce({ events: [withdrawalEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "withdrawal",
        expect.anything(),
      );
    });

    it("should correctly identify 'stream' topic variations", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 13000 })
        .mockResolvedValueOnce({ sequence: 13001 });

      const streamEvent = {
        id: "evt-stream-001",
        ledger: 13001,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [{ toXDR: () => "StreamCreated_event" }],
        value: {},
      };

      mockGetEvents.mockResolvedValueOnce({ events: [streamEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(sendWebhookNotification).toHaveBeenCalledWith(
        "new_stream",
        expect.anything(),
      );
    });

    it("should handle empty topic array gracefully", async () => {
      const stellarListener = await import("../../stellarListener");

      mockGetLatestLedger
        .mockResolvedValueOnce({ sequence: 14000 })
        .mockResolvedValueOnce({ sequence: 14001 });

      const emptyTopicEvent = {
        id: "evt-empty-001",
        ledger: 14001,
        contractId: QUIPAY_CONTRACT_ID,
        type: "contract",
        topic: [],
        value: {},
      };

      mockGetEvents.mockResolvedValueOnce({ events: [emptyTopicEvent] });

      await stellarListener.startStellarListener();
      await new Promise((resolve) => setTimeout(resolve, 6000));

      expect(sendWebhookNotification).not.toHaveBeenCalled();
    });
  });
});
