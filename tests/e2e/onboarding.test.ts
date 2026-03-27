import { test, expect } from "@playwright/test";
import { mockWallet } from "../helpers/wallet-mock";

test.describe("Employer Onboarding", () => {
    test("Successfully lands on home page and launches app", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/Quipay/);
        await expect(page.getByText(/Automated Payroll/i)).toBeVisible();

        // Take screenshot for visual regression on landing page
        await expect(page).toHaveScreenshot("landing-page.png");

        // Click Launch App
        await page.getByRole("link", { name: /Launch App/i }).click();

        // Check we're on the dashboard (initially asks for wallet)
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test("Connects wallet and sees the dashboard", async ({ page }) => {
        // Setup mock wallet state
        const mockAddr = "GB32J7Z46N43O365H7PQLO7E2Z5S6S6S6S6S6S6S6S6S6S6S6S6S6";
        await mockWallet(page, mockAddr);

        await page.goto("/dashboard");

        // Check if the dashboard is visible
        await expect(page.getByText(/Employer Dashboard/i)).toBeVisible();

        // Address may be truncated or full, we check for the first few chars
        const shortAddr = mockAddr.slice(0, 4);
        await expect(page.getByText(new RegExp(shortAddr, 'i')).first()).toBeVisible();

        // Check treasury balance exists
        await expect(page.getByText(/Treasury Balance/i)).toBeVisible();

        // Take a screenshot of the dashboard
        await expect(page).toHaveScreenshot("employer-dashboard.png");
    });
});
