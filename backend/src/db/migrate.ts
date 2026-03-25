import { Pool } from "pg";
import path from "path";
import dotenv from "dotenv";
import { MigrationRunner } from "./migrationRunner";

dotenv.config();

/**
 * Runs database migrations using the custom migration runner.
 * This can be called as a standalone script or integrated into application startup.
 */
export const runMigrations = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn(
      "[Migration] ⚠️  DATABASE_URL is not set. Skipping migrations.",
    );
    return;
  }

  console.log("[Migration] ⏳ Running migrations...");

  const pool = new Pool({ connectionString: url });

  try {
    const migrationsDir = path.join(__dirname, "migrations");
    const runner = new MigrationRunner(pool, migrationsDir);

    await runner.migrate();

    console.log("[Migration] ✅ Migrations completed successfully.");
  } catch (error) {
    console.error("[Migration] ❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
};

/**
 * Gets the current migration status
 */
export const getMigrationStatus = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString: url });

  try {
    const migrationsDir = path.join(__dirname, "migrations");
    const runner = new MigrationRunner(pool, migrationsDir);

    return await runner.getStatus();
  } finally {
    await pool.end();
  }
};

/**
 * Rolls back the last applied migration
 */
export const rollbackMigration = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString: url });

  try {
    const migrationsDir = path.join(__dirname, "migrations");
    const runner = new MigrationRunner(pool, migrationsDir);

    await runner.rollback();
  } finally {
    await pool.end();
  }
};

// Run if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === "status") {
    getMigrationStatus()
      .then((status) => {
        console.log("\n📊 Migration Status:");
        console.log(`Total migrations: ${status.totalMigrations}`);
        console.log(`Applied: ${status.appliedMigrations.length}`);
        console.log(`Pending: ${status.pendingMigrations.length}`);

        if (status.appliedMigrations.length > 0) {
          console.log("\n✅ Applied Migrations:");
          status.appliedMigrations.forEach((m) => {
            console.log(
              `  ${m.version}_${m.name} (${m.applied_at.toISOString()}, ${m.execution_time_ms}ms)`,
            );
          });
        }

        if (status.pendingMigrations.length > 0) {
          console.log("\n⏳ Pending Migrations:");
          status.pendingMigrations.forEach((m) => {
            console.log(`  ${m.version}_${m.name}`);
          });
        }

        process.exit(0);
      })
      .catch((error) => {
        console.error("Failed to get migration status:", error);
        process.exit(1);
      });
  } else if (command === "rollback") {
    rollbackMigration()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        console.error("Rollback failed:", error);
        process.exit(1);
      });
  } else {
    runMigrations()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        process.exit(1);
      });
  }
}
