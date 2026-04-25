import request from "supertest";
import express from "express";
import cors from "cors";
import {
  createCorsOptions,
  DEFAULT_ALLOWED_ORIGINS,
  getAllowedOrigins,
} from "../config/cors";
import { errorHandler } from "../middleware/errorHandler";

describe("CORS Origin Whitelist", () => {
  let app: express.Application;
  const originalEnv = process.env;

  const wireTestApp = (allowedOrigins: string[]) => {
    app.use(cors(createCorsOptions(allowedOrigins)));

    app.get("/test", (req, res) => {
      res.json({ success: true });
    });

    app.use(errorHandler);
  };

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    app = express();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should allow requests from whitelisted origins", async () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173,https://app.quipay.io";
    wireTestApp(getAllowedOrigins());

    const response = await request(app)
      .get("/test")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("should block requests from non-whitelisted origins", async () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    wireTestApp(getAllowedOrigins());

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://malicious-site.com");

    expect(response.status).toBe(403);
    expect(response.body.detail).toBe("Not allowed by CORS");
  });

  it("should allow requests with no origin (e.g., curl, Postman)", async () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";
    wireTestApp(getAllowedOrigins());

    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should use default allowlist when ALLOWED_ORIGINS is not set", () => {
    delete process.env.ALLOWED_ORIGINS;

    expect(getAllowedOrigins()).toEqual(DEFAULT_ALLOWED_ORIGINS);
  });
});
