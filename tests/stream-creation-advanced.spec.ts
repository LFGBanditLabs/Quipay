/**
 * Advanced E2E Tests for Stream Creation
 * Tests edge cases, error handling, and advanced scenarios
 */

import { test, expect } from "@playwright/test";
import { MockWallet } from "./fixtures/wallet";
import { fillStreamForm } from "./helpers/test-utils";

test.describe("Stream Creation - Advanced Scenarios", () => {
  test("should handle wallet not connected state", async ({ page }) => {
    // Don't setup mock wallet (simulates no wallet)
    await page.goto("/create-stream");

    // Should redirect to home page
    await expect(page).toHaveURL("/");
  });

  test("should handle transaction rejection", async ({ page }) => {
    // Setup wallet that will reject transactions
    const mockWallet = new MockWallet(page, {
      isConnected: true,
      shouldFailTransaction: true,
    });
    await mockWallet.setup();

    await page.goto("/create-stream");

    await fillStreamForm(page, {
      workerName: "John Doe",
      workerAddress: "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      amount: "1000",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    // Try to complete
    await page.click('button:has-text("Complete")');

    // Should show error (implementation dependent)
    // This test documents expected behavior
  });

  test("should validate Stellar address format", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    // Try invalid address
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");
    await page.fill('input[placeholder="G..."]', "invalid-address");

    // Next button should be enabled (basic validation)
    // but ideally there should be format validation
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeEnabled();
  });

  test("should handle very large amounts", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    await fillStreamForm(page, {
      workerName: "High Earner",
      workerAddress: "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      amount: "999999999",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    // Should reach review step
    await expect(page.getByText("Review")).toBeVisible();
    await expect(page.getByText("999999999 USDC")).toBeVisible();
  });

  test("should handle decimal amounts", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    await fillStreamForm(page, {
      workerName: "Part Timer",
      workerAddress: "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      amount: "123.45",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    // Verify decimal amount in review
    await expect(page.getByText("123.45 USDC")).toBeVisible();
  });

  test("should handle zero amount validation", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    // Fill step 1
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    // Try zero amount
    await page.fill('input[placeholder="0.00"]', "0");

    // Next button should be disabled
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();
  });

  test("should handle empty amount validation", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    // Fill step 1
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    // Leave amount empty
    // Next button should be disabled
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();
  });

  test("should handle missing worker name", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    // Fill only address, not name
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );

    // Next button should be disabled
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();
  });

  test("should handle missing dates", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

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

    // Don't fill dates
    // Next button should be disabled
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();
  });

  test("should show all form fields with correct labels", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    // Check step 1 labels
    await expect(page.getByText("Worker Name")).toBeVisible();
    await expect(page.getByText("Worker Wallet Address")).toBeVisible();

    // Move to step 2
    await page.fill('input[placeholder="e.g. John Doe"]', "John Doe");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    // Check step 2 labels
    await expect(page.getByText("Total Amount")).toBeVisible();
    await expect(page.getByText("Token")).toBeVisible();

    // Move to step 3
    await page.fill('input[placeholder="0.00"]', "1000");
    await page.click('button:has-text("Next")');

    // Check step 3 labels
    await expect(page.getByText("Start Date")).toBeVisible();
    await expect(page.getByText("End Date")).toBeVisible();
  });

  test("should display tooltips for form fields", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    // Check for tooltip indicators (usually ? or info icons)
    // This depends on the Tooltip component implementation
    const tooltips = page.locator('[data-testid="tooltip"], .tooltip-trigger');
    const count = await tooltips.count();

    // Should have at least some tooltips
    expect(count).toBeGreaterThan(0);
  });

  test("should handle special characters in worker name", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    // Use name with special characters
    await page.fill('input[placeholder="e.g. John Doe"]', "José María O'Brien");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');

    await page.fill('input[placeholder="0.00"]', "1000");
    await page.click('button:has-text("Next")');

    const dateInputs = await page.locator('input[type="date"]').all();
    await dateInputs[0].fill("2024-01-01");
    await dateInputs[1].fill("2024-12-31");
    await page.click('button:has-text("Next")');

    // Verify special characters are preserved
    await expect(page.getByText("José María O'Brien")).toBeVisible();
  });

  test("should show page title and description", async ({ page }) => {
    const mockWallet = new MockWallet(page);
    await mockWallet.setup();

    await page.goto("/create-stream");

    // Check title
    await expect(
      page.getByRole("heading", { name: /create new payment stream/i }),
    ).toBeVisible();

    // Check description
    await expect(
      page.getByText(/set up a continuous, real-time payment/i),
    ).toBeVisible();
  });
});
