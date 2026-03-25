/**
 * Database Migration Runner
 * Handles versioned SQL migrations with checksum validation and rollback support
 */

import { Pool } from "pg";
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
  checksum: string;
  applied_at: Date;
  execution_time_ms: number;
}

export interface MigrationStatus {
  totalMigrations: number;
  appliedMigrations: AppliedMigration[];
  pendingMigrations: Migration[];
}

export class MigrationRunner {
  constructor(
    private pool: Pool,
    private migrationsDir: string,
  ) {}

  /**
   * Ensure schema_migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL
      );
    `);
  }

  /**
   * Calculate checksum for migration file
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Parse migration filename to extract version and name
   */
  private parseMigrationFilename(filename: string): {
    version: number;
    name: string;
  } | null {
    const match = filename.match(/^(\d{3})_(.+)\.sql$/);
    if (!match) return null;

    return {
      version: parseInt(match[1], 10),
      name: match[2],
    };
  }

  /**
   * Load all migration files from directory
   */
  private loadMigrations(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith(".sql") && !f.endsWith("_rollback.sql"))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      const parsed = this.parseMigrationFilename(file);
      if (!parsed) continue;

      const filepath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filepath, "utf-8");
      const checksum = this.calculateChecksum(sql);

      migrations.push({
        version: parsed.version,
        name: parsed.name,
        filename: file,
        sql,
        checksum,
      });
    }

    return migrations;
  }

  /**
   * Get applied migrations from database
   */
  private async getAppliedMigrations(): Promise<AppliedMigration[]> {
    const result = await this.pool.query<AppliedMigration>(
      "SELECT * FROM schema_migrations ORDER BY version",
    );
    return result.rows;
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    await this.ensureMigrationsTable();

    const allMigrations = this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map((m) => m.version));

    const pendingMigrations = allMigrations.filter(
      (m) => !appliedVersions.has(m.version),
    );

    return {
      totalMigrations: allMigrations.length,
      appliedMigrations,
      pendingMigrations,
    };
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<void> {
    await this.ensureMigrationsTable();

    const allMigrations = this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();

    // Verify checksums of applied migrations
    for (const applied of appliedMigrations) {
      const migration = allMigrations.find((m) => m.version === applied.version);
      if (migration && migration.checksum !== applied.checksum) {
        throw new Error(
          `Migration ${applied.version}_${applied.name} has been modified. ` +
            `Expected checksum: ${applied.checksum}, got: ${migration.checksum}`,
        );
      }
    }

    // Find pending migrations
    const appliedVersions = new Set(appliedMigrations.map((m) => m.version));
    const pendingMigrations = allMigrations.filter(
      (m) => !appliedVersions.has(m.version),
    );

    if (pendingMigrations.length === 0) {
      console.log("✅ No pending migrations");
      return;
    }

    console.log(`📦 Found ${pendingMigrations.length} pending migration(s)`);

    // Apply each migration in a transaction
    for (const migration of pendingMigrations) {
      const client = await this.pool.connect();
      const startTime = Date.now();

      try {
        await client.query("BEGIN");

        console.log(
          `⏳ Applying migration ${migration.version}_${migration.name}...`,
        );

        // Execute migration SQL
        await client.query(migration.sql);

        // Record migration
        const executionTime = Date.now() - startTime;
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
           VALUES ($1, $2, $3, $4)`,
          [migration.version, migration.name, migration.checksum, executionTime],
        );

        await client.query("COMMIT");

        console.log(
          `✅ Applied migration ${migration.version}_${migration.name} (${executionTime}ms)`,
        );
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(
          `❌ Failed to apply migration ${migration.version}_${migration.name}:`,
          error,
        );
        throw error;
      } finally {
        client.release();
      }
    }

    console.log("✅ All migrations applied successfully");
  }

  /**
   * Rollback last migration
   */
  async rollback(): Promise<void> {
    await this.ensureMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();

    if (appliedMigrations.length === 0) {
      console.log("ℹ️  No migrations to rollback");
      return;
    }

    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    const rollbackFilename = `${String(lastMigration.version).padStart(3, "0")}_${lastMigration.name}_rollback.sql`;
    const rollbackPath = path.join(this.migrationsDir, rollbackFilename);

    if (!fs.existsSync(rollbackPath)) {
      throw new Error(
        `Rollback file not found: ${rollbackFilename}. Cannot rollback migration ${lastMigration.version}_${lastMigration.name}`,
      );
    }

    const rollbackSql = fs.readFileSync(rollbackPath, "utf-8");
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      console.log(
        `⏳ Rolling back migration ${lastMigration.version}_${lastMigration.name}...`,
      );

      // Execute rollback SQL
      await client.query(rollbackSql);

      // Remove migration record
      await client.query("DELETE FROM schema_migrations WHERE version = $1", [
        lastMigration.version,
      ]);

      await client.query("COMMIT");

      console.log(
        `✅ Rolled back migration ${lastMigration.version}_${lastMigration.name}`,
      );
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(
        `❌ Failed to rollback migration ${lastMigration.version}_${lastMigration.name}:`,
        error,
      );
      throw error;
    } finally {
      client.release();
    }
  }
}
