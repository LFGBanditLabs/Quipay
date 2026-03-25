/**
 * Integration Tests for MigrationRunner
 * Tests database migrations with real PostgreSQL using testcontainers
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import { MigrationRunner } from "../../db/migrationRunner";
import fs from "fs";
import path from "path";

describe("MigrationRunner", () => {
  let container: any;
  let pool: Pool;
  let runner: MigrationRunner;
  let testMigrationsDir: string;

  beforeAll(async () => {
    // Start a dedicated PostgreSQL container for migration tests
    console.log("[MigrationTest] Starting PostgreSQL container...");
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: "migration_test",
        POSTGRES_USER: "test_user",
        POSTGRES_PASSWORD: "test_password",
      })
      .start();

    const connectionString = container.getConnectionUri();
    pool = new Pool({ connectionString });
    testMigrationsDir = path.join(__dirname, "test_migrations");

    console.log("[MigrationTest] ✅ Container started");
  });

  afterAll(async () => {
    // Clean up
    if (pool) {
      await pool.end();
    }
    if (container) {
      console.log("[MigrationTest] Stopping container...");
      await container.stop();
      console.log("[MigrationTest] ✅ Container stopped");
    }
  });

  beforeEach(async () => {
    // Clean up test migrations directory
    if (fs.existsSync(testMigrationsDir)) {
      fs.rmSync(testMigrationsDir, { recursive: true });
    }
    fs.mkdirSync(testMigrationsDir, { recursive: true });

    // Clean up schema_migrations table
    await pool.query("DROP TABLE IF EXISTS schema_migrations CASCADE");

    runner = new MigrationRunner(pool, testMigrationsDir);
  });

  afterEach(async () => {
    // Clean up test migrations directory
    if (fs.existsSync(testMigrationsDir)) {
      fs.rmSync(testMigrationsDir, { recursive: true });
    }
  });

  describe("ensureMigrationsTable", () => {
    it("should create schema_migrations table", async () => {
      await runner.migrate();

      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'schema_migrations'
        );
      `);

      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe("migrate", () => {
    it("should apply pending migrations", async () => {
      // Create test migration
      const migrationSql = `
        CREATE TABLE IF NOT EXISTS test_table (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL
        );
      `;
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_create_test_table.sql"),
        migrationSql,
      );

      await runner.migrate();

      // Check migration was applied
      const result = await pool.query(`
        SELECT * FROM schema_migrations WHERE version = 1
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("create_test_table");

      // Check table was created
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'test_table'
        );
      `);

      expect(tableResult.rows[0].exists).toBe(true);
    });

    it("should not reapply already applied migrations", async () => {
      // Create test migration
      const migrationSql = `
        CREATE TABLE IF NOT EXISTS test_table (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL
        );
      `;
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_create_test_table.sql"),
        migrationSql,
      );

      // Apply migration first time
      await runner.migrate();

      // Apply migration second time
      await runner.migrate();

      // Check migration was only recorded once
      const result = await pool.query(`
        SELECT * FROM schema_migrations WHERE version = 1
      `);

      expect(result.rows).toHaveLength(1);
    });

    it("should apply multiple migrations in order", async () => {
      // Create multiple test migrations
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_first.sql"),
        "CREATE TABLE IF NOT EXISTS first_table (id SERIAL PRIMARY KEY);",
      );
      fs.writeFileSync(
        path.join(testMigrationsDir, "002_second.sql"),
        "CREATE TABLE IF NOT EXISTS second_table (id SERIAL PRIMARY KEY);",
      );
      fs.writeFileSync(
        path.join(testMigrationsDir, "003_third.sql"),
        "CREATE TABLE IF NOT EXISTS third_table (id SERIAL PRIMARY KEY);",
      );

      await runner.migrate();

      // Check all migrations were applied
      const result = await pool.query(`
        SELECT version FROM schema_migrations ORDER BY version
      `);

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].version).toBe(1);
      expect(result.rows[1].version).toBe(2);
      expect(result.rows[2].version).toBe(3);
    });

    it("should rollback on migration failure", async () => {
      // Create valid migration
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_valid.sql"),
        "CREATE TABLE IF NOT EXISTS valid_table (id SERIAL PRIMARY KEY);",
      );

      // Create invalid migration
      fs.writeFileSync(
        path.join(testMigrationsDir, "002_invalid.sql"),
        "INVALID SQL SYNTAX HERE;",
      );

      // Attempt to migrate
      await expect(runner.migrate()).rejects.toThrow();

      // Check first migration was applied
      const result = await pool.query(`
        SELECT * FROM schema_migrations WHERE version = 1
      `);
      expect(result.rows).toHaveLength(1);

      // Check second migration was NOT applied
      const result2 = await pool.query(`
        SELECT * FROM schema_migrations WHERE version = 2
      `);
      expect(result2.rows).toHaveLength(0);
    });

    it("should detect modified migrations", async () => {
      // Create and apply migration
      const originalSql =
        "CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY);";
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_test.sql"),
        originalSql,
      );

      await runner.migrate();

      // Modify the migration file
      const modifiedSql =
        "CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT);";
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_test.sql"),
        modifiedSql,
      );

      // Attempt to migrate again
      await expect(runner.migrate()).rejects.toThrow(/has been modified/);
    });

    it("should record execution time", async () => {
      // Create test migration
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_test.sql"),
        "CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY);",
      );

      await runner.migrate();

      // Check execution time was recorded
      const result = await pool.query(`
        SELECT execution_time_ms FROM schema_migrations WHERE version = 1
      `);

      expect(result.rows[0].execution_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getStatus", () => {
    it("should return migration status", async () => {
      // Create test migrations
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_first.sql"),
        "CREATE TABLE IF NOT EXISTS first_table (id SERIAL PRIMARY KEY);",
      );
      fs.writeFileSync(
        path.join(testMigrationsDir, "002_second.sql"),
        "CREATE TABLE IF NOT EXISTS second_table (id SERIAL PRIMARY KEY);",
      );

      // Apply first migration only
      await runner.migrate();

      // Add third migration (pending)
      fs.writeFileSync(
        path.join(testMigrationsDir, "003_third.sql"),
        "CREATE TABLE IF NOT EXISTS third_table (id SERIAL PRIMARY KEY);",
      );

      const status = await runner.getStatus();

      expect(status.totalMigrations).toBe(3);
      expect(status.appliedMigrations).toHaveLength(2);
      expect(status.pendingMigrations).toHaveLength(1);
      expect(status.pendingMigrations[0].version).toBe(3);
    });
  });

  describe("rollback", () => {
    it("should rollback last migration", async () => {
      // Create migration and rollback
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_test.sql"),
        "CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY);",
      );
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_test_rollback.sql"),
        "DROP TABLE IF EXISTS test_table;",
      );

      // Apply migration
      await runner.migrate();

      // Verify table exists
      let tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'test_table'
        );
      `);
      expect(tableResult.rows[0].exists).toBe(true);

      // Rollback
      await runner.rollback();

      // Verify table was dropped
      tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'test_table'
        );
      `);
      expect(tableResult.rows[0].exists).toBe(false);

      // Verify migration record was removed
      const result = await pool.query(`
        SELECT * FROM schema_migrations WHERE version = 1
      `);
      expect(result.rows).toHaveLength(0);
    });

    it("should fail if rollback file does not exist", async () => {
      // Create migration without rollback
      fs.writeFileSync(
        path.join(testMigrationsDir, "001_test.sql"),
        "CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY);",
      );

      // Apply migration
      await runner.migrate();

      // Attempt rollback
      await expect(runner.rollback()).rejects.toThrow(
        /Rollback file not found/,
      );
    });

    it("should do nothing if no migrations applied", async () => {
      await expect(runner.rollback()).resolves.not.toThrow();
    });
  });
});
