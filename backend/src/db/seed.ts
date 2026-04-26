import { getPool, initDb } from "./pool";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

async function seed() {
  console.log("🌱 Seeding database...");
  await initDb();
  const pool = getPool();
  if (!pool) {
    throw new Error(
      "Database pool was not initialized. Check your DATABASE_URL.",
    );
  }
  const db = drizzle(pool, { schema });

  // 1. Initial Sync Cursors
  console.log("-> Sync Cursors");
  await db
    .insert(schema.syncCursors)
    .values([
      { contractId: "CCSTTREASURY123", lastLedger: 100 },
      { contractId: "CCSTSTREAM456", lastLedger: 150 },
    ])
    .onConflictDoNothing();

  // 2. Initial Treasury Balances (Mocked)
  console.log("-> Treasury Balances");
  await db
    .insert(schema.treasuryBalances)
    .values([
      { employer: "GD3J...MNGT", balance: "10000.00", token: "USDC" },
      { employer: "GA...HR_CORP", balance: "5000000", token: "USDC" },
    ])
    .onConflictDoNothing();

  // 3. Payroll Schedules
  console.log("-> Payroll Schedules");
  await db
    .insert(schema.payrollSchedules)
    .values([
      {
        employer: "GD3J...MNGT",
        worker: "GB...WORKER1",
        token: "USDC",
        rate: "500",
        cronExpression: "0 0 1 * *", // 1st of every month
        durationDays: 30,
        enabled: true,
        nextRunAt: new Date(Date.now() + 86400000), // tomorrow
      },
      {
        employer: "GA...HR_CORP",
        worker: "GC...DEV_GUY",
        token: "USDC",
        rate: "2500",
        cronExpression: "0 0 1,15 * *", // semi-monthly
        durationDays: 14,
        enabled: true,
        nextRunAt: new Date(Date.now() + 86400000), // tomorrow
      },
    ])
    .onConflictDoNothing();

  console.log("✅ Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
