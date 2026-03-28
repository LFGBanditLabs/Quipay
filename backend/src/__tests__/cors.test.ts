import request from "supertest";
import express from "express";
import cors from "cors";

describe("CORS Origin Whitelist", () => {
  let app: express.Application;
  const originalEnv = process.env;

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

    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS.split(",").map(
      (origin) => origin.trim(),
    );

    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) {
            return callback(null, true);
          }
          if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
      }),
    );

    app.get("/test", (req, res) => {
      res.json({ success: true });
    });

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

    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS.split(",").map(
      (origin) => origin.trim(),
    );

    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) {
            return callback(null, true);
          }
          if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
      }),
    );

    app.get("/test", (req, res) => {
      res.json({ success: true });
    });

    // Add error handler
    app.use(
      (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        if (err.message === "Not allowed by CORS") {
          res.status(403).json({ error: "Not allowed by CORS" });
        } else {
          next(err);
        }
      },
    );

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://malicious-site.com");

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Not allowed by CORS");
  });

  it("should allow requests with no origin (e.g., curl, Postman)", async () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:5173";

    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS.split(",").map(
      (origin) => origin.trim(),
    );

    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) {
            return callback(null, true);
          }
          if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
      }),
    );

    app.get("/test", (req, res) => {
      res.json({ success: true });
    });

    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should use default localhost origin when ALLOWED_ORIGINS is not set", () => {
    delete process.env.ALLOWED_ORIGINS;

    const envValue = process.env.ALLOWED_ORIGINS;
    const ALLOWED_ORIGINS = envValue
      ? (envValue as string).split(",").map((origin: string) => origin.trim())
      : ["http://localhost:5173"];

    expect(ALLOWED_ORIGINS).toEqual(["http://localhost:5173"]);
  });
});
