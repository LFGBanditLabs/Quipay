import { getPool, initDb } from "./pool";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { getStreamsByEmployer } from "./queries";
import { performance } from "perf_hooks";
import dotenv from "dotenv";

dotenv.config();

async function benchmark() {
  console.log("🚀 Starting Query Performance Benchmark...");
  await initDb();
  const pool = getPool();
  if (!pool) {
    throw new Error("Database pool was not initialized.");
  }
  const db = drizzle(pool, { schema });

  // 1. Clean up existing data for a clean run
  console.log("🧹 Cleaning up old benchmark data...");
  await pool.query("DELETE FROM payroll_streams WHERE employer_address LIKE 'BENCHMARK_%'");

  // 2. Seed 10,000 rows
  console.log("🌱 Seeding 10,000 benchmark streams...");
  const batchSize = 1000;
  const totalRows = 10000;
  const employerAddress = "BENCHMARK_EMPLOYER_1";

  for (let i = 0; i < totalRows; i += batchSize) {
    const values = [];
    for (let j = 0; j < batchSize; j++) {
      const id = i + j + 1000000;
      const empIdx = Math.floor((i + j) / 100); // 100 rows per employer
      values.push({
        streamId: id,
        employerAddress: `BENCHMARK_EMPLOYER_${empIdx}`,
        workerAddress: `BENCHMARK_WORKER_${id}`,
        totalAmount: "1000000000",
        withdrawnAmount: "0",
        startTs: Math.floor(Date.now() / 1000),
        endTs: Math.floor(Date.now() / 1000) + 3600 * 24 * 30,
        status: j % 2 === 0 ? "active" : "completed",
        ledgerCreated: 123456,
      });
    }
    await (db.insert(schema.payrollStreams) as any).values(values);
    process.stdout.write(`  Progress: ${i + batchSize}/${totalRows}\r`);
  }
  console.log("\n✅ Seeding complete!");

  const targetEmployer = "BENCHMARK_EMPLOYER_50";

  // Update statistics for the planner
  await pool.query("ANALYZE payroll_streams");

  // 3. Warm up the database
  console.log("🔥 Warming up...");
  for (let i = 0; i < 5; i++) {
    await getStreamsByEmployer(targetEmployer, "active", 100);
  }

  // 4. Run Benchmark
  console.log("⏱️  Running benchmark queries...");
  const iterations = 100;
  let totalTime = 0;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await getStreamsByEmployer(targetEmployer, "active", 50);
    const end = performance.now();
    totalTime += (end - start);
  }

  const avgTime = totalTime / iterations;
  console.log(`\n📊 Results:`);
  console.log(`   Average query time: ${avgTime.toFixed(2)}ms`);
  console.log(`   Total iterations: ${iterations}`);
  console.log(`   Database size: ${totalRows} benchmark rows`);

  // 5. Assertion
  const THRESHOLD = 100;
  if (avgTime < THRESHOLD) {
    console.log(`\n✅ PERFORMANCE ASSERTION PASSED: ${avgTime.toFixed(2)}ms < ${THRESHOLD}ms`);
  } else {
    console.error(`\n❌ PERFORMANCE ASSERTION FAILED: ${avgTime.toFixed(2)}ms >= ${THRESHOLD}ms`);
    process.exit(1);
  }

  // 6. Explain Analyze for verification
  console.log("\n🔍 EXPLAIN ANALYZE result:");
  const explain = await pool.query(
    "EXPLAIN ANALYZE SELECT * FROM payroll_streams WHERE employer_address = $1 AND status = $2 LIMIT 50",
    [targetEmployer, "active"]
  );
  explain.rows.forEach((row: any) => console.log(`   ${row["QUERY PLAN"]}`));

  process.exit(0);
}

benchmark().catch((err) => {
  console.error("❌ Benchmark failed:", err);
  process.exit(1);
});
