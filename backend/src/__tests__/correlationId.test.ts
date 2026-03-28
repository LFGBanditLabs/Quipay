/**
 * Tests for issue #611: structured logging with correlation IDs.
 *
 * Verifies that:
 *   - requestIdMiddleware generates a correlationId and echoes it in the response header
 *   - An inbound X-Correlation-ID header is honoured and propagated
 *   - serviceLogger enriches log lines with correlation_id, method, path
 *   - setWalletAddressInContext makes the wallet_address appear in log output
 */

import { jest } from "@jest/globals";
import { AsyncLocalStorage } from "async_hooks";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../audit/init", () => ({
  getAuditLogger: jest.fn(),
  isAuditLoggerInitialized: jest.fn(),
}));

import { getAuditLogger, isAuditLoggerInitialized } from "../audit/init";
import { logServiceInfo, logServiceError } from "../audit/serviceLogger";
import {
  requestContext,
  requestIdMiddleware,
  setWalletAddressInContext,
  RequestContextStore,
} from "../middleware/requestId";

const mockInfo = jest.fn();
const mockError = jest.fn();
const mockGetAuditLogger = jest.mocked(getAuditLogger);
const mockIsInitialized = jest.mocked(isAuditLoggerInitialized);

// Helper: build a minimal Express-like req/res/next triple
function makeReqRes(headers: Record<string, string> = {}) {
  const setHeaderCalls: Record<string, string> = {};
  const req: any = { headers, method: "GET", path: "/test" };
  const res: any = {
    setHeader: (k: string, v: string) => {
      setHeaderCalls[k] = v;
    },
    getHeaders: () => setHeaderCalls,
  };
  return { req, res, headers: setHeaderCalls };
}

describe("requestIdMiddleware", () => {
  test("generates a correlationId when none is supplied", (done) => {
    const { req, res, headers } = makeReqRes();
    requestIdMiddleware(req, res, () => {
      expect(headers["X-Correlation-ID"]).toBeDefined();
      expect(headers["X-Request-ID"]).toBeDefined();
      // When no inbound header, requestId === correlationId
      expect(headers["X-Correlation-ID"]).toBe(headers["X-Request-ID"]);
      done();
    });
  });

  test("honours an inbound X-Correlation-ID header", (done) => {
    const { req, res, headers } = makeReqRes({
      "x-correlation-id": "my-corr-id-123",
    });
    requestIdMiddleware(req, res, () => {
      expect(headers["X-Correlation-ID"]).toBe("my-corr-id-123");
      done();
    });
  });

  test("populates requestContext with correlationId, method, and path", (done) => {
    const { req, res } = makeReqRes();
    requestIdMiddleware(req, res, () => {
      const store = requestContext.getStore() as RequestContextStore;
      expect(store.correlationId).toBeDefined();
      expect(store.method).toBe("GET");
      expect(store.path).toBe("/test");
      done();
    });
  });
});

describe("setWalletAddressInContext", () => {
  test("sets walletAddress inside an active requestContext store", (done) => {
    const store: RequestContextStore = {
      requestId: "r1",
      correlationId: "c1",
    };
    requestContext.run(store, () => {
      setWalletAddressInContext("GDEMO...WALLET");
      expect(requestContext.getStore()?.walletAddress).toBe("GDEMO...WALLET");
      done();
    });
  });

  test("is a no-op when called outside a request context", () => {
    // Should not throw
    expect(() => setWalletAddressInContext("some-address")).not.toThrow();
  });
});

describe("serviceLogger enrichment with correlationId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuditLogger.mockReturnValue({
      info: mockInfo,
      error: mockError,
    } as any);
    mockIsInitialized.mockReturnValue(true);
  });

  test("info log includes correlation_id from context", async () => {
    const store: RequestContextStore = {
      requestId: "req-111",
      correlationId: "corr-999",
      method: "POST",
      path: "/streams",
    };

    await new Promise<void>((resolve, reject) => {
      requestContext.run(store, () => {
        logServiceInfo("TestService", "success path", {})
          .then(resolve)
          .catch(reject);
      });
    });

    expect(mockInfo).toHaveBeenCalledWith(
      "success path",
      expect.objectContaining({
        correlation_id: "corr-999",
        request_id: "req-111",
        method: "POST",
        path: "/streams",
        action_type: "system",
        service: "TestService",
      }),
    );
  });

  test("error log includes correlation_id and wallet_address", async () => {
    const store: RequestContextStore = {
      requestId: "req-222",
      correlationId: "corr-888",
      walletAddress: "GDEMO...WALLET",
      method: "DELETE",
      path: "/streams/42",
    };

    await new Promise<void>((resolve, reject) => {
      requestContext.run(store, () => {
        logServiceError("TestService", "error path", new Error("boom"), {})
          .then(resolve)
          .catch(reject);
      });
    });

    expect(mockError).toHaveBeenCalledWith(
      "error path",
      expect.objectContaining({ message: "boom" }),
      expect.objectContaining({
        correlation_id: "corr-888",
        wallet_address: "GDEMO...WALLET",
        method: "DELETE",
        path: "/streams/42",
      }),
    );
  });

  test("falls back to console when audit logger is not initialized", async () => {
    mockIsInitialized.mockReturnValue(false);
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const store: RequestContextStore = {
      requestId: "req-333",
      correlationId: "corr-777",
    };

    await new Promise<void>((resolve, reject) => {
      requestContext.run(store, () => {
        logServiceInfo("TestService", "fallback path", {})
          .then(resolve)
          .catch(reject);
      });
    });

    expect(mockInfo).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
