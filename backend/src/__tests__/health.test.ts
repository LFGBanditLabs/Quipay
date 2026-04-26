// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { getHealthResponse } from "../health";

const mockGetPool: jest.Mock = jest.fn();
const mockIsHealthy: jest.Mock = jest.fn();
const mockIsTokenValid: jest.Mock = jest.fn();
const mockGetLatestLedger: jest.Mock = jest.fn();

jest.mock("../db/pool", () => ({
  getPool: () => mockGetPool(),
}));

jest.mock("../services/vaultService", () => ({
  vaultService: {
    isHealthy: () => mockIsHealthy(),
    isTokenValid: () => mockIsTokenValid(),
  },
}));

jest.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: jest.fn().mockImplementation(() => ({
      getLatestLedger: () => mockGetLatestLedger(),
    })),
  },
}));

describe("getHealthResponse", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      VAULT_ADDR: "http://localhost:8200",
      VAULT_TOKEN: "test-token",
    };
  });

  it("returns 200 and ok when all dependencies are healthy", async () => {
    mockGetPool.mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
      options: { max: 10 },
    });
    mockGetLatestLedger.mockResolvedValue({ sequence: 12345 });
    mockIsHealthy.mockResolvedValue(true);
    mockIsTokenValid.mockResolvedValue(true);

    const result = await getHealthResponse(Date.now() - 3000);

    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe("ok");
    expect(result.body.dependencies.database.status).toBe("healthy");
    expect(result.body.dependencies.stellarRpc.status).toBe("healthy");
    expect(result.body.dependencies.vault.status).toBe("healthy");
  });

  it("returns 503 and degraded when database is not initialized", async () => {
    mockGetPool.mockReturnValue(null);
    mockGetLatestLedger.mockResolvedValue({ sequence: 12345 });
    mockIsHealthy.mockResolvedValue(true);
    mockIsTokenValid.mockResolvedValue(true);

    const result = await getHealthResponse(Date.now() - 3000);

    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("degraded");
    expect(result.body.dependencies.database.status).toBe("unhealthy");
  });

  it("returns 503 when vault token is invalid", async () => {
    mockGetPool.mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
      totalCount: 2,
      idleCount: 1,
      waitingCount: 1,
      options: { max: 4 },
    });
    mockGetLatestLedger.mockResolvedValue({ sequence: 12345 });
    mockIsHealthy.mockResolvedValue(true);
    mockIsTokenValid.mockResolvedValue(false);

    const result = await getHealthResponse(Date.now() - 3000);

    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("degraded");
    expect(result.body.dependencies.vault.status).toBe("unhealthy");
    expect(result.body.dependencies.vault.details).toMatch(/invalid|expired/i);
  });
});
