/**
 * Testcontainer Setup Helper
 * Manages PostgreSQL container lifecycle for integration tests
 */

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import path from "path";

export class TestDatabase {
  private container: StartedPostgreSqlContainer | null = null;
  private pool: Pool | null = null;

  /**
   * Start PostgreSQL container and initialize schema
   */
  async start(): Promise<{ connectionString: string; pool: Pool }> {
    console.log("[TestDB] Starting PostgreSQL container...");

    // Start PostgreSQL container
    this.container = await new PostgreSqlContainer("postgres:16-alpine")
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: "quipay_test",
        POSTGRES_USER: "test_user",
        POSTGRES_PASSWORD: "test_password",
      })
      .start();

    const connectionString = this.container.getConnectionUri();
    console.log("[TestDB] ✅ Container started");

    // Set DATABASE_URL BEFORE calling initDb
    process.env.DATABASE_URL = connectionString;

    // Let initDb() create the pool and run migrations
    await this.initializeDbPool();

    // Get the pool that initDb() created
    const { getPool } = require("../../db/pool");
    this.pool = getPool();

    if (!this.pool) {
      throw new Error("Failed to initialize database pool");
    }

    return { connectionString, pool: this.pool };
  }

  /**
   * Initialize the db/pool module with the test database
   * This ensures all code using getPool() gets the test pool
   */
  async initializeDbPool(): Promise<void> {
    // Clear module cache for db/pool to ensure fresh import
    const poolModulePath = require.resolve("../../db/pool");
    delete require.cache[poolModulePath];

    // Import and call initDb() which will use the DATABASE_URL we set
    const { initDb } = require("../../db/pool");
    await initDb();

    console.log("[TestDB] ✅ db/pool module initialized with test database");

    // Create schema for tests
    await this.createSchema();
  }

  /**
   * Create database schema for tests
   */
  async createSchema(): Promise<void> {
    if (!this.pool) return;

    const fs = require("fs");
    const path = require("path");

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, "../../db/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    await this.pool.query(schemaSql);
    console.log("[TestDB] ✅ Schema created");
  }

  /**
   * Clean all data from tables (for test isolation)
   */
  async clean(): Promise<void> {
    if (!this.pool) return;

    await this.pool.query(`
      TRUNCATE TABLE 
        audit_logs,
        treasury_monitor_log,
        treasury_balances,
        scheduler_logs,
        payroll_schedules,
        vault_events,
        withdrawals,
        payroll_streams,
        sync_cursors
      CASCADE
    `);
  }

  /**
   * Get the connection pool
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error("Database not started");
    }
    return this.pool;
  }

  /**
   * Get connection string
   */
  getConnectionString(): string {
    if (!this.container) {
      throw new Error("Container not started");
    }
    return this.container.getConnectionUri();
  }

  /**
   * Stop container and cleanup
   */
  async stop(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    if (this.container) {
      console.log("[TestDB] Stopping container...");
      await this.container.stop();
      this.container = null;
      console.log("[TestDB] ✅ Container stopped");
    }
  }
}

/**
 * Global test database instance
 * Shared across all integration tests in a suite
 */
let globalTestDb: TestDatabase | null = null;

/**
 * Setup function for integration test suites
 * Call in beforeAll()
 */
export async function setupTestDatabase(): Promise<TestDatabase> {
  if (!globalTestDb) {
    globalTestDb = new TestDatabase();
    await globalTestDb.start();
  }
  return globalTestDb;
}

/**
 * Cleanup function for integration test suites
 * Call in afterEach() for test isolation
 */
export async function cleanTestDatabase(): Promise<void> {
  if (globalTestDb) {
    await globalTestDb.clean();
  }
}

/**
 * Teardown function for integration test suites
 * Call in afterAll()
 */
export async function teardownTestDatabase(): Promise<void> {
  if (globalTestDb) {
    await globalTestDb.stop();
    globalTestDb = null;
  }
}
