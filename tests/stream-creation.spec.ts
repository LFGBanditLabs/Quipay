/**
 * E2E tests for stream creation flow
 * Tests the critical user journey from form filling to transaction confirmation
 */

import { test, expect } from "./fixtures/wallet";

test.describe("Stream Creation Flow", () => {
  test.beforeEach(async ({ page, mockWallet }) => {
    // Connect wallet before each test
    await mockWallet.connect();
    await page.goto("/");
  });

  test("should successfully create a stream with valid inputs", async ({
    page,
    mockWallet,
  }) => {
    // Mock successful contract calls
    await mockWallet.mockContractCall("PAYROLL_STREAM", "create_stream", {
      stream_id: 1,
    });
    await mockWallet.mockSignTransaction(true);

    // Navigate to create stream page
    await page.goto("/create-stream");

    // Verify we're on the create stream page
    await expect(
      page.getByRole("heading", { name: /create.*stream/i }),
    ).toBeVisible();

    // Fill in worker address
    const workerAddressInput = page.getByLabel(/worker.*address/i);
    await workerAddressInput.fill(
      "GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );

    // Fill in flow rate
    const rateInput = page.getByLabel(/flow rate/i);
    await rateInput.fill("0.0001");

    // Set start date (today)
    const today = new Date().toISOString().split("T")[0];
    const startDateInput = page.getByLabel(/start date/i);
    await startDateInput.fill(today);

    // Set end date (30 days from now)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    const endDateStr = endDate.toISOString().split("T")[0];
    const endDateInput = page.getByLabel(/end date/i);
    await endDateInput.fill(endDateStr);

    // Verify estimated total is calculated
    await expect(page.getByText(/estimated total/i)).toBeVisible();

    // Wait for solvency check to complete
    await expect(page.getByText(/treasury funds confirmed/i)).toBeVisible({
      timeout: 5000,
    });

    // Submit the form
    const submitButton = page.getByRole("button", { name: /create stream/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Verify transaction progress
    await expect(page.getByText(/simulating/i)).toBeVisible();
    await expect(page.getByText(/signing/i)).toBeVisible();
    await expect(page.getByText(/submitting/i)).toBeVisible();

    // Verify success message
    await expect(page.getByText(/stream created successfully/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show validation error for invalid worker address", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Fill in invalid worker address
    const workerAddressInput = page.getByLabel(/worker.*address/i);
    await workerAddressInput.fill("INVALID_ADDRESS");

    // Fill other required fields
    const rateInput = page.getByLabel(/flow rate/i);
    await rateInput.fill("0.0001");

    const today = new Date().toISOString().split("T")[0];
    await page.getByLabel(/start date/i).fill(today);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    // Try to submit
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify validation error is shown
    await expect(
      page.getByText(/must be a valid stellar public key/i),
    ).toBeVisible();
  });

  test("should show validation error for missing worker address", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Leave worker address empty, fill other fields
    const rateInput = page.getByLabel(/flow rate/i);
    await rateInput.fill("0.0001");

    const today = new Date().toISOString().split("T")[0];
    await page.getByLabel(/start date/i).fill(today);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    // Try to submit
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify validation error
    await expect(page.getByText(/worker address is required/i)).toBeVisible();
  });

  test("should show validation error for invalid amount (zero)", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Fill in valid worker address
    await page
      .getByLabel(/worker.*address/i)
      .fill("GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");

    // Fill in zero rate
    await page.getByLabel(/flow rate/i).fill("0");

    const today = new Date().toISOString().split("T")[0];
    await page.getByLabel(/start date/i).fill(today);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    // Try to submit
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify validation error
    await expect(
      page.getByText(/rate must be a positive number/i),
    ).toBeVisible();
  });

  test("should show validation error for invalid amount (negative)", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Fill in valid worker address
    await page
      .getByLabel(/worker.*address/i)
      .fill("GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");

    // Fill in negative rate
    await page.getByLabel(/flow rate/i).fill("-0.0001");

    const today = new Date().toISOString().split("T")[0];
    await page.getByLabel(/start date/i).fill(today);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    // Try to submit
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify validation error
    await expect(
      page.getByText(/rate must be a positive number/i),
    ).toBeVisible();
  });

  test("should show validation error for end date before start date", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Fill in valid worker address
    await page
      .getByLabel(/worker.*address/i)
      .fill("GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");

    // Fill in valid rate
    await page.getByLabel(/flow rate/i).fill("0.0001");

    // Set end date before start date
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await page
      .getByLabel(/start date/i)
      .fill(tomorrow.toISOString().split("T")[0]);
    await page.getByLabel(/end date/i).fill(today.toISOString().split("T")[0]);

    // Try to submit
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify validation error
    await expect(
      page.getByText(/end date must be after.*start date/i),
    ).toBeVisible();
  });

  test("should show validation error for start date in the past", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Fill in valid worker address
    await page
      .getByLabel(/worker.*address/i)
      .fill("GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");

    // Fill in valid rate
    await page.getByLabel(/flow rate/i).fill("0.0001");

    // Set start date in the past
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await page
      .getByLabel(/start date/i)
      .fill(yesterday.toISOString().split("T")[0]);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page
      .getByLabel(/end date/i)
      .fill(tomorrow.toISOString().split("T")[0]);

    // Try to submit
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify validation error
    await expect(
      page.getByText(/start date cannot be in the past/i),
    ).toBeVisible();
  });

  test("should disable submit button when form is invalid", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Submit button should be disabled initially
    const submitButton = page.getByRole("button", { name: /create stream/i });
    await expect(submitButton).toBeDisabled();

    // Fill in only worker address
    await page
      .getByLabel(/worker.*address/i)
      .fill("GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");

    // Button should still be disabled
    await expect(submitButton).toBeDisabled();

    // Fill in rate
    await page.getByLabel(/flow rate/i).fill("0.0001");

    // Button should still be disabled (missing dates)
    await expect(submitButton).toBeDisabled();

    // Fill in dates
    const today = new Date().toISOString().split("T")[0];
    await page.getByLabel(/start date/i).fill(today);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    // Now button should be enabled
    await expect(submitButton).toBeEnabled();
  });

  test("should handle transaction rejection gracefully", async ({
    page,
    mockWallet,
  }) => {
    // Mock transaction rejection
    await mockWallet.mockSignTransaction(false);

    await page.goto("/create-stream");

    // Fill in valid form data
    await page
      .getByLabel(/worker.*address/i)
      .fill("GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
    await page.getByLabel(/flow rate/i).fill("0.0001");

    const today = new Date().toISOString().split("T")[0];
    await page.getByLabel(/start date/i).fill(today);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    // Submit the form
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify error message is shown
    await expect(page.getByText(/user rejected transaction/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show estimated total commitment", async ({ page }) => {
    await page.goto("/create-stream");

    // Fill in rate
    await page.getByLabel(/flow rate/i).fill("0.0001");

    // Fill in dates (30 days)
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);

    await page
      .getByLabel(/start date/i)
      .fill(today.toISOString().split("T")[0]);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    // Verify estimated total is displayed
    await expect(page.getByText(/estimated total commitment/i)).toBeVisible();

    // Calculate expected total (0.0001 tokens/sec * 30 days * 86400 sec/day = 259.2 tokens)
    await expect(page.getByText(/259\.2/)).toBeVisible();
  });

  test("should show solvency warning when treasury is insufficient", async ({
    page,
    mockWallet,
  }) => {
    // Mock insufficient treasury balance
    await mockWallet.mockContractCall("PAYROLL_VAULT", "check_solvency", false);

    await page.goto("/create-stream");

    // Fill in form with large amount
    await page
      .getByLabel(/worker.*address/i)
      .fill("GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
    await page.getByLabel(/flow rate/i).fill("1000");

    const today = new Date().toISOString().split("T")[0];
    await page.getByLabel(/start date/i).fill(today);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    // Wait for solvency check
    await page.waitForTimeout(1000);

    // Verify warning is shown
    await expect(page.getByText(/treasury may be insufficient/i)).toBeVisible();
  });

  test("should clear validation errors when user corrects input", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Enter invalid worker address
    const workerAddressInput = page.getByLabel(/worker.*address/i);
    await workerAddressInput.fill("INVALID");

    // Fill other fields and try to submit
    await page.getByLabel(/flow rate/i).fill("0.0001");
    const today = new Date().toISOString().split("T")[0];
    await page.getByLabel(/start date/i).fill(today);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await page
      .getByLabel(/end date/i)
      .fill(endDate.toISOString().split("T")[0]);

    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify error is shown
    await expect(
      page.getByText(/must be a valid stellar public key/i),
    ).toBeVisible();

    // Correct the input
    await workerAddressInput.clear();
    await workerAddressInput.fill(
      "GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );

    // Error should disappear
    await expect(
      page.getByText(/must be a valid stellar public key/i),
    ).not.toBeVisible();
  });
});

test.describe("Stream Creation - Wallet Not Connected", () => {
  test("should show wallet connection prompt when not connected", async ({
    page,
  }) => {
    // Don't connect wallet for this test
    await page.goto("/create-stream");

    // Should redirect to home or show connection prompt
    await expect(page.getByText(/connect.*wallet/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should redirect to home when accessing create-stream without wallet", async ({
    page,
  }) => {
    // Navigate without wallet connection
    await page.goto("/create-stream");

    // Should redirect to home page
    await page.waitForURL("/", { timeout: 5000 });
    expect(page.url()).toBe("http://localhost:5173/");
  });
});
