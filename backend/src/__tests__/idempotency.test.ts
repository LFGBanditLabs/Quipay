/**
 * Tests for issue #612: idempotency key support.
 *
 * Verifies that:
 *   - A duplicate Idempotency-Key returns the cached response (200)
 *   - A first-time key passes through and the response is stored
 *   - An invalid key format is rejected with 400
 *   - Requests without an Idempotency-Key header pass through unchanged
 */

import { jest } from "@jest/globals";
import {
  IdempotencyService,
  CachedIdempotentResponse,
  setIdempotencyService,
} from "../services/idempotencyService";
import { idempotencyMiddleware } from "../middleware/idempotency";

// ── Stub IdempotencyService ───────────────────────────────────────────────────

function makeStubService(
  cached: CachedIdempotentResponse | null,
): IdempotencyService & {
  setCalls: Array<{
    endpoint: string;
    key: string;
    statusCode: number;
    body: unknown;
  }>;
} {
  const setCalls: Array<{
    endpoint: string;
    key: string;
    statusCode: number;
    body: unknown;
  }> = [];

  const svc = {
    async get(_endpoint: string, _key: string) {
      return cached;
    },
    async set(
      endpoint: string,
      key: string,
      statusCode: number,
      body: unknown,
    ) {
      setCalls.push({ endpoint, key, statusCode, body });
    },
    setCalls,
  } as unknown as IdempotencyService & typeof setCalls;

  (svc as any).setCalls = setCalls;
  return svc as any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReqRes(headers: Record<string, string> = {}) {
  let capturedStatus = 200;
  let capturedBody: unknown = null;
  let replayed = false;

  const req: any = { headers, body: {}, params: {} };
  const res: any = {
    statusCode: 200,
    _headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this._headers[k] = v;
      if (k === "X-Idempotency-Replayed") replayed = true;
    },
    status(code: number) {
      capturedStatus = code;
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      capturedBody = body;
      return this;
    },
    get capturedStatus() {
      return capturedStatus;
    },
    get capturedBody() {
      return capturedBody;
    },
    get replayed() {
      return replayed;
    },
  };

  return { req, res };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("idempotencyMiddleware", () => {
  const VALID_KEY = "550e8400-e29b-41d4-a716-446655440000";

  afterEach(() => {
    // Reset singleton
    setIdempotencyService(new IdempotencyService(null));
  });

  test("passes through when no Idempotency-Key header is present", async () => {
    const svc = makeStubService(null);
    setIdempotencyService(svc);

    const { req, res } = makeReqRes();
    const mw = idempotencyMiddleware("POST /streams");

    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(res.replayed).toBe(false);
  });

  test("rejects an invalid Idempotency-Key format with 400", async () => {
    const svc = makeStubService(null);
    setIdempotencyService(svc);

    const { req, res } = makeReqRes({ "idempotency-key": "not-a-uuid!!!" });
    const mw = idempotencyMiddleware("POST /streams");

    await mw(req, res, () => {});

    expect(res.capturedStatus).toBe(400);
    expect((res.capturedBody as any).error).toMatch(/Invalid Idempotency-Key/);
  });

  test("returns cached response for a duplicate key", async () => {
    const cachedResponse: CachedIdempotentResponse = {
      statusCode: 201,
      body: { stream: { stream_id: 1 } },
      createdAt: new Date().toISOString(),
    };
    const svc = makeStubService(cachedResponse);
    setIdempotencyService(svc);

    const { req, res } = makeReqRes({ "idempotency-key": VALID_KEY });
    const mw = idempotencyMiddleware("POST /streams");

    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.replayed).toBe(true);
    expect(res.capturedStatus).toBe(201);
    expect(res.capturedBody).toEqual(cachedResponse.body);
  });

  test("stores response when key is new (cache miss)", async () => {
    const svc = makeStubService(null);
    setIdempotencyService(svc);

    const { req, res } = makeReqRes({ "idempotency-key": VALID_KEY });
    const mw = idempotencyMiddleware("POST /streams");

    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(res.replayed).toBe(false);

    // Simulate downstream handler calling res.json
    res.status(201).json({ stream: { stream_id: 42 } });

    // The overridden json() should have queued a set() call
    // Give micro-task queue a tick
    await new Promise((r) => setImmediate(r));
    expect((svc as any).setCalls.length).toBeGreaterThanOrEqual(1);
    expect((svc as any).setCalls[0].key).toBe(VALID_KEY);
    expect((svc as any).setCalls[0].endpoint).toBe("POST /streams");
  });
});

describe("IdempotencyService (unit)", () => {
  test("returns null when Redis is not configured", async () => {
    const svc = new IdempotencyService(null);
    const result = await svc.get("POST /streams", "any-key");
    expect(result).toBeNull();
  });

  test("set() is a no-op when Redis and DB are both unavailable", async () => {
    const svc = new IdempotencyService(null);
    // Should not throw
    await expect(
      svc.set("POST /streams", "key", 201, { ok: true }),
    ).resolves.toBeUndefined();
  });
});
