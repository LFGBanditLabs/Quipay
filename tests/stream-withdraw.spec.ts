import { test, expect } from "./fixtures/test-base";

test.describe("Stream Withdrawal Happy Path", () => {
  test("should withdraw from an active stream successfully", async ({ authenticatedPage: page }) => {
    await page.goto("/withdraw");

    // Wait for streams to load (authenticatedPage already mocks contract API with default streams)
    await expect(page.getByText(/Stream #1001/i).first()).toBeVisible({ timeout: 15000 });

    // Click withdraw on the first stream
    await page.click('button:has-text("Withdraw")');

    // Transaction Simulation Modal should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByText(/Transaction Simulation/i)).toBeVisible();

    // Confirm withdrawal
    const confirmButton = page.getByRole("button", { name: /confirm withdrawal/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Success toast/message should appear
    await expect(page.getByText(/withdrawal successful/i)).toBeVisible();

    // Modal should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
