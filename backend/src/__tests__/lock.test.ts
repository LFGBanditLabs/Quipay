import { withAdvisoryLock } from "../utils/lock";
import * as pool from "../db/pool";

jest.mock("../db/pool", () => ({
  query: jest.fn(),
}));

describe("withAdvisoryLock", () => {
  const mockQuery = pool.query as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should execute task if lock is acquired", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: true }] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // unlock

    const task = jest.fn().mockResolvedValue(undefined);
    await withAdvisoryLock(123, task, "test-task");

    expect(task).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT pg_try_advisory_lock($1)",
      [123],
    );
    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT pg_advisory_unlock($1)",
      [123],
    );
  });

  it("should skip task if lock is not acquired", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ pg_try_advisory_lock: false }],
    });

    const task = jest.fn().mockResolvedValue(undefined);
    await withAdvisoryLock(123, task, "test-task");

    expect(task).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(1); // only try_lock
  });

  it("should release lock even if task fails", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: true }] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // unlock

    const task = jest.fn().mockRejectedValue(new Error("task-failed"));

    await expect(withAdvisoryLock(123, task, "test-task")).rejects.toThrow(
      "task-failed",
    );

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT pg_advisory_unlock($1)",
      [123],
    );
  });
});
