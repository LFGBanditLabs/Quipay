import { test, expect } from "@playwright/test";
import { mockWallet } from "../helpers/wallet-mock";

test.describe("Visual Regression", () => {
    test("Home Page layout", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveScreenshot("home-page.png");
    });

    test("Employer Dashboard Layout (Connected)", async ({ page }) => {
        await mockWallet(page);
        await page.goto("/dashboard");
        // Wait for the employer name / dashboard text
        await expect(page.getByText(/Employer Dashboard/i)).toBeVisible();
        await expect(page).toHaveScreenshot("dashboard-connected.png");
    });

    test("Worker Dashboard Layout (Connected)", async ({ page }) => {
        await mockWallet(page);
        await page.goto("/withdraw");
        // Wait for the Worker Dashboard Title
        await expect(page.getByText(/Worker Dashboard/i)).toBeVisible();
        await expect(page).toHaveScreenshot("worker-dashboard.png");
    });
});
