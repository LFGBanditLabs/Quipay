jest.mock("axios");
jest.mock("../db/pool", () => ({
  getPool: jest.fn(() => ({})),
}));
jest.mock("../db/queries", () => ({
  createWebhookOutboundEvent: jest.fn().mockResolvedValue(undefined),
  getWebhookOutboundEventById: jest.fn(),
  insertWebhookOutboundAttempt: jest.fn().mockResolvedValue(undefined),
  updateWebhookOutboundEventAfterAttempt: jest.fn().mockResolvedValue(undefined),
}));

import axios from "axios";
import { sendWebhookNotification } from "../delivery";
import { webhookStore } from "../webhooks";
import {
  createWebhookOutboundEvent,
  insertWebhookOutboundAttempt,
  updateWebhookOutboundEventAfterAttempt,
} from "../db/queries";

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;
const mockCreateEvent = createWebhookOutboundEvent as jest.Mock;
const mockInsertAttempt = insertWebhookOutboundAttempt as jest.Mock;
const mockUpdateEvent = updateWebhookOutboundEventAfterAttempt as jest.Mock;

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

    mockedPost.mockResolvedValueOnce({ status: 500, data: { oops: true } } as any);

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

    mockedPost.mockResolvedValueOnce({ status: 400, data: { bad: true } } as any);

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
});
