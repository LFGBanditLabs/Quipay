import { NextFunction, Request, Response } from "express";
import { requireMonitorStatusAdminToken } from "./monitorStatusAuth";

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

function createResponse(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("requireMonitorStatusAdminToken", () => {
  const originalToken = process.env.MONITOR_STATUS_ADMIN_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.MONITOR_STATUS_ADMIN_TOKEN;
      return;
    }

    process.env.MONITOR_STATUS_ADMIN_TOKEN = originalToken;
  });

  it("allows requests when MONITOR_STATUS_ADMIN_TOKEN is not configured", () => {
    delete process.env.MONITOR_STATUS_ADMIN_TOKEN;
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireMonitorStatusAdminToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows requests with a valid bearer token", () => {
    process.env.MONITOR_STATUS_ADMIN_TOKEN = "monitor-secret";
    const req = createRequest({
      headers: { authorization: "Bearer monitor-secret" },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireMonitorStatusAdminToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects requests missing authorization when token is configured", () => {
    process.env.MONITOR_STATUS_ADMIN_TOKEN = "monitor-secret";
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireMonitorStatusAdminToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unauthorized: invalid monitor status token",
    });
  });

  it("rejects requests with a wrong bearer token", () => {
    process.env.MONITOR_STATUS_ADMIN_TOKEN = "monitor-secret";
    const req = createRequest({
      headers: { authorization: "Bearer wrong-token" },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireMonitorStatusAdminToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unauthorized: invalid monitor status token",
    });
  });
});
