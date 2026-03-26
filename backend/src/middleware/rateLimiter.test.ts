import { NextFunction, Request, Response } from "express";
import {
  createWalletSlidingWindowRateLimiter,
  extractWalletAddress,
  resetWalletRateLimiterStore,
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

describe("createWalletSlidingWindowRateLimiter", () => {
  const middleware = createWalletSlidingWindowRateLimiter(2, 60_000, "test");

  beforeEach(() => {
    resetWalletRateLimiterStore();
    jest.restoreAllMocks();
  });

  it("tracks requests independently per wallet and sets X-RateLimit-Remaining", () => {
    const wallet = makeWallet("C");
    const req = createRequest({
      headers: { "x-wallet-address": wallet },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "1");
    expect(next).toHaveBeenCalledTimes(1);

    middleware(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("returns 429 once the wallet exceeds the sliding window limit", () => {
    const wallet = makeWallet("D");
    const req = createRequest({
      headers: { "x-wallet-address": wallet },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);
    middleware(req, res, next);
    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "60");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("does not share counters across different wallets", () => {
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

    middleware(firstReq, res, next);
    middleware(secondReq, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });
});
