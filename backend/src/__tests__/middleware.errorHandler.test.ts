import { errorHandler, notFoundHandler } from "../middleware/errorHandler";

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: false,
    headers: {} as Record<string, string>,
    getHeader(name: string) {
      return this.headers[name];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

describe("middleware/errorHandler", () => {
  it("returns RFC 7807 details for unknown routes", () => {
    const req = { originalUrl: "/nonexistent-route", headers: {} } as any;
    const res = createResponse();

    notFoundHandler(req, res as any);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      type: "https://quipay.io/errors/not-found",
      title: "Not Found",
      status: 404,
      detail: "The requested resource '/nonexistent-route' was not found",
      instance: "/nonexistent-route",
      requestId: "unknown",
    });
  });

  it("returns sanitized payload for unexpected server errors", () => {
    const req = {
      originalUrl: "/boom",
      method: "GET",
      headers: {},
    } as any;
    const res = createResponse();
    const next = jest.fn();
    const err = new Error("relation payroll_streams does not exist");

    errorHandler(err, req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: "Internal server error",
      requestId: "unknown",
    });
    expect(JSON.stringify(res.body)).not.toContain("relation payroll_streams");
  });
});
