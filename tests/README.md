# E2E Tests

This directory contains end-to-end tests for Quipay using Playwright.

## Test Structure

```
tests/
├── fixtures/
│   └── wallet.ts           # Mock wallet fixtures for testing
├── helpers/
│   └── test-utils.ts       # Common test utilities
├── wallet-guard.spec.ts    # Wallet authentication tests
├── stream-creation.spec.ts # Stream creation flow tests
└── stream-creation-advanced.spec.ts # Advanced scenarios and edge cases
```

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

## Test Coverage

### Stream Creation Flow (`stream-creation.spec.ts`)

- ✅ Successful stream creation with valid inputs
- ✅ Validation errors (invalid/missing worker address)
- ✅ Validation errors (invalid amounts: zero, negative)
- ✅ Validation errors (invalid date ranges)
- ✅ Submit button disabled when form is invalid
- ✅ Transaction rejection handling
- ✅ Estimated total calculation
- ✅ Solvency warnings
- ✅ Validation error clearing on correction
- ✅ Wallet not connected state

### Advanced Scenarios (`stream-creation-advanced.spec.ts`)

- ✅ Contract error handling (InsufficientBalance, InvalidTimeRange, etc.)
- ✅ Network timeout handling
- ✅ Rate precision validation (very small/large values)
- ✅ Stream duration edge cases (very long/short)
- ✅ Dynamic form updates (rate/date changes)
- ✅ Solvency check loading states
- ✅ Form data preservation on validation failure
- ✅ Browser navigation (back button, refresh)
- ✅ RPC endpoint unavailability
- ✅ Accessibility (ARIA labels, keyboard navigation, screen readers)

## Mock Wallet Fixture

The `mockWallet` fixture provides:

- `connect()` - Simulates wallet connection
- `disconnect()` - Simulates wallet disconnection
- `mockSignTransaction(shouldSucceed)` - Mocks transaction signing
- `mockContractCall(contractId, method, response)` - Mocks contract calls

### Example Usage

```typescript
import { test, expect } from "./fixtures/wallet";

test("my test", async ({ page, mockWallet }) => {
  // Connect wallet
  await mockWallet.connect();

  // Mock successful contract call
  await mockWallet.mockContractCall("PAYROLL_STREAM", "create_stream", {
    stream_id: 1,
  });

  // Navigate and test
  await page.goto("/create-stream");
  // ... test code
});
```

## Test Utilities

The `test-utils.ts` file provides helper functions:

- `generateMockStellarAddress()` - Generates valid Stellar addresses
- `fillStreamForm()` - Fills the stream creation form
- `waitForTransactionComplete()` - Waits for transaction completion
- `getTodayString()` / `getFutureDateString()` / `getPastDateString()` - Date helpers
- `calculateStreamTotal()` - Calculates expected stream totals
- `mockSuccessResponse()` / `mockErrorResponse()` - Mock RPC responses

## Writing New Tests

1. Import the test fixture:

```typescript
import { test, expect } from "./fixtures/wallet";
```

2. Use the `mockWallet` fixture:

```typescript
test("my test", async ({ page, mockWallet }) => {
  await mockWallet.connect();
  // ... test code
});
```

3. Use helper functions for common operations:

```typescript
import { fillStreamForm, getTodayString } from "./helpers/test-utils";

await fillStreamForm(page, {
  rate: "0.0001",
  startDate: getTodayString(),
});
```

## CI/CD Integration

Tests run automatically on:

- Pull requests
- Pushes to main branch
- Manual workflow dispatch

See `.github/workflows/` for CI configuration.

## Debugging Tests

### Visual Debugging

```bash
# Run with UI mode
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed
```

### Debug Mode

```bash
# Step through tests with debugger
npm run test:e2e:debug
```

### Screenshots

Tests automatically capture screenshots on failure. Find them in:

```
playwright-report/screenshots/
```

### Trace Viewer

View detailed traces of failed tests:

```bash
npm run test:e2e:report
```

## Best Practices

1. **Use fixtures** - Always use the `mockWallet` fixture for wallet interactions
2. **Use helpers** - Leverage test utilities for common operations
3. **Test user flows** - Focus on complete user journeys, not just individual functions
4. **Handle async** - Always await async operations
5. **Clear state** - Use `beforeEach` to reset state between tests
6. **Descriptive names** - Use clear, descriptive test names
7. **Assertions** - Include meaningful assertions with timeout options
8. **Error scenarios** - Test both success and failure paths

## Troubleshooting

### Tests timing out

Increase timeout in test:

```typescript
test(
  "my test",
  async ({ page }) => {
    // ... test code
  },
  { timeout: 60000 },
); // 60 second timeout
```

### Element not found

Use explicit waits:

```typescript
await page.waitForSelector('button[type="submit"]', { timeout: 5000 });
```

### Flaky tests

Add retry logic in `playwright.config.ts`:

```typescript
retries: process.env.CI ? 2 : 0,
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
