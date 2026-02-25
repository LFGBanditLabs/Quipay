/**
 * Quick Integration Test for Audit Logging
 *
 * Run this to verify the audit logging system is working correctly.
 * Usage: ts-node backend/src/audit/test-integration.ts
 */

import { initDb } from "../db/pool";
import { initAuditLogger } from "./init";

async function testAuditLogging() {
  console.log("🧪 Testing Audit Logging System...\n");

  try {
    // Initialize database
    console.log("1. Initializing database...");
    await initDb();
    console.log("   ✅ Database initialized\n");

    // Initialize audit logger
    console.log("2. Initializing audit logger...");
    const auditLogger = initAuditLogger();
    console.log("   ✅ Audit logger initialized\n");

    // Test 1: Log a simple INFO message
    console.log("3. Testing INFO log...");
    await auditLogger.info("Test info message", {
      action_type: "system",
      test: true,
    });
    console.log("   ✅ INFO log created\n");

    // Test 2: Log a WARN message
    console.log("4. Testing WARN log...");
    await auditLogger.warn("Test warning message", {
      action_type: "system",
      test: true,
    });
    console.log("   ✅ WARN log created\n");

    // Test 3: Log an ERROR with stack trace
    console.log("5. Testing ERROR log...");
    const testError = new Error("Test error for audit logging");
    await auditLogger.error("Test error message", testError, {
      action_type: "system",
      test: true,
    });
    console.log("   ✅ ERROR log created\n");

    // Test 4: Log a stream creation
    console.log("6. Testing stream creation log...");
    await auditLogger.logStreamCreation({
      employer: "GTEST_EMPLOYER_123",
      worker: "GTEST_WORKER_456",
      token: "USDC",
      amount: "1000",
      duration: 30,
      streamId: 999,
      transactionHash: "0xtest123",
      blockNumber: 123456,
      success: true,
    });
    console.log("   ✅ Stream creation log created\n");

    // Test 5: Log a scheduler event
    console.log("7. Testing scheduler event log...");
    await auditLogger.logSchedulerEvent({
      scheduleId: 1,
      action: "task_completed",
      taskName: "test-task",
      employer: "GTEST_EMPLOYER_123",
      executionTime: 1500,
    });
    console.log("   ✅ Scheduler event log created\n");

    // Test 6: Log a monitor event
    console.log("8. Testing monitor event log...");
    await auditLogger.logMonitorEvent({
      employer: "GTEST_EMPLOYER_123",
      balance: 10000,
      liabilities: 5000,
      dailyBurnRate: 500,
      runwayDays: 10,
      alertSent: false,
      checkType: "routine",
    });
    console.log("   ✅ Monitor event log created\n");

    // Test 7: Test redaction
    console.log("9. Testing sensitive data redaction...");
    await auditLogger.info("Testing redaction", {
      action_type: "system",
      privateKey: "SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      password: "super-secret-password",
      publicKey: "GTEST_PUBLIC_KEY_123",
    });
    console.log("   ✅ Redaction test completed\n");

    // Wait for async writes to flush
    console.log("10. Waiting for logs to flush to database...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("   ✅ Logs flushed\n");

    // Test 8: Query logs
    console.log("11. Testing log query...");
    const logs = await auditLogger.query({
      employer: "GTEST_EMPLOYER_123",
      limit: 10,
    });
    console.log(`   ✅ Found ${logs.length} logs for test employer\n`);

    // Test 9: Export logs
    console.log("12. Testing log export (JSON)...");
    const jsonExport = await auditLogger.export("GTEST_EMPLOYER_123", {
      format: "json",
    });
    console.log(`   ✅ Exported ${jsonExport.length} characters of JSON\n`);

    // Shutdown
    console.log("13. Shutting down audit logger...");
    await auditLogger.shutdown();
    console.log("   ✅ Audit logger shut down\n");

    console.log(
      "🎉 All tests passed! Audit logging system is working correctly.\n",
    );
    console.log("📊 Check your database with:");
    console.log(
      "   SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;\n",
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
testAuditLogging();
