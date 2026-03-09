import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Runs database migrations.
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
  const db = drizzle(pool);

  try {
    // Migration files are generated into the 'drizzle' directory at the root
    const migrationsFolder = path.join(process.cwd(), "drizzle");

    await migrate(db, { migrationsFolder });

    console.log("[Migration] ✅ Migrations completed successfully.");
  } catch (error) {
    console.error("[Migration] ❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run if called directly
if (require.main === module) {
  runMigrations();
}
