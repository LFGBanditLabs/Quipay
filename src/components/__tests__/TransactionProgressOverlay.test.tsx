import { test, expect } from "@playwright/test";

test.describe("TransactionProgressOverlay", () => {
  test("should display overlay when visible", async ({ page }) => {
    // Navigate to a page that uses the overlay
    await page.goto("http://localhost:5173");

    // Trigger a transaction that shows the overlay
    // This assumes a test action that initiates a transaction
    await page.click('button:has-text("Disburse Payroll")');

    // Verify overlay appears
    const overlay = page.locator(
      'div:has-text("Processing Transaction")'
    );
    await expect(overlay).toBeVisible();

    // Verify stages are displayed
    await expect(page.locator("text=Building")).toBeVisible();
    await expect(page.locator("text=Signing")).toBeVisible();
    await expect(page.locator("text=Submitting")).toBeVisible();
    await expect(page.locator("text=Confirmed")).toBeVisible();
  });

  test("should progress through stages", async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.click('button:has-text("Disburse Payroll")');

    const overlay = page.locator(
      'div:has-text("Processing Transaction")'
    );
    await expect(overlay).toBeVisible();

    // Verify initial stage indicator (should show pulse animation)
    const buildingStep = page.locator("text=Building").first();
    const buildingIndicator = buildingStep.locator("xpath=preceding-sibling::div[1]");
    await expect(buildingIndicator).toHaveClass(/animate-pulse/);
  });

  test("should auto-dismiss after confirmation", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Initiate transaction
    await page.click('button:has-text("Disburse Payroll")');

    // Wait for transaction to complete and auto-dismiss
    const overlay = page.locator(
      'div:has-text("Processing Transaction")'
    );
    await expect(overlay).toBeVisible();

    // Wait for confirmation stage
    await page.waitForSelector('text=Confirmed');

    // Overlay should auto-dismiss after 3 seconds
    await page.waitForTimeout(3500);
    await expect(overlay).not.toBeVisible();
  });

  test("should respect prefers-reduced-motion", async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("http://localhost:5173");
    await page.click('button:has-text("Disburse Payroll")');

    // Verify no pulse animation is applied
    const buildingStep = page.locator("text=Building").first();
    const buildingIndicator = buildingStep.locator("xpath=preceding-sibling::div[1]");
    await expect(buildingIndicator).not.toHaveClass(/animate-pulse/);
  });

  test("should allow manual dismiss after confirmation", async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.click('button:has-text("Disburse Payroll")');

    // Wait for confirmation
    await page.waitForSelector('text=Confirmed');
    await page.waitForSelector('button:has-text("Done")');

    // Click done button
    await page.click('button:has-text("Done")');

    // Overlay should disappear
    const overlay = page.locator(
      'div:has-text("Processing Transaction")'
    );
    await expect(overlay).not.toBeVisible();
  });
});
