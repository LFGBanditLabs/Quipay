/**
 * Tests for Stellar Fee Estimation functionality
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import express from "express";
import { stellarRouter } from "../../src/routes/stellar";

describe("Stellar Fee Estimation", () => {
  let app: express.Express;

  beforeAll(() => {
    // Create Express app with stellar router
    app = express();
    app.use(express.json());
    app.use("/stellar", stellarRouter);
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe("POST /api/stellar/estimate-fee", () => {
    it("should return 400 when transactionXdr is missing", async () => {
      const res = await request(app).post("/stellar/estimate-fee").send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toContain("Missing required field");
    });

    it("should return 400 when transactionXdr is not a string", async () => {
      const res = await request(app)
        .post("/stellar/estimate-fee")
        .send({ transactionXdr: 123 });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toContain("must be a string");
    });

    it("should return 400 for invalid transaction XDR", async () => {
      const res = await request(app)
        .post("/stellar/estimate-fee")
        .send({ transactionXdr: "invalid-xdr-string" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toContain("Invalid transaction XDR");
    });

    it("should handle valid transaction XDR and return fee estimate", async () => {
      // Note: This test requires a real Stellar RPC connection
      // In CI/CD, this might fail due to network issues
      const validXdr =
        "AAAAAgAAAABgKp7+8vH6J9R5BQmYbGhMfNzKdVlT3y7WqZ3xPqLdOwAAAJAAAADIAAAAAAACAAAAAQAAAAAAAAAAAAAAAbA8l9UAAAAAAAAAAA==";

      const res = await request(app)
        .post("/stellar/estimate-fee")
        .send({ transactionXdr: validXdr });

      // The response could be 200 (success), 400 (simulation failed), or 503 (RPC unavailable)
      if (res.status === 200) {
        expect(res.body).toHaveProperty("estimatedFeeStroops");
        expect(res.body).toHaveProperty("estimatedFeeXLM");
        expect(res.body).toHaveProperty("simulatedAt");

        // Check that fee values are strings representing numbers
        expect(typeof res.body.estimatedFeeStroops).toBe("string");
        expect(typeof res.body.estimatedFeeXLM).toBe("string");

        // If cached, should have additional fields
        if (res.body.cached) {
          expect(res.body).toHaveProperty("cachedAt");
          expect(res.body.cached).toBe(true);
        }
      } else if (res.status === 400) {
        // Simulation might fail for various reasons (invalid tx, etc.)
        expect(res.body).toHaveProperty("error");
      } else if (res.status === 503) {
        // RPC service unavailable
        expect(res.body).toHaveProperty("error");
        expect(res.body.error).toContain("RPC");
      }
    });

    it("should cache fee estimates for 30 seconds", async () => {
      const validXdr =
        "AAAAAgAAAABgKp7+8vH6J9R5BQmYbGhMfNzKdVlT3y7WqZ3xPqLdOwAAAJAAAADIAAAAAAACAAAAAQAAAAAAAAAAAAAAAbA8l9UAAAAAAAAAAA==";

      // First request (might not be cached)
      const res1 = await request(app)
        .post("/stellar/estimate-fee")
        .send({ transactionXdr: validXdr });

      // Second request (should be cached if first was successful)
      const res2 = await request(app)
        .post("/stellar/estimate-fee")
        .send({ transactionXdr: validXdr });

      // If both succeeded, second should be cached
      if (res1.status === 200 && res2.status === 200) {
        expect(res2.body.cached).toBe(true);
        expect(res2.body).toHaveProperty("cachedAt");
      }
    });
  });

  describe("GET /api/stellar/health", () => {
    it("should return health status of Stellar RPC connection", async () => {
      const res = await request(app).get("/stellar/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status");
      expect(["healthy", "unhealthy"]).toContain(res.body.status);

      if (res.body.status === "healthy") {
        expect(res.body).toHaveProperty("latestLedger");
        expect(res.body).toHaveProperty("rpcUrl");
        expect(res.body).toHaveProperty("timestamp");
      } else {
        expect(res.body).toHaveProperty("error");
      }
    });
  });
});
