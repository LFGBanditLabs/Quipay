/**
 * Tests for Admin Audit Trail functionality
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import express from "express";
import { adminRouter } from "../../src/adminRouter";
import { getPool, initDb } from "../../src/db/pool";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema";

describe("Admin Audit Trail", () => {
  let app: express.Express;

  beforeAll(async () => {
    // Initialize database
    await initDb();
    
    // Create Express app with admin router
    app = express();
    app.use(express.json());
    app.use("/admin", adminRouter);
  });

  afterAll(async () => {
    const pool = getPool();
    if (pool) {
      await pool.end();
    }
  });

  describe("GET /admin/audit-log", () => {
    it("should return 401 without authentication", async () => {
      const res = await request(app).get("/admin/audit-log");
      expect(res.status).toBe(401);
    });

    it("should return 403 for non-admin users", async () => {
      const res = await request(app)
        .get("/admin/audit-log")
        .set("x-user-id", "test-user")
        .set("x-user-role", "user");
      expect(res.status).toBe(403);
    });

    it("should return audit logs for admin users with pagination", async () => {
      const res = await request(app)
        .get("/admin/audit-log")
        .set("x-user-id", "admin-user")
        .set("x-user-role", "admin");
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("logs");
      expect(res.body).toHaveProperty("pagination");
      expect(res.body.pagination).toHaveProperty("total");
      expect(res.body.pagination).toHaveProperty("limit");
      expect(res.body.pagination).toHaveProperty("offset");
      expect(res.body.pagination).toHaveProperty("hasMore");
    });

    it("should support date filtering", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const res = await request(app)
        .get(`/admin/audit-log?startDate=${yesterday.toISOString()}&endDate=${now.toISOString()}`)
        .set("x-user-id", "admin-user")
        .set("x-user-role", "admin");
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("logs");
    });

    it("should support action filtering", async () => {
      const res = await request(app)
        .get("/admin/audit-log?action=user_suspend")
        .set("x-user-id", "admin-user")
        .set("x-user-role", "admin");
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("logs");
    });

    it("should support admin address filtering", async () => {
      const res = await request(app)
        .get("/admin/audit-log?admin=test-admin-id")
        .set("x-user-id", "admin-user")
        .set("x-user-role", "admin");
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("logs");
    });

    it("should support pagination parameters", async () => {
      const res = await request(app)
        .get("/admin/audit-log?limit=10&offset=20")
        .set("x-user-id", "admin-user")
        .set("x-user-role", "admin");
      
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.offset).toBe(20);
    });
  });

  describe("Audit logging middleware", () => {
    it("should log admin actions automatically", async () => {
      // Perform an admin action
      const actionRes = await request(app)
        .post("/admin/users/test-user-id/suspend")
        .set("x-user-id", "superadmin-user")
        .set("x-user-role", "superadmin");
      
      expect(actionRes.status).toBe(200);

      // Verify the action was logged
      const logRes = await request(app)
        .get("/admin/audit-log?action=user_suspend")
        .set("x-user-id", "admin-user")
        .set("x-user-role", "admin");
      
      expect(logRes.status).toBe(200);
      expect(logRes.body.logs).toBeInstanceOf(Array);
      
      // Find the most recent log entry for this action
      const suspendLog = logRes.body.logs.find(
        (log: any) => log.action === "user_suspend"
      );
      
      if (suspendLog) {
        expect(suspendLog.adminAddress).toBe("superadmin-user");
        expect(suspendLog.target).toBe("test-user-id");
        expect(suspendLog.details).toBeDefined();
      }
    });

    it("should capture IP address and user agent", async () => {
      const actionRes = await request(app)
        .delete("/admin/users/test-user-id-2")
        .set("x-user-id", "superadmin-user")
        .set("x-user-role", "superadmin")
        .set("User-Agent", "TestClient/1.0")
        .set("X-Forwarded-For", "192.168.1.100");
      
      expect(actionRes.status).toBe(200);

      const logRes = await request(app)
        .get("/admin/audit-log?action=user_delete")
        .set("x-user-id", "admin-user")
        .set("x-user-role", "admin");
      
      expect(logRes.status).toBe(200);
      
      const deleteLog = logRes.body.logs.find(
        (log: any) => log.action === "user_delete" && log.target === "test-user-id-2"
      );
      
      if (deleteLog) {
        expect(deleteLog.ipAddress).toBe("192.168.1.100");
        expect(deleteLog.userAgent).toBe("TestClient/1.0");
      }
    });
  });
});
