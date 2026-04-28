import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import axios from "axios";
import { Pool } from "pg";
import {
  cleanTestDatabase,
  setupTestDatabase,
  teardownTestDatabase,
  TestDatabase,
} from "../helpers/testcontainer";
import { sendWebhookNotification } from "../../delivery";
import { webhookStore } from "../../webhooks";
import { pushToDLQ } from "../../db/dlq";
import { runWebhookDLQRetryBatch } from "../../webhookDlqWorker";

jest.mock("axios");

type DLQRow = {
  id: string;
  job_type: string;
  status: "pending" | "replayed" | "discarded";
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
};

describe("Webhook DLQ retry integration", () => {
  let testDb: TestDatabase;
  let pool: Pool;
  const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    pool = testDb.getPool();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    webhookStore.clear();
  });

  afterEach(async () => {
    webhookStore.clear();
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("enqueues a DLQ row on initial webhook delivery failure", async () => {
    webhookStore.set("sub-1", {
      id: "sub-1",
      ownerId: "merchant-1",
      url: "https://example.com/webhook",
      events: ["withdrawal"],
      createdAt: new Date(),
    });

    mockedPost.mockResolvedValueOnce({ status: 500, data: { oops: true } } as any);

    await sendWebhookNotification("withdrawal", { amount: "123" });

    const result = await pool.query<DLQRow>(
      `SELECT id, job_type, status, payload, context
         FROM dead_letter_queue
        ORDER BY created_at DESC`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].job_type).toBe("webhook_delivery");
    expect(result.rows[0].status).toBe("pending");
    expect(result.rows[0].payload.eventType).toBe("withdrawal");
    expect(result.rows[0].payload.targetUrl).toBe("https://example.com/webhook");
    expect(result.rows[0].context.retryCount).toBe(0);
    expect(typeof result.rows[0].context.nextRetryAtMs).toBe("number");
  });

  it("replays due DLQ webhook entries successfully", async () => {
    webhookStore.set("sub-1", {
      id: "sub-1",
      ownerId: "merchant-1",
      url: "https://example.com/webhook",
      events: ["withdrawal"],
      createdAt: new Date(),
    });

    mockedPost.mockResolvedValueOnce({ status: 500, data: { oops: true } } as any);
    await sendWebhookNotification("withdrawal", { amount: "123" });

    const dlqRes = await pool.query<{ id: string }>(
      `SELECT id FROM dead_letter_queue ORDER BY created_at DESC LIMIT 1`,
    );
    const dlqId = dlqRes.rows[0].id;

    await pool.query(
      `UPDATE dead_letter_queue
          SET context = context || $2::jsonb
        WHERE id = $1`,
      [dlqId, JSON.stringify({ nextRetryAtMs: Date.now() - 1_000 })],
    );

    mockedPost.mockResolvedValueOnce({ status: 200, data: { ok: true } } as any);

    const processed = await runWebhookDLQRetryBatch(10);
    expect(processed).toBe(1);

    const after = await pool.query<DLQRow>(
      `SELECT id, job_type, status, payload, context
         FROM dead_letter_queue
        WHERE id = $1`,
      [dlqId],
    );

    expect(after.rows[0].status).toBe("replayed");
    expect(after.rows[0].context.nextRetryAtMs).toBeNull();
    expect(after.rows[0].context.lastStatusCode).toBe(200);
  });

  it("discards webhook DLQ rows after max retries and writes audit event", async () => {
    const dlqId = await pushToDLQ(
      "webhook_delivery",
      {
        eventId: "event-max-retry",
        eventType: "withdrawal",
        targetUrl: "https://example.com/webhook",
        requestPayload: { hello: "world" },
      },
      "Previous failure",
      {
        retryCount: 4,
        nextRetryAtMs: Date.now() - 1_000,
        targetUrl: "https://example.com/webhook",
      },
    );

    mockedPost.mockResolvedValueOnce({ status: 500, data: { oops: true } } as any);

    const processed = await runWebhookDLQRetryBatch(10);
    expect(processed).toBe(1);

    const dlqRow = await pool.query<DLQRow>(
      `SELECT id, job_type, status, payload, context
         FROM dead_letter_queue
        WHERE id = $1`,
      [dlqId],
    );

    expect(dlqRow.rows[0].status).toBe("discarded");
    expect(dlqRow.rows[0].context.retryCount).toBe(5);
    expect(dlqRow.rows[0].context.nextRetryAtMs).toBeNull();

    const auditRow = await pool.query<{
      message: string;
      log_level: "INFO" | "WARN" | "ERROR";
      context: Record<string, unknown>;
    }>(
      `SELECT message, log_level, context
         FROM audit_logs
        WHERE message = 'webhook.permanently_failed'
        ORDER BY created_at DESC
        LIMIT 1`,
    );

    expect(auditRow.rows).toHaveLength(1);
    expect(auditRow.rows[0].log_level).toBe("ERROR");
    expect(auditRow.rows[0].context.retry_count).toBe(5);
    expect(auditRow.rows[0].context.dlq_id).toBe(dlqId);
  });
});

