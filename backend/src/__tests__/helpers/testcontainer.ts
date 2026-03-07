/**
 * Testcontainer Setup Helper
 * Manages PostgreSQL container lifecycle for integration tests
 */

import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import fs from "fs";
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

    // Create connection pool
    this.pool = new Pool({ connectionString });

    // Initialize schema
    await this.initializeSchema();

    return { connectionString, pool: this.pool };
  }

  /**
   * Initialize database schema from schema.sql
   */
  private async initializeSchema(): Promise<void> {
    if (!this.pool) {
      throw new Error("Pool not initialized");
    }

    const schemaPath = path.join(__dirname, "../../db/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    await this.pool.query(schemaSql);
    console.log("[TestDB] ✅ Schema initialized");
  }

  /**
   * Inject test pool into the db/pool module so queries use the test database
   * This must be called AFTER the pool is created but BEFORE any code uses getPool()
   */
  injectPoolIntoDbModule(): void {
    if (!this.pool) {
      throw new Error("Pool not initialized - call start() first");
    }

    // Clear the module cache to ensure fresh imports
    const poolModulePath = require.resolve("../../db/pool");
    delete require.cache[poolModulePath];

    // Now require and set the pool
    const { setPool } = require("../../db/pool");
    setPool(this.pool);

    console.log("[TestDB] ✅ Pool injected into db/pool module");
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
    // Restore pool to null
    const { setPool } = require("../../db/pool");
    setPool(null);

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
