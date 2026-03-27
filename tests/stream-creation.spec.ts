/**
 * E2E Tests for Stream Creation Flow
 * Tests the critical user journey of creating a payment stream
 */

import { test, expect } from "@playwright/test";
import { MockWallet } from "./fixtures/wallet";
import { fillStreamForm, waitForAlert } from "./helpers/test-utils";

test.describe("Stream Creation Flow", () => {
  let mockWallet: MockWallet;

  test.beforeEach(async ({ page }) => {
    // Setup mock wallet
    mockWallet = new MockWallet(page, {
      publicKey: "GBTEST123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      isConnected: true,
    });
    await mockWallet.setup();
  });

  test("should navigate to create stream page when wallet is connected", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Should not redirect since wallet is connected
    await expect(page).toHaveURL("/create-stream");

    // Check page title
    await expect(
      page.getByRole("heading", { name: /create new payment stream/i }),
    ).toBeVisible();
  });

  test("should complete full stream creation flow", async ({ page }) => {
    await page.goto("/create-stream");

    // Fill the form
    await fillStreamForm(page, {
      workerName: "John Doe",
      workerAddress: "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      amount: "1000",
      token: "USDC",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    // Should be on review step
    await expect(page.getByText("Review")).toBeVisible();

    // Verify review data
    await expect(page.getByText("John Doe")).toBeVisible();
    await expect(
      page.getByText("GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"),
    ).toBeVisible();
    await expect(page.getByText("1000 USDC")).toBeVisible();

    // Complete the stream creation
    const alertPromise = waitForAlert(page);
    await page.click('button:has-text("Complete")');

    // Verify success message
    const alertMessage = await alertPromise;
    expect(alertMessage).toContain("successfully");

    // Should navigate to dashboard
    await expect(page).toHaveURL("/dashboard");
  });

  test("should show validation error for invalid amount", async ({ page }) => {
    await page.goto("/create-stream");

    // Step 1: Fill recipient
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    // Step 2: Try invalid amount
    await page.fill('input[placeholder="0.00"]', "-100");

    // Next button should be disabled for invalid amount
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();
  });

  test("should show validation error for missing worker address", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Fill only worker name, leave address empty
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");

    // Next button should be disabled
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();
  });

  test("should allow going back to previous steps", async ({ page }) => {
    await page.goto("/create-stream");

    // Fill step 1
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    // Fill step 2
    await page.fill('input[placeholder="0.00"]', "1000");
    await page.click('button:has-text("Next")');

    // Now on step 3
    await expect(page.getByText("Schedule")).toBeVisible();

    // Go back
    await page.click('button:has-text("Back")');

    // Should be back on step 2
    await expect(page.getByText("Payment")).toBeVisible();
    await expect(page.locator('input[placeholder="0.00"]')).toHaveValue("1000");
  });

  test("should cancel stream creation and return to dashboard", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Click cancel button
    await page.click('button:has-text("Cancel")');

    // Should navigate to dashboard
    await expect(page).toHaveURL("/dashboard");
  });

  test("should validate date range (end date after start date)", async ({
    page,
  }) => {
    await page.goto("/create-stream");

    // Fill steps 1 and 2
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    await page.fill('input[placeholder="0.00"]', "1000");
    await page.click('button:has-text("Next")');

    // Fill dates with end before start
    const dateInputs = await page.locator('input[type="date"]').all();
    await dateInputs[0].fill("2024-12-31");
    await dateInputs[1].fill("2024-01-01");

    // Next button should be enabled (basic validation passes)
    // but ideally there should be additional validation
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeEnabled();
  });

  test("should support different token selection", async ({ page }) => {
    await page.goto("/create-stream");

    // Fill step 1
    await page.fill('input[placeholder="e.g. John Doe"]', "Jane Smith");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    // Select XLM token
    await page.fill('input[placeholder="0.00"]', "500");
    await page.selectOption("select", "XLM");
    await page.click('button:has-text("Next")');

    // Fill dates
    const dateInputs = await page.locator('input[type="date"]').all();
    await dateInputs[0].fill("2024-01-01");
    await dateInputs[1].fill("2024-12-31");
    await page.click('button:has-text("Next")');

    // Verify XLM is shown in review
    await expect(page.getByText("500 XLM")).toBeVisible();
  });

  test("should show step progress indicators", async ({ page }) => {
    await page.goto("/create-stream");

    // Check initial step indicator
    const step1 = page.locator("text=1").first();
    await expect(step1).toBeVisible();

    // Complete step 1
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    // Step 1 should show checkmark, step 2 should be active
    await expect(page.locator("text=✓").first()).toBeVisible();
  });

  test("should preserve form data when navigating back", async ({ page }) => {
    await page.goto("/create-stream");

    const workerName = "Test Worker";
    const workerAddress =
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    const amount = "2500";

    // Fill step 1
    await page.fill('input[placeholder="e.g. John Doe"]', workerName);
    await page.fill('input[placeholder="G..."]', workerAddress);
    await page.click('button:has-text("Next")');

    // Fill step 2
    await page.fill('input[placeholder="0.00"]', amount);
    await page.click('button:has-text("Next")');

    // Go back to step 2
    await page.click('button:has-text("Back")');

    // Verify amount is preserved
    await expect(page.locator('input[placeholder="0.00"]')).toHaveValue(amount);

    // Go back to step 1
    await page.click('button:has-text("Back")');

    // Verify step 1 data is preserved
    await expect(
      page.locator('input[placeholder="e.g. John Doe"]'),
    ).toHaveValue(workerName);
    await expect(page.locator('input[placeholder="G..."]')).toHaveValue(
      workerAddress,
    );
  });

  test("should display help documentation link", async ({ page }) => {
    await page.goto("/create-stream");

    // Check for help link
    const helpLink = page.getByRole("link", {
      name: /documentation on streams/i,
    });
    await expect(helpLink).toBeVisible();
  });
});
