/**
 * EXPLAIN ANALYZE Query Performance Tests
 *
 * This script runs EXPLAIN ANALYZE on critical queries to verify
 * query execution plans and catch performance issues in CI/CD.
 *
 * Usage:
 *   npm run test:explain-analyze
 *
 * Or run directly with ts-node:
 *   npx ts-node src/db/explain-analyze-tests.ts
 */

import { query, getPool } from "./pool";

interface QueryTest {
  name: string;
  query: string;
  params?: unknown[];
  maxExecutionTimeMs: number;
  mustUseIndex: boolean;
}

const CRITICAL_QUERIES: QueryTest[] = [
  {
    name: "Get streams by employer with status filter",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM payroll_streams 
      WHERE employer = $1 AND status = $2 
      ORDER BY created_at DESC 
      LIMIT 50 OFFSET 0
    `,
    params: [
      "GA7GZT5QHHM7VFXZC2QBC5XKMWNIFISIXQBYZ3Z3Z3Z3Z3Z3Z3Z3Z3Z",
      "active",
    ],
    maxExecutionTimeMs: 100,
    mustUseIndex: true,
  },
  {
    name: "Get streams by worker with status filter",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM payroll_streams 
      WHERE worker = $1 AND status = $2 
      ORDER BY created_at DESC 
      LIMIT 50 OFFSET 0
    `,
    params: [
      "GA7GZT5QHHM7VFXZC2QBC5XKMWNIFISIXQBYZ3Z3Z3Z3Z3Z3Z3Z3Z3",
      "active",
    ],
    maxExecutionTimeMs: 100,
    mustUseIndex: true,
  },
  {
    name: "Get overall stats (aggregation)",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT
        COUNT(*) AS total_streams,
        COUNT(*) FILTER (WHERE status = 'active') AS active_streams,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_streams,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_streams,
        COALESCE(SUM(total_amount), 0) AS total_volume,
        COALESCE(SUM(withdrawn_amount), 0) AS total_withdrawn
      FROM payroll_streams
    `,
    maxExecutionTimeMs: 200,
    mustUseIndex: true,
  },
  {
    name: "Get withdrawals by worker",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM withdrawals 
      WHERE worker = $1 
      ORDER BY created_at DESC 
      LIMIT 20
    `,
    params: ["GA7GZT5QHHM7VFXZC2QBC5XKMWNIFISIXQBYZ3Z3Z3Z3Z3Z3Z3Z3Z3"],
    maxExecutionTimeMs: 100,
    mustUseIndex: true,
  },
  {
    name: "Get active payroll schedules",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM payroll_schedules 
      WHERE enabled = true 
      ORDER BY next_run_at ASC
    `,
    maxExecutionTimeMs: 100,
    mustUseIndex: true,
  },
  {
    name: "Get treasury monitor logs by employer",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM treasury_monitor_log 
      WHERE employer = $1 
      ORDER BY created_at DESC 
      LIMIT 100
    `,
    params: ["GA7GZT5QHHM7VFXZC2QBC5XKMWNIFISIXQBYZ3Z3Z3Z3Z3Z3Z3Z3Z3"],
    maxExecutionTimeMs: 100,
    mustUseIndex: true,
  },
  {
    name: "Get audit logs by employer and timestamp",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM audit_logs 
      WHERE employer = $1 
      ORDER BY timestamp DESC 
      LIMIT 100
    `,
    params: ["GA7GZT5QHHM7VFXZC2QBC5XKMWNIFISIXQBYZ3Z3Z3Z3Z3Z3Z3Z3Z3"],
    maxExecutionTimeMs: 100,
    mustUseIndex: true,
  },
  {
    name: "Get active liabilities by employer",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT employer, SUM(total_amount - withdrawn_amount) AS liabilities
      FROM payroll_streams
      WHERE status = 'active'
      GROUP BY employer
    `,
    maxExecutionTimeMs: 200,
    mustUseIndex: true,
  },
  {
    name: "Get vault events by address",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM vault_events 
      WHERE address = $1 
      ORDER BY created_at DESC 
      LIMIT 100
    `,
    params: ["GA7GZT5QHHM7VFXZC2QBC5XKMWNIFISIXQBYZ3Z3Z3Z3Z3Z3Z3Z3Z3"],
    maxExecutionTimeMs: 100,
    mustUseIndex: true,
  },
  {
    name: "Get scheduler logs by schedule",
    query: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM scheduler_logs 
      WHERE schedule_id = $1 
      ORDER BY created_at DESC 
      LIMIT 100
    `,
    params: [1],
    maxExecutionTimeMs: 100,
    mustUseIndex: true,
  },
];

interface ExplainResult {
  "Execution Time": number;
  Planning: {
    Time: number;
  };
  Triggers?: string[];
}

function parseExplainOutput(output: string): {
  executionTimeMs: number;
  usesIndex: boolean;
} {
  const lines = output.split("\n");
  let executionTimeMs = 0;
  let usesIndex = false;

  for (const line of lines) {
    if (line.includes("Execution Time:")) {
      const match = line.match(/Execution Time:\s*([\d.]+)/);
      if (match) {
        executionTimeMs = parseFloat(match[1]);
      }
    }
    if (
      line.toLowerCase().includes("index") ||
      line.toLowerCase().includes("bitmap")
    ) {
      usesIndex = true;
    }
    if (line.toLowerCase().includes("seq scan")) {
      usesIndex = false;
    }
  }

  return { executionTimeMs, usesIndex };
}

async function runExplainTests(): Promise<void> {
  if (!getPool()) {
    console.log("⚠️  Database not configured. Skipping EXPLAIN ANALYZE tests.");
    console.log("   Set DATABASE_URL in your .env to run these tests.");
    process.exit(0);
  }

  console.log("\n🧪 Running EXPLAIN ANALYZE Query Performance Tests\n");
  console.log("=".repeat(80));

  let passed = 0;
  let failed = 0;

  for (const test of CRITICAL_QUERIES) {
    try {
      const result = await query<{ "QUERY PLAN": string }>(
        test.query,
        test.params || [],
      );

      const explainOutput = result.rows
        .map((r: { "QUERY PLAN": string }) => r["QUERY PLAN"])
        .join("\n");
      const { executionTimeMs, usesIndex } = parseExplainOutput(explainOutput);

      const timeOk = executionTimeMs <= test.maxExecutionTimeMs;
      const indexOk = !test.mustUseIndex || usesIndex;

      const status = timeOk && indexOk ? "✅ PASS" : "❌ FAIL";

      console.log(`\n${status} ${test.name}`);
      console.log(
        `   Execution Time: ${executionTimeMs.toFixed(2)}ms (max: ${test.maxExecutionTimeMs}ms)`,
      );
      console.log(
        `   Uses Index: ${usesIndex ? "Yes" : "No"} ${test.mustUseIndex ? "(required)" : "(optional)"}`,
      );

      if (!timeOk) {
        console.log(`   ⚠️  EXECUTION TIME EXCEEDED LIMIT`);
        failed++;
      } else if (!indexOk) {
        console.log(`   ⚠️  MISSING INDEX (SEQ SCAN DETECTED)`);
        failed++;
      } else {
        passed++;
      }

      if (executionTimeMs > test.maxExecutionTimeMs * 0.8) {
        console.log(
          `   📝 Query plan:\n${explainOutput.split("\n").slice(0, 5).join("\n")}`,
        );
      }
    } catch (error) {
      console.log(`\n❌ FAIL ${test.name}`);
      console.log(
        `   Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      failed++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log("\n💡 Tips:");
  console.log(
    "   - If queries use Seq Scan, consider adding composite indexes",
  );
  console.log(
    "   - If execution time is high, check for missing indexes or optimize queries",
  );
  console.log("   - Review pg_stat_statements for production query patterns\n");

  if (failed > 0) {
    console.log(
      "❌ Some query performance tests failed. Please review and optimize.",
    );
    process.exit(1);
  }

  console.log("✅ All query performance tests passed!");
}

runExplainTests().catch((error) => {
  console.error("Error running tests:", error);
  process.exit(1);
});
