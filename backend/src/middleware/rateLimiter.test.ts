import { NextFunction, Request, Response } from "express";
import {
  extractWalletAddress,
  resetWalletRateLimiterStore,
  standardRateLimiter,
} from "./rateLimiter";

function makeWallet(fill: string): string {
  return `G${fill.repeat(55)}`;
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    originalUrl: "/wallet-limited",
    path: "/wallet-limited",
    method: "GET",
    ip: "127.0.0.1",
    ...overrides,
  } as Request;
}

function createResponse(): Response {
  const headers = new Map<string, string>();
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn((name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    }),
    getHeader: jest.fn((name: string) => headers.get(name.toLowerCase())),
  };

  return response as unknown as Response;
}

describe("extractWalletAddress", () => {
  it("extracts a Stellar wallet from JWT claims", () => {
    const wallet = makeWallet("J");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        role: "user",
        stellarAddress: wallet,
      }),
    ).toString("base64url");

    const req = createRequest({
      headers: { authorization: `Bearer header.${payload}.signature` },
    });

    expect(extractWalletAddress(req)).toBe(wallet);
  });

  it("extracts a Stellar wallet from the Authorization header", () => {
    const wallet = makeWallet("A");
    const req = createRequest({
      headers: { authorization: `Bearer ${wallet}` },
    });

    expect(extractWalletAddress(req)).toBe(wallet);
  });

  it("falls back to wallet fields in the request body", () => {
    const wallet = makeWallet("B");
    const req = createRequest({
      body: { wallet_address: wallet },
    });

    expect(extractWalletAddress(req)).toBe(wallet);
  });
});

describe("standardRateLimiter", () => {
  beforeEach(() => {
    resetWalletRateLimiterStore();
    jest.restoreAllMocks();
  });

  it("tracks authenticated requests per Stellar address from JWT claims", () => {
    const wallet = makeWallet("C");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        role: "user",
        stellar_address: wallet,
      }),
    ).toString("base64url");
    const req = createRequest({
      headers: { authorization: `Bearer header.${payload}.signature` },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    standardRateLimiter(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "30");
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "29");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("uses a stricter write quota for mutating requests", () => {
    const wallet = makeWallet("D");
    const req = createRequest({
      method: "POST",
      headers: { "x-wallet-address": wallet },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    for (let count = 0; count < 5; count += 1) {
      standardRateLimiter(req, res, next);
    }

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
    expect(next).toHaveBeenCalledTimes(5);

    standardRateLimiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "60");
  });

  it("falls back to IP-based limiting for unauthenticated requests", () => {
    const req = createRequest({ ip: "203.0.113.10" });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    standardRateLimiter(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "30");
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "29");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not share counters across different identities", () => {
    const firstWallet = makeWallet("E");
    const secondWallet = makeWallet("F");
    const firstReq = createRequest({
      headers: { "x-wallet-address": firstWallet },
    });
    const secondReq = createRequest({
      headers: { "x-wallet-address": secondWallet },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    standardRateLimiter(firstReq, res, next);
    standardRateLimiter(secondReq, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });
});
