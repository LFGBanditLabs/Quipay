jest.mock("axios");
jest.mock("../db/pool", () => ({
  getPool: jest.fn(() => ({})),
}));
jest.mock("../db/dlq", () => ({
  pushToDLQ: jest.fn().mockResolvedValue("1"),
}));
jest.mock("../db/queries", () => ({
  createWebhookOutboundEvent: jest.fn().mockResolvedValue(undefined),
  getWebhookOutboundEventById: jest.fn(),
  insertWebhookOutboundAttempt: jest.fn().mockResolvedValue(undefined),
  updateWebhookOutboundEventAfterAttempt: jest
    .fn()
    .mockResolvedValue(undefined),
}));

import axios from "axios";
import { sendWebhookNotification, retryWebhookEvent } from "../delivery";
import { webhookStore } from "../webhooks";
import {
  createWebhookOutboundEvent,
  getWebhookOutboundEventById,
  insertWebhookOutboundAttempt,
  updateWebhookOutboundEventAfterAttempt,
} from "../db/queries";
import { pushToDLQ } from "../db/dlq";

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;
const mockCreateEvent = createWebhookOutboundEvent as jest.Mock;
const mockGetEvent = getWebhookOutboundEventById as jest.Mock;
const mockInsertAttempt = insertWebhookOutboundAttempt as jest.Mock;
const mockUpdateEvent = updateWebhookOutboundEventAfterAttempt as jest.Mock;
const mockPushToDLQ = pushToDLQ as jest.Mock;

describe("webhook delivery logging + retry scheduling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webhookStore.clear();
  });

  it("logs outbound event + attempt and marks success on 2xx", async () => {
    webhookStore.set("sub-1", {
      id: "sub-1",
      ownerId: "merchant-1",
      url: "https://example.com/webhook",
      events: ["withdrawal"],
      createdAt: new Date(),
    });

    mockedPost.mockResolvedValueOnce({ status: 204, data: "" } as any);

    await sendWebhookNotification("withdrawal", { hello: "world" });

    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockInsertAttempt).toHaveBeenCalledTimes(1);
    expect(mockUpdateEvent).toHaveBeenCalledTimes(1);

    expect(mockUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        attemptCount: 1,
        nextRetryAt: null,
      }),
    );
  });

  it("schedules retry for HTTP 500", async () => {
    webhookStore.set("sub-1", {
      id: "sub-1",
      ownerId: "merchant-1",
      url: "https://example.com/webhook",
      events: ["withdrawal"],
      createdAt: new Date(),
    });

    mockedPost.mockResolvedValueOnce({
      status: 500,
      data: { oops: true },
    } as any);

    await sendWebhookNotification("withdrawal", { hello: "world" });

    expect(mockUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        attemptCount: 1,
        lastResponseCode: 500,
        nextRetryAt: expect.any(Date),
      }),
    );
  });

  it("does not schedule retry for HTTP 400", async () => {
    webhookStore.set("sub-1", {
      id: "sub-1",
      ownerId: "merchant-1",
      url: "https://example.com/webhook",
      events: ["withdrawal"],
      createdAt: new Date(),
    });

    mockedPost.mockResolvedValueOnce({
      status: 400,
      data: { bad: true },
    } as any);

    await sendWebhookNotification("withdrawal", { hello: "world" });

    expect(mockUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        attemptCount: 1,
        lastResponseCode: 400,
        nextRetryAt: null,
      }),
    );
  });

  it("moves permanently failed retries into the dead letter queue", async () => {
    webhookStore.set("sub-1", {
      id: "sub-1",
      ownerId: "merchant-1",
      url: "https://example.com/webhook",
      events: ["withdrawal"],
      createdAt: new Date(),
    });

    mockGetEvent.mockResolvedValueOnce({
      id: "event-1",
      owner_id: "merchant-1",
      subscription_id: "sub-1",
      url: "https://example.com/webhook",
      event_type: "withdrawal",
      request_payload: { hello: "world" },
      status: "pending",
      attempt_count: 5,
      last_response_code: 500,
      last_error: "boom",
      next_retry_at: null,
      last_attempt_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    mockedPost.mockResolvedValueOnce({
      status: 500,
      data: { oops: true },
    } as any);

    await retryWebhookEvent("event-1");

    expect(mockUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-1",
        status: "failed",
        attemptCount: 6,
        nextRetryAt: null,
      }),
    );
    expect(mockPushToDLQ).toHaveBeenCalledWith(
      "webhook_delivery",
      expect.objectContaining({
        eventId: "event-1",
        eventType: "withdrawal",
      }),
      expect.any(String),
      expect.objectContaining({
        attemptNumber: 6,
        statusCode: 500,
      }),
    );
  });
});
