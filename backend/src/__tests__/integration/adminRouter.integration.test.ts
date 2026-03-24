/**
 * Integration Tests: Admin Router – Authentication & RBAC
 *
 * Verifies that the /admin router correctly enforces access control:
 *   - Unauthenticated requests (missing credentials) → 401
 *   - Wrong role (insufficient privilege) → 403
 *   - Correct role → 200
 *   - Simulated expired/invalid token → 401
 *
 * The current auth implementation reads plain X-User-Role / X-User-ID
 * headers (see middleware/rbac.ts). These tests exercise the middleware
 * contracts so that switching to real JWT verification later doesn't
 * silently break the access rules.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { adminRouter } from "../../adminRouter";

// ── Mock heavy side-effectful imports so the router loads without real infra ──

jest.mock("../../db/dlq", () => ({
  getPendingDLQItems: jest.fn<() => Promise<[]>>().mockResolvedValue([]),
  getDLQItemById: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  updateDLQItemStatus: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  deleteDLQItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

jest.mock("../../queue/asyncQueue", () => ({
  enqueueJob: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

jest.mock("../../delivery", () => ({
  sendWebhookNotification: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
}));

jest.mock("../../syncer", () => ({
  startSyncer: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

// ── Minimal Express app wrapping the real adminRouter ─────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Headers representing a fully-authenticated admin user. */
const adminHeaders = { "x-user-id": "user-admin-1", "x-user-role": "admin" };

/** Headers representing a fully-authenticated superadmin user. */
const superAdminHeaders = {
  "x-user-id": "user-superadmin-1",
  "x-user-role": "superadmin",
};

/** Headers representing a standard (non-admin) user. */
const userHeaders = { "x-user-id": "user-std-1", "x-user-role": "user" };

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("Admin Router – Authentication & RBAC Integration Tests", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp();
  });

  // ── 1. Unauthenticated Requests ────────────────────────────────────────────

  describe("Unauthenticated requests → 401", () => {
    const adminOnlyRoutes: Array<[string, string]> = [
      ["GET", "/admin/users"],
      ["GET", "/admin/analytics"],
      ["GET", "/admin/scheduler/override"],
      ["GET", "/admin/dlq"],
      ["GET", "/admin/me"],
    ];

    it.each(adminOnlyRoutes)(
      "%s %s with no credentials returns 401",
      async (method, path) => {
        const res = await (request(app) as any)[method.toLowerCase()](path);
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({
          error: expect.stringMatching(/unauthorized/i),
        });
      },
    );

    it("POST /admin/users/:id/suspend with no credentials returns 401", async () => {
      const res = await request(app).post("/admin/users/42/suspend");
      expect(res.status).toBe(401);
    });

    it("DELETE /admin/users/:id with no credentials returns 401", async () => {
      const res = await request(app).delete("/admin/users/42");
      expect(res.status).toBe(401);
    });

    it("POST /admin/scheduler/override with no credentials returns 401", async () => {
      const res = await request(app).post("/admin/scheduler/override");
      expect(res.status).toBe(401);
    });

    it("POST /admin/dlq/:id/replay with no credentials returns 401", async () => {
      const res = await request(app).post("/admin/dlq/99/replay");
      expect(res.status).toBe(401);
    });

    it("DELETE /admin/dlq/:id with no credentials returns 401", async () => {
      const res = await request(app).delete("/admin/dlq/99");
      expect(res.status).toBe(401);
    });
  });

  // ── 2. Partial / Malformed Credentials ────────────────────────────────────

  describe("Partial or malformed credentials → 401", () => {
    it("returns 401 when only x-user-id is provided (missing role)", async () => {
      const res = await request(app)
        .get("/admin/users")
        .set("x-user-id", "user-1");
      expect(res.status).toBe(401);
    });

    it("returns 401 when only x-user-role is provided (missing id)", async () => {
      const res = await request(app)
        .get("/admin/users")
        .set("x-user-role", "admin");
      expect(res.status).toBe(401);
    });

    it("returns 401 when x-user-role contains an unknown role string", async () => {
      const res = await request(app)
        .get("/admin/users")
        .set("x-user-id", "user-1")
        .set("x-user-role", "unknown-role");
      expect(res.status).toBe(401);
    });

    it("returns 401 when x-user-role is empty", async () => {
      const res = await request(app)
        .get("/admin/users")
        .set("x-user-id", "user-1")
        .set("x-user-role", "");
      expect(res.status).toBe(401);
    });
  });

  // ── 3. JWT Expiry Simulation ───────────────────────────────────────────────

  describe("Simulated expired / invalid token → 401", () => {
    /**
     * The current implementation uses plain headers for auth. Once real JWT
     * verification is wired in (replacing extractUser in rbac.ts), the
     * middleware must reject expired tokens with 401.
     *
     * These tests simulate the expected contract by passing credentials that
     * the current extractor considers invalid (no recognised role), which maps
     * to the same 401 path an expired JWT would take.
     */
    it("returns 401 for an expired-token-like request (no valid credentials)", async () => {
      // Simulates a client that sent a previously-valid token that has now
      // been cleared / expired – i.e., headers are absent.
      const res = await request(app).get("/admin/me");
      expect(res.status).toBe(401);
    });

    it("returns 401 when token payload carries an unrecognised role claim", async () => {
      // In a real JWT scenario this would be an expired or tampered payload.
      const res = await request(app)
        .get("/admin/me")
        .set("x-user-id", "user-1")
        .set("x-user-role", "expired");
      expect(res.status).toBe(401);
    });
  });

  // ── 4. Insufficient Role (Authenticated but Wrong Role) → 403 ─────────────

  describe("Authenticated user with insufficient role → 403", () => {
    it("standard user cannot access GET /admin/users", async () => {
      const res = await request(app).get("/admin/users").set(userHeaders);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        error: expect.stringMatching(/forbidden/i),
      });
    });

    it("standard user cannot access GET /admin/analytics", async () => {
      const res = await request(app).get("/admin/analytics").set(userHeaders);
      expect(res.status).toBe(403);
    });

    it("standard user cannot access GET /admin/dlq", async () => {
      const res = await request(app).get("/admin/dlq").set(userHeaders);
      expect(res.status).toBe(403);
    });

    it("standard user cannot access GET /admin/scheduler/override", async () => {
      const res = await request(app)
        .get("/admin/scheduler/override")
        .set(userHeaders);
      expect(res.status).toBe(403);
    });

    it("admin cannot access POST /admin/users/:id/suspend (superadmin-only)", async () => {
      const res = await request(app)
        .post("/admin/users/42/suspend")
        .set(adminHeaders);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        error: expect.stringMatching(/forbidden/i),
      });
    });

    it("admin cannot access DELETE /admin/users/:id (superadmin-only)", async () => {
      const res = await request(app)
        .delete("/admin/users/42")
        .set(adminHeaders);
      expect(res.status).toBe(403);
    });

    it("admin cannot access POST /admin/scheduler/override (superadmin-only)", async () => {
      const res = await request(app)
        .post("/admin/scheduler/override")
        .set(adminHeaders);
      expect(res.status).toBe(403);
    });

    it("admin cannot access POST /admin/dlq/:id/replay (superadmin-only)", async () => {
      const res = await request(app)
        .post("/admin/dlq/99/replay")
        .set(adminHeaders);
      expect(res.status).toBe(403);
    });

    it("admin cannot access DELETE /admin/dlq/:id (superadmin-only)", async () => {
      const res = await request(app).delete("/admin/dlq/99").set(adminHeaders);
      expect(res.status).toBe(403);
    });

    it("standard user cannot access DELETE /admin/users/:id", async () => {
      const res = await request(app).delete("/admin/users/42").set(userHeaders);
      expect(res.status).toBe(403);
    });
  });

  // ── 5. Correct Role → 200 ─────────────────────────────────────────────────

  describe("Authenticated user with correct role → 200", () => {
    // Admin-accessible routes
    it("admin can access GET /admin/users", async () => {
      const res = await request(app).get("/admin/users").set(adminHeaders);
      expect(res.status).toBe(200);
    });

    it("admin can access GET /admin/analytics", async () => {
      const res = await request(app).get("/admin/analytics").set(adminHeaders);
      expect(res.status).toBe(200);
    });

    it("admin can access GET /admin/scheduler/override", async () => {
      const res = await request(app)
        .get("/admin/scheduler/override")
        .set(adminHeaders);
      expect(res.status).toBe(200);
    });

    it("admin can access GET /admin/dlq", async () => {
      const res = await request(app).get("/admin/dlq").set(adminHeaders);
      expect(res.status).toBe(200);
    });

    // SuperAdmin-only routes
    it("superadmin can access POST /admin/users/:id/suspend", async () => {
      const res = await request(app)
        .post("/admin/users/42/suspend")
        .set(superAdminHeaders);
      expect(res.status).toBe(200);
    });

    it("superadmin can access DELETE /admin/users/:id", async () => {
      const res = await request(app)
        .delete("/admin/users/42")
        .set(superAdminHeaders);
      expect(res.status).toBe(200);
    });

    it("superadmin can access POST /admin/scheduler/override", async () => {
      const res = await request(app)
        .post("/admin/scheduler/override")
        .set(superAdminHeaders)
        .send({ employerId: "employer-1", amount: "500" });
      expect(res.status).toBe(200);
    });

    it("superadmin can also access admin-level GET /admin/users", async () => {
      const res = await request(app).get("/admin/users").set(superAdminHeaders);
      expect(res.status).toBe(200);
    });

    it("superadmin can also access admin-level GET /admin/analytics", async () => {
      const res = await request(app)
        .get("/admin/analytics")
        .set(superAdminHeaders);
      expect(res.status).toBe(200);
    });

    it("superadmin can also access admin-level GET /admin/dlq", async () => {
      const res = await request(app).get("/admin/dlq").set(superAdminHeaders);
      expect(res.status).toBe(200);
    });

    // Any authenticated user
    it("standard user can access GET /admin/me", async () => {
      const res = await request(app).get("/admin/me").set(userHeaders);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toMatchObject({ id: "user-std-1" });
    });

    it("admin can access GET /admin/me", async () => {
      const res = await request(app).get("/admin/me").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: "user-admin-1" });
    });

    it("superadmin can access GET /admin/me", async () => {
      const res = await request(app).get("/admin/me").set(superAdminHeaders);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: "user-superadmin-1" });
    });
  });

  // ── 6. Response Shape Validation ──────────────────────────────────────────

  describe("Response body shape", () => {
    it("401 response includes an error field", async () => {
      const res = await request(app).get("/admin/users");
      expect(res.body).toHaveProperty("error");
      expect(typeof res.body.error).toBe("string");
    });

    it("403 response includes error, required, and actual fields", async () => {
      const res = await request(app).get("/admin/users").set(userHeaders);
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("required");
      expect(res.body).toHaveProperty("actual");
      expect(Array.isArray(res.body.required)).toBe(true);
    });

    it("200 response for /admin/me populates req.user correctly", async () => {
      const res = await request(app).get("/admin/me").set(adminHeaders);
      expect(res.body.user).toMatchObject({
        id: "user-admin-1",
        role: expect.any(Number),
      });
    });
  });
});
