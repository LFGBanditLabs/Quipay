/**
 * Advanced E2E tests for stream creation edge cases and error scenarios
 */

import { test, expect } from "./fixtures/wallet";
import {
  fillStreamForm,
  getTodayString,
  getFutureDateString,
  calculateStreamTotal,
  mockErrorResponse,
} from "./helpers/test-utils";

test.describe("Stream Creation - Advanced Scenarios", () => {
  test.beforeEach(async ({ page, mockWallet }) => {
    await mockWallet.connect();
    await page.goto("/create-stream");
  });

  test("should handle contract error: InsufficientBalance (1006)", async ({
    page,
    mockWallet,
  }) => {
    // Mock contract error response
    await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
      const response = mockErrorResponse(
        1006,
        "Contract Error: InsufficientBalance",
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });

    await fillStreamForm(page, {
      rate: "1000", // Large amount to trigger insufficient balance
    });

    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify error message
    await expect(
      page.getByText(/treasury lacks sufficient funds|insufficient balance/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should handle contract error: InvalidTimeRange (1021)", async ({
    page,
  }) => {
    await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
      const response = mockErrorResponse(
        1021,
        "Contract Error: InvalidTimeRange",
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });

    await fillStreamForm(page);
    await page.getByRole("button", { name: /create stream/i }).click();

    await expect(
      page.getByText(/start date cannot be in the past|invalid.*time.*range/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should handle contract error: InvalidAddress (1010)", async ({
    page,
  }) => {
    await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
      const response = mockErrorResponse(
        1010,
        "Contract Error: InvalidAddress",
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });

    await fillStreamForm(page);
    await page.getByRole("button", { name: /create stream/i }).click();

    await expect(
      page.getByText(/address is invalid|invalid address/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should handle network timeout gracefully", async ({ page }) => {
    // Mock slow network response
    await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 35000)); // Longer than timeout
      await route.abort("timedout");
    });

    await fillStreamForm(page);
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify timeout error is shown
    await expect(
      page.getByText(/timeout|network error|failed to connect/i),
    ).toBeVisible({ timeout: 40000 });
  });

  test("should validate rate precision (very small values)", async ({
    page,
  }) => {
    await fillStreamForm(page, {
      rate: "0.0000000001", // Very small rate
    });

    // Should still be valid
    const submitButton = page.getByRole("button", { name: /create stream/i });
    await expect(submitButton).toBeEnabled();

    // Verify estimated total is calculated
    await expect(page.getByText(/estimated total/i)).toBeVisible();
  });

  test("should validate rate precision (very large values)", async ({
    page,
  }) => {
    await fillStreamForm(page, {
      rate: "999999999", // Very large rate
    });

    // Should still be valid (contract will check solvency)
    const submitButton = page.getByRole("button", { name: /create stream/i });
    await expect(submitButton).toBeEnabled();

    // Verify estimated total is calculated
    await expect(page.getByText(/estimated total/i)).toBeVisible();
  });

  test("should handle very long stream duration (1 year)", async ({ page }) => {
    const today = getTodayString();
    const oneYearLater = getFutureDateString(365);

    await fillStreamForm(page, {
      rate: "0.0001",
      startDate: today,
      endDate: oneYearLater,
    });

    // Calculate expected total: 0.0001 * 365 * 86400 = 3153.6
    await expect(page.getByText(/3,?153\.6/)).toBeVisible();
  });

  test("should handle very short stream duration (1 hour)", async ({
    page,
  }) => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Note: Date inputs only support day precision, so we'll use same day
    // This tests the edge case of same-day streams
    await fillStreamForm(page, {
      rate: "0.1",
      startDate: now.toISOString().split("T")[0],
      endDate: oneHourLater.toISOString().split("T")[0],
    });

    // Should show estimated total
    await expect(page.getByText(/estimated total/i)).toBeVisible();
  });

  test("should update estimated total when rate changes", async ({ page }) => {
    await fillStreamForm(page, {
      rate: "0.0001",
    });

    // Get initial estimated total
    const estimatedText = await page
      .getByText(/estimated total/i)
      .textContent();

    // Change rate
    await page.getByLabel(/flow rate/i).clear();
    await page.getByLabel(/flow rate/i).fill("0.0002");

    // Wait for recalculation
    await page.waitForTimeout(700); // Debounce time

    // Verify estimated total changed
    const newEstimatedText = await page
      .getByText(/estimated total/i)
      .textContent();

    expect(newEstimatedText).not.toBe(estimatedText);
  });

  test("should update estimated total when dates change", async ({ page }) => {
    await fillStreamForm(page, {
      rate: "0.0001",
      endDate: getFutureDateString(30),
    });

    // Get initial estimated total
    await page.waitForTimeout(700);
    const estimatedText = await page
      .getByText(/estimated total/i)
      .textContent();

    // Change end date to 60 days
    await page.getByLabel(/end date/i).clear();
    await page.getByLabel(/end date/i).fill(getFutureDateString(60));

    // Wait for recalculation
    await page.waitForTimeout(700);

    // Verify estimated total changed (should be ~2x)
    const newEstimatedText = await page
      .getByText(/estimated total/i)
      .textContent();

    expect(newEstimatedText).not.toBe(estimatedText);
  });

  test("should show loading state during solvency check", async ({ page }) => {
    await fillStreamForm(page);

    // Verify solvency check loading state
    await expect(page.getByText(/checking treasury solvency/i)).toBeVisible({
      timeout: 2000,
    });
  });

  test("should handle multiple rapid form changes", async ({ page }) => {
    const rateInput = page.getByLabel(/flow rate/i);

    // Rapidly change rate multiple times
    await rateInput.fill("0.0001");
    await rateInput.fill("0.0002");
    await rateInput.fill("0.0003");
    await rateInput.fill("0.0004");
    await rateInput.fill("0.0005");

    // Fill other fields
    await fillStreamForm(page, {
      rate: "0.0005", // Final rate
    });

    // Wait for debounce
    await page.waitForTimeout(1000);

    // Verify final estimated total is correct
    await expect(page.getByText(/estimated total/i)).toBeVisible();
  });

  test("should preserve form data when validation fails", async ({ page }) => {
    const workerAddress =
      "GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    const rate = "0.0001";

    await page.getByLabel(/worker.*address/i).fill(workerAddress);
    await page.getByLabel(/flow rate/i).fill(rate);

    // Leave dates empty and try to submit
    await page.getByRole("button", { name: /create stream/i }).click();

    // Verify validation error
    await expect(page.getByText(/start date is required/i)).toBeVisible();

    // Verify form data is preserved
    await expect(page.getByLabel(/worker.*address/i)).toHaveValue(
      workerAddress,
    );
    await expect(page.getByLabel(/flow rate/i)).toHaveValue(rate);
  });

  test("should handle browser back button during form filling", async ({
    page,
  }) => {
    await fillStreamForm(page, {
      rate: "0.0001",
    });

    // Navigate away
    await page.goto("/");

    // Go back
    await page.goBack();

    // Form should be reset (not preserved by default)
    await expect(page.getByLabel(/worker.*address/i)).toHaveValue("");
  });

  test("should handle page refresh during form filling", async ({ page }) => {
    await fillStreamForm(page, {
      rate: "0.0001",
    });

    // Refresh page
    await page.reload();

    // Form should be reset
    await expect(page.getByLabel(/worker.*address/i)).toHaveValue("");
  });

  test("should show appropriate error for contract not initialized", async ({
    page,
  }) => {
    await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
      const response = mockErrorResponse(
        1002,
        "Contract Error: NotInitialized",
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });

    await fillStreamForm(page);
    await page.getByRole("button", { name: /create stream/i }).click();

    await expect(
      page.getByText(/contract.*not.*initialized|configuration error/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should handle RPC endpoint unavailable", async ({ page }) => {
    await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
      await route.abort("failed");
    });

    await fillStreamForm(page);
    await page.getByRole("button", { name: /create stream/i }).click();

    await expect(
      page.getByText(/network error|failed to connect|rpc.*unavailable/i),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Stream Creation - Accessibility", () => {
  test.beforeEach(async ({ page, mockWallet }) => {
    await mockWallet.connect();
    await page.goto("/create-stream");
  });

  test("should have proper ARIA labels on form fields", async ({ page }) => {
    // Check for aria-labels
    await expect(page.getByLabel(/worker.*address/i)).toHaveAttribute(
      "aria-invalid",
      "false",
    );

    // Fill invalid data
    await page.getByLabel(/worker.*address/i).fill("INVALID");
    await page.getByLabel(/flow rate/i).fill("0.0001");
    await fillStreamForm(page);
    await page.getByRole("button", { name: /create stream/i }).click();

    // Check aria-invalid is set
    await expect(page.getByLabel(/worker.*address/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("should be keyboard navigable", async ({ page }) => {
    // Tab through form fields
    await page.keyboard.press("Tab"); // Worker address
    await page.keyboard.type(
      "GBWORKER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );

    await page.keyboard.press("Tab"); // Rate
    await page.keyboard.type("0.0001");

    await page.keyboard.press("Tab"); // Start date
    await page.keyboard.type(getTodayString());

    await page.keyboard.press("Tab"); // End date
    await page.keyboard.type(getFutureDateString(30));

    // Tab to submit button and press Enter
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // Form should attempt to submit
    await expect(page.getByText(/simulating|signing|submitting/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should announce validation errors to screen readers", async ({
    page,
  }) => {
    // Check for aria-live regions
    const errorContainer = page.locator('[aria-live="assertive"]');
    await expect(errorContainer).toBeAttached();

    // Trigger validation error
    await page.getByLabel(/worker.*address/i).fill("INVALID");
    await fillStreamForm(page);
    await page.getByRole("button", { name: /create stream/i }).click();

    // Error should be in aria-live region
    const errorText = await errorContainer.textContent();
    expect(errorText).toMatch(/must be a valid stellar public key/i);
  });
});
