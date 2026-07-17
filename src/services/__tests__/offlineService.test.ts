import { openDB } from "idb";
import { DYNAMIC_DATA_CACHE_TTL_MS, getCache } from "../offlineService";

jest.mock("idb", () => ({
  openDB: jest.fn(),
}));

const db = {
  get: jest.fn(),
  delete: jest.fn(),
};

const openDBMock = jest.mocked(openDB);

describe("offlineService getCache", () => {
  beforeAll(() => {
    openDBMock.mockResolvedValue(db as never);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-17T12:00:00Z"));
    db.get.mockReset();
    db.delete.mockReset();
    db.delete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns cached data when the entry is within the TTL", async () => {
    const data = [{ id: "stream-1" }];
    db.get.mockResolvedValue({
      key: "worker-streams-GWORKER",
      data,
      timestamp: Date.now() - DYNAMIC_DATA_CACHE_TTL_MS,
    });

    await expect(
      getCache<typeof data>(
        "worker-streams-GWORKER",
        DYNAMIC_DATA_CACHE_TTL_MS,
      ),
    ).resolves.toEqual(data);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("deletes and rejects cached data older than the TTL", async () => {
    db.get.mockResolvedValue({
      key: "worker-streams-GWORKER",
      data: [{ id: "stale-stream" }],
      timestamp: Date.now() - DYNAMIC_DATA_CACHE_TTL_MS - 1,
    });

    await expect(
      getCache("worker-streams-GWORKER", DYNAMIC_DATA_CACHE_TTL_MS),
    ).resolves.toBeNull();
    expect(db.delete).toHaveBeenCalledWith(
      "payroll-cache",
      "worker-streams-GWORKER",
    );
  });

  it("preserves callers that do not request expiry", async () => {
    const data = ["legacy-cache"];
    db.get.mockResolvedValue({
      key: "legacy",
      data,
      timestamp: 0,
    });

    await expect(getCache<typeof data>("legacy")).resolves.toEqual(data);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("returns null without deleting when the key is missing", async () => {
    db.get.mockResolvedValue(undefined);

    await expect(
      getCache("missing", DYNAMIC_DATA_CACHE_TTL_MS),
    ).resolves.toBeNull();
    expect(db.delete).not.toHaveBeenCalled();
  });
});
