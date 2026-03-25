/**
 * Database Migration Runner
 *
 * Provides a robust migration system with:
 * - Version tracking in schema_migrations table
 * - Checksum validation to detect modified migrations
 * - Transaction support for atomic migrations
 * - Rollback capability
 * - Execution time tracking
 */

import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface Migration {
  version: number;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: number;
  name: string;
  applied_at: Date;
  checksum: string;
  execution_time_ms: number | null;
}

export class MigrationRunner {
  private pool: Pool;
  private migrationsDir: string;

  constructor(pool: Pool, migrationsDir?: string) {
    this.pool = pool;
    this.migrationsDir = migrationsDir || path.join(__dirname, "migrations");
  }

  /**
   * Ensures the schema_migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          checksum VARCHAR(64) NOT NULL,
          execution_time_ms INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
        ON schema_migrations(applied_at DESC);
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Calculates SHA-256 checksum of migration SQL
   */
  private calculateChecksum(sql: string): string {
    return crypto.createHash("sha256").update(sql).digest("hex");
  }

  /**
   * Parses migration filename to extract version and name
   * Format: 001_migration_name.sql
   */
  private parseMigrationFilename(
    filename: string,
  ): { version: number; name: string } | null {
    const match = filename.match(/^(\d+)_(.+)\.sql$/);
    if (!match) return null;

    return {
      version: parseInt(match[1], 10),
      name: match[2],
    };
  }

  /**
   * Loads all migration files from the migrations directory
   */
  private async loadMigrations(): Promise<Migration[]> {
    if (!fs.existsSync(this.migrationsDir)) {
      console.warn(
        `[Migration] Migrations directory not found: ${this.migrationsDir}`,
      );
      return [];
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const migrations: Migration[] = [];

    for (const filename of files) {
      const parsed = this.parseMigrationFilename(filename);
      if (!parsed) {
        console.warn(
          `[Migration] Skipping invalid migration filename: ${filename}`,
        );
        continue;
      }

      const filepath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filepath, "utf-8");
      const checksum = this.calculateChecksum(sql);

      migrations.push({
        version: parsed.version,
        name: parsed.name,
        filename,
        sql,
        checksum,
      });
    }

    return migrations;
  }

  /**
   * Gets list of already applied migrations
   */
  private async getAppliedMigrations(): Promise<AppliedMigration[]> {
    const result = await this.pool.query<AppliedMigration>(`
      SELECT version, name, applied_at, checksum, execution_time_ms
      FROM schema_migrations
      ORDER BY version ASC
    `);

    return result.rows;
  }

  /**
   * Validates that applied migrations haven't been modified
   */
  private validateMigrations(
    migrations: Migration[],
    appliedMigrations: AppliedMigration[],
  ): void {
    for (const applied of appliedMigrations) {
      const migration = migrations.find((m) => m.version === applied.version);

      if (!migration) {
        throw new Error(
          `Applied migration ${applied.version} (${applied.name}) not found in migrations directory`,
        );
      }

      if (migration.checksum !== applied.checksum) {
        throw new Error(
          `Migration ${applied.version} (${applied.name}) has been modified after being applied. ` +
            `Expected checksum: ${applied.checksum}, got: ${migration.checksum}`,
        );
      }
    }
  }

  /**
   * Applies a single migration within a transaction
   */
  private async applyMigration(
    client: PoolClient,
    migration: Migration,
  ): Promise<number> {
    const startTime = Date.now();

    console.log(
      `[Migration] Applying ${migration.version}_${migration.name}...`,
    );

    try {
      // Execute migration SQL
      await client.query(migration.sql);

      // Record migration in schema_migrations table
      const executionTime = Date.now() - startTime;
      await client.query(
        `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
         VALUES ($1, $2, $3, $4)`,
        [migration.version, migration.name, migration.checksum, executionTime],
      );

      console.log(
        `[Migration] ✅ Applied ${migration.version}_${migration.name} (${executionTime}ms)`,
      );

      return executionTime;
    } catch (error) {
      console.error(
        `[Migration] ❌ Failed to apply ${migration.version}_${migration.name}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Runs all pending migrations
   */
  public async migrate(): Promise<void> {
    console.log("[Migration] Starting migration process...");

    // Ensure migrations table exists
    await this.ensureMigrationsTable();

    // Load migrations from filesystem
    const migrations = await this.loadMigrations();
    if (migrations.length === 0) {
      console.log("[Migration] No migrations found.");
      return;
    }

    // Get applied migrations from database
    const appliedMigrations = await this.getAppliedMigrations();

    // Validate existing migrations haven't been modified
    this.validateMigrations(migrations, appliedMigrations);

    // Find pending migrations
    const appliedVersions = new Set(appliedMigrations.map((m) => m.version));
    const pendingMigrations = migrations.filter(
      (m) => !appliedVersions.has(m.version),
    );

    if (pendingMigrations.length === 0) {
      console.log(
        "[Migration] ✅ Database is up to date. No pending migrations.",
      );
      return;
    }

    console.log(
      `[Migration] Found ${pendingMigrations.length} pending migration(s)`,
    );

    // Apply each pending migration in a transaction
    for (const migration of pendingMigrations) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await this.applyMigration(client, migration);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    console.log("[Migration] ✅ All migrations applied successfully.");
  }

  /**
   * Gets the current migration status
   */
  public async getStatus(): Promise<{
    appliedMigrations: AppliedMigration[];
    pendingMigrations: Migration[];
    totalMigrations: number;
  }> {
    await this.ensureMigrationsTable();

    const migrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();

    const appliedVersions = new Set(appliedMigrations.map((m) => m.version));
    const pendingMigrations = migrations.filter(
      (m) => !appliedVersions.has(m.version),
    );

    return {
      appliedMigrations,
      pendingMigrations,
      totalMigrations: migrations.length,
    };
  }

  /**
   * Rolls back the last applied migration
   * WARNING: This requires a corresponding rollback SQL file
   */
  public async rollback(): Promise<void> {
    console.log("[Migration] Starting rollback...");

    await this.ensureMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();
    if (appliedMigrations.length === 0) {
      console.log("[Migration] No migrations to rollback.");
      return;
    }

    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    console.log(
      `[Migration] Rolling back ${lastMigration.version}_${lastMigration.name}...`,
    );

    // Look for rollback file
    const rollbackFilename = `${String(lastMigration.version).padStart(3, "0")}_${lastMigration.name}_rollback.sql`;
    const rollbackPath = path.join(this.migrationsDir, rollbackFilename);

    if (!fs.existsSync(rollbackPath)) {
      throw new Error(
        `Rollback file not found: ${rollbackFilename}. ` +
          `Create this file to enable rollback for migration ${lastMigration.version}.`,
      );
    }

    const rollbackSql = fs.readFileSync(rollbackPath, "utf-8");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Execute rollback SQL
      await client.query(rollbackSql);

      // Remove migration record
      await client.query("DELETE FROM schema_migrations WHERE version = $1", [
        lastMigration.version,
      ]);

      await client.query("COMMIT");

      console.log(
        `[Migration] ✅ Rolled back ${lastMigration.version}_${lastMigration.name}`,
      );
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`[Migration] ❌ Rollback failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}
