import { test, expect } from "@playwright/test";
import { mockWallet } from "../helpers/wallet-mock";

test.describe("Worker Withdrawal", () => {
  test.beforeEach(async ({ page }) => {
    await mockWallet(page);
    await page.goto("/dashboard");
  });

  test("Successfully withdraws funds from the dashboard", async ({ page }) => {
    // Check for Withdraw button
    const withdrawBtn = page.getByRole("button", { name: /Withdraw/i }).first();
    await expect(withdrawBtn).toBeVisible();

    // In EmployerDashboard, WithdrawButton starts with "Withdraw X.XX USDC" or similar
    // We check for the text "Withdraw"
    await withdrawBtn.click();

    // After click, it should show "Confirm in wallet"
    await expect(page.getByText(/Confirm in wallet/i)).toBeVisible();

    // Since demoContract.withdraw() takes 2s, we wait for "Broadcasting..."
    await expect(page.getByText(/Broadcasting/i)).toBeVisible();

    // Finally "Withdrawn!"
    await expect(page.getByText(/Withdrawn!/i)).toBeVisible({ timeout: 10000 });

    // Take screenshot of success state
    await expect(page).toHaveScreenshot("withdrawal-success.png");

    // Wait for success message (toast or modal change)
    // Based on EmployerDashboard.tsx, it simulates 2s and returns hash
    // The WithdrawButton component usually handles the 'Success' state.
    // Let's check WithdrawButton.tsx
  });
});
