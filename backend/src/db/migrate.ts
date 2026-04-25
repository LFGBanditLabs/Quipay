import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle(pool);

  console.log("⏳ Running migrations...");
  
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "../../../drizzle"),
  });

  console.log("✅ Migrations completed");
  await pool.end();
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
}
