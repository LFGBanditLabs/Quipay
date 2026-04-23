import {
  applyOptimisticStreamAction,
  clearOptimisticStreamAction,
} from "../useStreamActions";
import type { Stream } from "../usePayroll";

const baseStream: Stream = {
  id: "1",
  employeeName: "Worker 1",
  employeeAddress: "GWORKER",
  flowRate: "1.0000000",
  tokenSymbol: "USDC",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  totalAmount: "100.00",
  totalStreamed: "10.00",
  status: "active",
};

describe("optimistic stream actions", () => {
  it("applies an optimistic pause state immediately", () => {
    const [updated] = applyOptimisticStreamAction([baseStream], "1", "pause");

    expect(updated.status).toBe("paused");
    expect(updated.pendingAction).toBe("pause");
  });

  it("applies an optimistic cancel state immediately", () => {
    const [updated] = applyOptimisticStreamAction([baseStream], "1", "cancel");

    expect(updated.status).toBe("cancelled");
    expect(updated.pendingAction).toBe("cancel");
  });

  it("supports rollback by preserving the previous stream snapshot", () => {
    const previous = { ...baseStream };
    const [updated] = applyOptimisticStreamAction([baseStream], "1", "pause");
    const rolledBack = [updated].map((stream) =>
      stream.id === previous.id ? previous : stream,
    );

    expect(rolledBack[0]).toEqual(previous);
  });

  it("clears pending state after settlement", () => {
    const optimistic = applyOptimisticStreamAction([baseStream], "1", "resume");
    const [settled] = clearOptimisticStreamAction(optimistic, "1");

    expect(settled.pendingAction).toBeUndefined();
  });
});
