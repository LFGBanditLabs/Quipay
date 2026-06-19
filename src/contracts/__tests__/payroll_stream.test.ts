import { submitAndAwaitTx } from "../payroll_stream";
import * as SorobanClient from "@stellar/stellar-sdk";

// Mock the getRpcServer and network passphrase
jest.mock("../payroll_stream", () => {
  const actual = jest.requireActual("../payroll_stream");
  return {
    ...actual,
    submitAndAwaitTx: actual.submitAndAwaitTx,
  };
});

describe("submitAndAwaitTx exponential backoff", () => {
  let mockServer: any;
  let mockTx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockTx = {
      hash: () => "test-tx-hash",
    };

    mockServer = {
      sendTransaction: jest.fn(),
      getTransaction: jest.fn(),
    };

    // Mock TransactionBuilder.fromXDR
    jest
      .spyOn(SorobanClient.TransactionBuilder, "fromXDR")
      .mockReturnValue(mockTx as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should handle NOT_FOUND then SUCCESS within timeout", async () => {
    mockServer.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "test-tx-hash",
    });

    // First two calls return NOT_FOUND, third returns SUCCESS
    mockServer.getTransaction
      .mockResolvedValueOnce({
        status: "NOT_FOUND",
      })
      .mockResolvedValueOnce({
        status: "NOT_FOUND",
      })
      .mockResolvedValueOnce({
        status: "SUCCESS",
      });

    // Mock getRpcServer to return our mock
    const originalModule = jest.requireActual("../payroll_stream");
    jest
      .spyOn(originalModule as any, "getRpcServer")
      .mockReturnValue(mockServer);

    const promise = originalModule.submitAndAwaitTx("fake-xdr");

    // Advance through the backoff delays
    // First poll: immediate
    await jest.advanceTimersByTimeAsync(0);
    // Second poll: ~500ms + jitter
    await jest.advanceTimersByTimeAsync(650);
    // Third poll: ~1000ms + jitter
    await jest.advanceTimersByTimeAsync(1300);

    const hash = await promise;

    expect(hash).toBe("test-tx-hash");
    expect(mockServer.getTransaction).toHaveBeenCalledTimes(3);
    expect(mockServer.getTransaction).toHaveBeenCalledWith("test-tx-hash");
  });

  it("should timeout after 30 seconds", async () => {
    mockServer.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "test-tx-hash",
    });

    // Always return PENDING
    mockServer.getTransaction.mockResolvedValue({
      status: "PENDING",
    });

    const originalModule = jest.requireActual("../payroll_stream");
    jest
      .spyOn(originalModule as any, "getRpcServer")
      .mockReturnValue(mockServer);

    const promise = originalModule.submitAndAwaitTx("fake-xdr");

    // Advance past 30 seconds
    await jest.advanceTimersByTimeAsync(31000);

    await expect(promise).rejects.toThrow(/timed out after \d+s/);
  });

  it("should throw on FAILED status", async () => {
    mockServer.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "test-tx-hash",
    });

    mockServer.getTransaction.mockResolvedValue({
      status: "FAILED",
    });

    const originalModule = jest.requireActual("../payroll_stream");
    jest
      .spyOn(originalModule as any, "getRpcServer")
      .mockReturnValue(mockServer);

    const promise = originalModule.submitAndAwaitTx("fake-xdr");

    await jest.advanceTimersByTimeAsync(0);

    await expect(promise).rejects.toThrow("Transaction failed on-chain");
    await expect(promise).rejects.toThrow("test-tx-hash");
  });

  it("should throw on submission ERROR", async () => {
    mockServer.sendTransaction.mockResolvedValue({
      status: "ERROR",
      errorResult: { code: "tx_failed" },
    });

    const originalModule = jest.requireActual("../payroll_stream");
    jest
      .spyOn(originalModule as any, "getRpcServer")
      .mockReturnValue(mockServer);

    await expect(originalModule.submitAndAwaitTx("fake-xdr")).rejects.toThrow(
      "Transaction submission failed",
    );
  });

  it("should treat NOT_FOUND same as PENDING (no early exit)", async () => {
    mockServer.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "test-tx-hash",
    });

    // Many NOT_FOUND responses should not cause early exit
    const notFoundCount = 10;
    for (let i = 0; i < notFoundCount; i++) {
      mockServer.getTransaction.mockResolvedValueOnce({
        status: "NOT_FOUND",
      });
    }
    mockServer.getTransaction.mockResolvedValueOnce({
      status: "SUCCESS",
    });

    const originalModule = jest.requireActual("../payroll_stream");
    jest
      .spyOn(originalModule as any, "getRpcServer")
      .mockReturnValue(mockServer);

    const promise = originalModule.submitAndAwaitTx("fake-xdr");

    // Advance through all the polls
    for (let i = 0; i < notFoundCount + 1; i++) {
      await jest.advanceTimersByTimeAsync(2500); // Max delay is 2s + jitter
    }

    const hash = await promise;

    expect(hash).toBe("test-tx-hash");
    expect(mockServer.getTransaction).toHaveBeenCalledTimes(notFoundCount + 1);
  });
});
