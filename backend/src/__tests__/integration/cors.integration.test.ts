import request from "supertest";
import express from "express";
import cors from "cors";
import { createCorsOptions } from "../../config/cors";
import { errorHandler, notFoundHandler } from "../../middleware/errorHandler";

describe("CORS integration", () => {
  const buildApp = (allowedOrigins: string[]) => {
    const app = express();

    app.use(cors(createCorsOptions(allowedOrigins)));

    app.get("/health", (_req, res) => {
      res.status(200).json({ status: "ok" });
    });

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
  };

  it("returns 403 for requests from non-allowlisted origins", async () => {
    const app = buildApp(["https://app.quipay.io", "http://localhost:3000"]);

    const response = await request(app)
      .get("/health")
      .set("Origin", "https://malicious.example");

    expect(response.status).toBe(403);
    expect(response.body.detail).toBe("Not allowed by CORS");
  });

  it("allows requests from allowlisted origins", async () => {
    const app = buildApp(["https://app.quipay.io", "http://localhost:3000"]);

    const response = await request(app)
      .get("/health")
      .set("Origin", "https://app.quipay.io");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://app.quipay.io",
    );
  });
});
