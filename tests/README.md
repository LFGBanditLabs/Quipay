# Playwright E2E Tests

End-to-end tests for the Quipay frontend using Playwright.

## Test Structure

```
tests/
├── fixtures/
│   └── wallet.ts           # Mock wallet fixture for testing
├── helpers/
│   └── test-utils.ts       # Shared test utilities
├── wallet-guard.spec.ts    # Wallet authentication tests
├── stream-creation.spec.ts # Core stream creation flow tests
└── stream-creation-advanced.spec.ts # Advanced scenarios and edge cases
```

## Running Tests

### Run all tests

```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)

```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)

```bash
npm run test:e2e:headed
```

### Run specific test file

```bash
npx playwright test stream-creation.spec.ts
```

### Debug tests

```bash
npm run test:e2e:debug
```

### View test report

```bash
npm run test:e2e:report
```

## Test Coverage

### Stream Creation Flow (`stream-creation.spec.ts`)

Core user journey tests:

- ✅ Navigate to create stream page when wallet connected
- ✅ Complete full stream creation flow
- ✅ Validation for invalid amount
- ✅ Validation for missing worker address
- ✅ Navigate back through wizard steps
- ✅ Cancel stream creation
- ✅ Date range validation
- ✅ Token selection (USDC/XLM)
- ✅ Step progress indicators
- ✅ Form data persistence

### Advanced Scenarios (`stream-creation-advanced.spec.ts`)

Edge cases and error handling:

- ✅ Wallet not connected state
- ✅ Transaction rejection handling
- ✅ Stellar address format validation
- ✅ Very large amounts
- ✅ Decimal amounts
- ✅ Zero amount validation
- ✅ Empty amount validation
- ✅ Missing worker name
- ✅ Missing dates
- ✅ Form field labels
- ✅ Tooltips display
- ✅ Special characters in names
- ✅ Page title and description

### Wallet Guard (`wallet-guard.spec.ts`)

Authentication tests:

- ✅ Redirect to home when accessing protected routes without wallet
- ✅ Multiple protected routes tested

## Mock Wallet Fixture

The `MockWallet` fixture simulates Stellar wallet behavior for testing:

```typescript
import { MockWallet } from "./fixtures/wallet";

test("example", async ({ page }) => {
  const mockWallet = new MockWallet(page, {
    publicKey: "GBTEST...",
    isConnected: true,
    shouldFailTransaction: false,
  });
  await mockWallet.setup();

  // Your test code here
});
```

### Options

- `publicKey`: Mock Stellar public key (default: generated)
- `isConnected`: Whether wallet is connected (default: true)
- `shouldFailTransaction`: Simulate transaction rejection (default: false)

## Test Utilities

Helper functions in `helpers/test-utils.ts`:

### fillStreamForm

Fills the entire stream creation form:

```typescript
await fillStreamForm(page, {
  workerName: "John Doe",
  workerAddress: "GWORKER...",
  amount: "1000",
  token: "USDC",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
});
```

### waitForAlert

Waits for and captures alert dialog:

```typescript
const alertPromise = waitForAlert(page);
await page.click('button:has-text("Complete")');
const message = await alertPromise;
expect(message).toContain("successfully");
```

### isVisible

Checks if element is visible:

```typescript
const visible = await isVisible(page, ".error-message");
```

### getValidationError

Gets validation error message:

```typescript
const error = await getValidationError(page);
expect(error).toContain("Invalid amount");
```

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from "@playwright/test";
import { MockWallet } from "./fixtures/wallet";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();
  });

  test("should do something", async ({ page }) => {
    await page.goto("/create-stream");
    // Test code here
  });
});
```

### Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByText`, `getByLabel` over CSS selectors
2. **Wait for elements**: Use `waitForSelector` or `expect().toBeVisible()` instead of timeouts
3. **Mock external dependencies**: Use fixtures for wallets, APIs, etc.
4. **Test user flows, not implementation**: Focus on what users do, not how it's coded
5. **Keep tests independent**: Each test should work in isolation
6. **Use descriptive test names**: Clearly state what is being tested

### Example Test

```typescript
test("should validate required fields", async ({ page }) => {
  const mockWallet = new MockWallet(page);
  await mockWallet.setup();

  await page.goto("/create-stream");

  // Try to proceed without filling form
  const nextButton = page.locator('button:has-text("Next")');
  await expect(nextButton).toBeDisabled();

  // Fill required field
  await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");

  // Still disabled (need all required fields)
  await expect(nextButton).toBeDisabled();

  // Fill remaining required field
  await page.fill('input[placeholder="G..."]', "GWORKER...");

  // Now enabled
  await expect(nextButton).toBeEnabled();
});
```

## CI/CD Integration

Tests run automatically in CI on pull requests. The Playwright configuration:

- Uses Chromium browser
- Runs tests serially in CI (`workers: 1`)
- Retries failed tests 2 times in CI
- Starts dev server automatically before tests
- Generates HTML report on failures

## Debugging Failed Tests

### View trace

```bash
npx playwright show-trace trace.zip
```

### Run with debug mode

```bash
npx playwright test --debug
```

### Run specific test with headed browser

```bash
npx playwright test stream-creation.spec.ts --headed
```

### Take screenshots on failure

Tests automatically capture screenshots on failure. Find them in `test-results/`.

## Configuration

Playwright configuration is in `playwright.config.ts`:

- Base URL: `http://localhost:5173`
- Test directory: `./tests`
- Timeout: Default Playwright timeout
- Retries: 2 in CI, 0 locally
- Workers: 1 in CI, parallel locally

## Accessibility Testing

Consider adding accessibility tests:

```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("should not have accessibility violations", async ({ page }) => {
  await page.goto("/create-stream");

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

## Future Test Ideas

- Contract interaction simulation
- Network error handling
- Transaction confirmation flow
- Stream creation with cliff period
- Multiple streams creation
- Stream creation with different tokens
- Mobile responsive testing
- Keyboard navigation
- Screen reader compatibility

## Support

For issues with tests:

1. Check test output and screenshots in `test-results/`
2. Run tests with `--debug` flag
3. Review Playwright documentation: https://playwright.dev
4. Check mock wallet fixture implementation
