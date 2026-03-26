/**
 * Migration CLI
 * Run migrations, check status, or rollback
 */

import { Pool } from "pg";
import { MigrationRunner } from "./migrationRunner";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const migrationsDir = path.join(__dirname, "migrations");

async function main() {
  const command = process.argv[2] || "up";

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const runner = new MigrationRunner(pool, migrationsDir);

  try {
    switch (command) {
      case "up":
      case "migrate":
        await runner.migrate();
        break;

      case "status":
        const status = await runner.getStatus();
        console.log("\n📊 Migration Status:");
        console.log(`   Total migrations: ${status.totalMigrations}`);
        console.log(`   Applied: ${status.appliedMigrations.length}`);
        console.log(`   Pending: ${status.pendingMigrations.length}`);

        if (status.appliedMigrations.length > 0) {
          console.log("\n✅ Applied Migrations:");
          for (const m of status.appliedMigrations) {
            console.log(
              `   ${m.version}_${m.name} (${m.execution_time_ms}ms) - ${m.applied_at.toISOString()}`,
            );
          }
        }

        if (status.pendingMigrations.length > 0) {
          console.log("\n⏳ Pending Migrations:");
          for (const m of status.pendingMigrations) {
            console.log(`   ${m.version}_${m.name}`);
          }
        }
        break;

      case "rollback":
        await runner.rollback();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log("\nUsage:");
        console.log("  npm run migrate          - Apply pending migrations");
        console.log("  npm run migrate:status   - Show migration status");
        console.log("  npm run migrate:rollback - Rollback last migration");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
