/**
 * Tests for Issue #856: IPFS proof generation and storage flow
 *
 * Verifies:
 * - pinProofToIPFS calls Pinata API and returns CID + URLs
 * - generateAndStoreProof builds proof JSON, pins it, and stores CID in DB
 * - Idempotency: second call returns existing CID without re-pinning
 * - Graceful handling of Pinata API failures
 * - ConfigError thrown when PINATA_JWT is missing
 */

import axios from "axios";
import { jest } from "@jest/globals";

// ── Mock axios before importing the module under test ─────────────────────────
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ── Mock DB queries ───────────────────────────────────────────────────────────
jest.mock("../db/queries", () => ({
  getProofByStreamId: jest.fn(),
  insertPayrollProof: jest.fn(),
  getStreamById: jest.fn(),
}));

// ── Mock circuit breaker to pass through directly ────────────────────────────
jest.mock("../utils/circuitBreaker", () => ({
  createCircuitBreaker: jest.fn((fn: any) => ({
    fire: (...args: any[]) => fn(...args),
  })),
}));

// ── Mock metrics (required by circuitBreaker) ─────────────────────────────────
jest.mock("../metrics", () => ({
  circuitBreakerState: { set: jest.fn() },
  circuitBreakerFailures: { inc: jest.fn() },
  circuitBreakerSuccesses: { inc: jest.fn() },
  circuitBreakerFallbacks: { inc: jest.fn() },
}));

// ── Mock pool ─────────────────────────────────────────────────────────────────
jest.mock("../db/pool", () => ({
  getPool: jest.fn(() => ({})),
  query: jest.fn(),
}));

import { pinProofToIPFS, PayrollProof } from "../services/ipfsService";
import { generateAndStoreProof } from "../services/proofService";
import {
  getProofByStreamId,
  insertPayrollProof,
  getStreamById,
} from "../db/queries";

const mockGetProofByStreamId = getProofByStreamId as jest.MockedFunction<
  typeof getProofByStreamId
>;
const mockInsertPayrollProof = insertPayrollProof as jest.MockedFunction<
  typeof insertPayrollProof
>;
const mockGetStreamById = getStreamById as jest.MockedFunction<
  typeof getStreamById
>;

const MOCK_CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

const sampleProof: PayrollProof = {
  schemaVersion: "1.0",
  streamId: 42,
  employer_address: "GABC123",
  worker_address: "GDEF456",
  tokenAddress: "",
  tokenSymbol: "USDC",
  totalAmount: "100.0000000",
  withdrawnAmount: "100.0000000",
  startTs: 1700000000,
  endTs: 1702592000,
  closedAt: 1702592000,
  txHash: "abc123txhash",
  generatedAt: "2024-01-01T00:00:00.000Z",
  network: "TESTNET",
  contractId: "CTEST123",
};

const completedStream = {
  stream_id: 42,
  employer_address: "GABC123",
  worker_address: "GDEF456",
  total_amount: "1000000000",
  withdrawn_amount: "1000000000",
  start_ts: 1700000000,
  end_ts: 1702592000,
  status: "completed" as const,
  closed_at: 1702592000,
  ledger_created: 100,
  created_at: new Date(),
  updated_at: new Date(),
};

describe("ipfsService.pinProofToIPFS", () => {
  const originalJwt = process.env.PINATA_JWT;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalJwt === undefined) {
      delete process.env.PINATA_JWT;
    } else {
      process.env.PINATA_JWT = originalJwt;
    }
  });

  it("throws ConfigError when PINATA_JWT is not set", async () => {
    delete process.env.PINATA_JWT;
    await expect(pinProofToIPFS(sampleProof)).rejects.toThrow(
      "PINATA_JWT is not configured",
    );
  });

  it("calls Pinata API and returns CID + URLs", async () => {
    process.env.PINATA_JWT = "test-jwt-token";
    mockedAxios.post = jest.fn<any>().mockResolvedValue({
      data: { IpfsHash: MOCK_CID },
    });

    const result = await pinProofToIPFS(sampleProof);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      expect.objectContaining({
        pinataContent: sampleProof,
        pinataMetadata: expect.objectContaining({
          name: `quipay-proof-stream-${sampleProof.streamId}.json`,
        }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-jwt-token",
        }),
      }),
    );

    expect(result.cid).toBe(MOCK_CID);
    expect(result.ipfsUrl).toBe(`ipfs://${MOCK_CID}`);
    expect(result.gatewayUrl).toContain(MOCK_CID);
  });

  it("propagates Pinata API errors", async () => {
    process.env.PINATA_JWT = "test-jwt-token";
    mockedAxios.post = jest
      .fn<any>()
      .mockRejectedValue(new Error("Pinata 503 Service Unavailable"));

    await expect(pinProofToIPFS(sampleProof)).rejects.toThrow(
      "Pinata 503 Service Unavailable",
    );
  });
});

describe("proofService.generateAndStoreProof", () => {
  const originalJwt = process.env.PINATA_JWT;

  beforeEach(() => {
    process.env.PINATA_JWT = "test-jwt-token";
    mockedAxios.post = jest.fn<any>().mockResolvedValue({
      data: { IpfsHash: MOCK_CID },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (originalJwt === undefined) {
      delete process.env.PINATA_JWT;
    } else {
      process.env.PINATA_JWT = originalJwt;
    }
  });

  it("returns null for non-completed streams", async () => {
    const activeStream = { ...completedStream, status: "active" as const };
    mockGetStreamById.mockResolvedValue(activeStream);
    mockGetProofByStreamId.mockResolvedValue(null);

    const cid = await generateAndStoreProof(activeStream);
    expect(cid).toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("returns existing CID without re-pinning (idempotent)", async () => {
    mockGetProofByStreamId.mockResolvedValue({
      id: 1,
      stream_id: 42,
      cid: MOCK_CID,
      ipfs_url: `ipfs://${MOCK_CID}`,
      gateway_url: `https://gateway.pinata.cloud/ipfs/${MOCK_CID}`,
      proof_json: sampleProof,
      created_at: new Date(),
    });

    const cid = await generateAndStoreProof(completedStream);

    expect(cid).toBe(MOCK_CID);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockInsertPayrollProof).not.toHaveBeenCalled();
  });

  it("pins proof and stores CID for a completed stream", async () => {
    mockGetProofByStreamId.mockResolvedValue(null);
    mockInsertPayrollProof.mockResolvedValue(undefined);

    const cid = await generateAndStoreProof(completedStream);

    expect(cid).toBe(MOCK_CID);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockInsertPayrollProof).toHaveBeenCalledWith(
      expect.objectContaining({
        streamId: 42,
        cid: MOCK_CID,
        ipfsUrl: `ipfs://${MOCK_CID}`,
        gatewayUrl: expect.stringContaining(MOCK_CID),
        proofJson: expect.objectContaining({ streamId: 42 }),
      }),
    );
  });

  it("returns null gracefully when Pinata fails", async () => {
    mockGetProofByStreamId.mockResolvedValue(null);
    mockedAxios.post = jest
      .fn<any>()
      .mockRejectedValue(new Error("Network error"));

    const cid = await generateAndStoreProof(completedStream);

    expect(cid).toBeNull();
    expect(mockInsertPayrollProof).not.toHaveBeenCalled();
  });

  it("fetches stream by ID when passed a number", async () => {
    mockGetStreamById.mockResolvedValue(completedStream);
    mockGetProofByStreamId.mockResolvedValue(null);
    mockInsertPayrollProof.mockResolvedValue(undefined);

    const cid = await generateAndStoreProof(42);

    expect(mockGetStreamById).toHaveBeenCalledWith(42);
    expect(cid).toBe(MOCK_CID);
  });

  it("returns null when stream ID is not found", async () => {
    mockGetStreamById.mockResolvedValue(null);

    const cid = await generateAndStoreProof(999);

    expect(cid).toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
