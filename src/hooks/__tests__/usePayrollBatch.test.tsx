import React, { act } from "react";
import renderer from "react-test-renderer";
import { usePayroll, BatchStreamInputItem } from "../usePayroll";
import { NotificationProvider } from "../../providers/NotificationProvider";

// Mock useWallet
jest.mock("../useWallet", () => ({
  useWallet: () => ({
    address: "GEMPLOYER123",
  }),
}));

// Mock useAuth
jest.mock("../useAuth", () => ({
  useAuth: () => ({
    authenticated: false,
    getAccessToken: async () => null,
  }),
}));

// Mock payroll contracts
jest.mock("../../contracts/payroll_vault", () => ({
  getAllVaultData: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../contracts/payroll_stream", () => ({
  buildCreateStreamTx: jest.fn().mockImplementation((params) => {
    if (params.worker === "GFAIL_WORKER") {
      throw new Error("Worker not found or blacklisted");
    }
    return Promise.resolve({ preparedXdr: "AAAA_MOCK_XDR" });
  }),
  submitAndAwaitTx: jest.fn().mockResolvedValue("0xmocktxhash123"),
  getStreamsByWorker: jest.fn().mockResolvedValue([]),
  getStreamById: jest.fn().mockResolvedValue(null),
  getTokenSymbol: jest.fn().mockResolvedValue("USDC"),
}));

jest.mock("../../contracts/workforce_registry", () => ({
  getWorkersByEmployer: jest.fn().mockResolvedValue([]),
}));

const HookConsumer: React.FC<{
  onHook: (h: ReturnType<typeof usePayroll>) => void;
}> = ({ onHook }) => {
  const h = usePayroll("GEMPLOYER123");
  onHook(h);
  return null;
};

describe("usePayroll batch creation", () => {
  it("processes streams in batch, tracks progress, and continues on individual errors", async () => {
    let hook!: ReturnType<typeof usePayroll>;

    await act(async () => {
      renderer.create(
        <NotificationProvider>
          <HookConsumer onHook={(h) => (hook = h)} />
        </NotificationProvider>,
      );
    });

    const items: BatchStreamInputItem[] = [
      {
        id: "1",
        rowIndex: 1,
        qpId: "QP100000001",
        email: "worker1@test.com",
        workerAddress: "GWORKER1",
        amount: 5000,
        token: "USDC",
        startDate: "2026-09-01",
        endDate: "2027-08-31",
      },
      {
        id: "2",
        rowIndex: 2,
        qpId: "QP100000002",
        email: "fail@test.com",
        workerAddress: "GFAIL_WORKER",
        amount: 3000,
        token: "USDC",
        startDate: "2026-09-01",
        endDate: "2027-08-31",
      },
      {
        id: "3",
        rowIndex: 3,
        qpId: "QP100000003",
        email: "worker3@test.com",
        workerAddress: "GWORKER3",
        amount: 2000,
        token: "XLM",
        startDate: "2026-09-01",
        endDate: "2027-08-31",
      },
    ];

    const mockSignXdr = jest.fn().mockResolvedValue("AAAA_SIGNED_XDR");
    const progressUpdates: number[] = [];

    let results!: Awaited<ReturnType<typeof hook.createBatchStreams>>;
    await act(async () => {
      results = await hook.createBatchStreams(
        items,
        mockSignXdr,
        (progress) => {
          progressUpdates.push(progress.currentIndex);
        },
      );
    });

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("success");
    expect(results[0].txHash).toBe("0xmocktxhash123");

    // Second item should fail gracefully without crashing the loop
    expect(results[1].status).toBe("error");
    expect(results[1].error).toContain("Worker not found");

    // Third item should succeed
    expect(results[2].status).toBe("success");
    expect(results[2].txHash).toBe("0xmocktxhash123");

    // Verify progress callbacks
    expect(progressUpdates).toContain(3);
  });
});
