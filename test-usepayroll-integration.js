// Simple test to verify usePayroll integration
// This file checks that the new functions are properly exported

console.log("Testing usePayroll integration...");

// Test 1: Check if getStreamsByEmployer is exported from payroll_stream
try {
  const payrollStreamModule = await import("./src/contracts/payroll_stream.ts");
  const hasGetStreamsByEmployer =
    typeof payrollStreamModule.getStreamsByEmployer === "function";
  console.log(
    "✓ getStreamsByEmployer function exists:",
    hasGetStreamsByEmployer,
  );
} catch (error) {
  console.log("✗ Error importing payroll_stream module:", error.message);
}

// Test 2: Check if usePayroll hook can be imported
try {
  const usePayrollModule = await import("./src/hooks/usePayroll.ts");
  const hasUsePayroll = typeof usePayrollModule.usePayroll === "function";
  console.log("✓ usePayroll hook exists:", hasUsePayroll);
} catch (error) {
  console.log("✗ Error importing usePayroll module:", error.message);
}

console.log("Integration test completed.");
