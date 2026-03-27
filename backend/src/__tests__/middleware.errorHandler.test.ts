import { errorHandler, notFoundHandler } from "../middleware/errorHandler";

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: false,
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
    const req = { originalUrl: "/nonexistent-route" } as any;
    const res = createResponse();

    notFoundHandler(req, res as any);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      type: "https://quipay.io/errors/not-found",
      title: "Not Found",
      status: 404,
      detail: "The requested resource '/nonexistent-route' was not found",
      instance: "/nonexistent-route",
    });
  });

  it("returns RFC 7807 details for unexpected errors", () => {
    const req = {
      originalUrl: "/boom",
      method: "GET",
    } as any;
    const res = createResponse();
    const next = jest.fn();
    const err = new Error("kaboom");

    errorHandler(err, req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      type: "https://quipay.io/errors/internal-error",
      title: "Internal Server Error",
      status: 500,
      detail: "kaboom",
      instance: "/boom",
    });
  });
});
