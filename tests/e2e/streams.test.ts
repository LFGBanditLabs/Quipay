import { test, expect } from "@playwright/test";
import { mockWallet } from "../helpers/wallet-mock";

test.describe("Stream Creation", () => {
    test.beforeEach(async ({ page }) => {
        await mockWallet(page);
        await page.goto("/dashboard");
    });

    test("Successfully creates a new payment stream", async ({ page }) => {
        // Click Create New Stream
        await page.getByRole("button", { name: /Create New Stream/i }).click();

        // Check we're on the create stream page
        await expect(page).toHaveURL(/\/create-stream/);

        // Step 1: Recipient
        await page.getByPlaceholder("e.g. John Doe").fill("John Doe");
        await page.getByPlaceholder("G...").fill("GB32J7Z46N43O365H7PQLO7E2Z5S6S6S6S6S6S6S6S6S6S6S6S6");
        await page.getByRole("button", { name: /Next/i }).click();

        // Step 2: Payment
        await page.getByPlaceholder("0.00").fill("1000");
        await page.getByRole("button", { name: /Next/i }).click();

        // Step 3: Schedule
        // Fill dates (today and a month from now)
        const today = new Date().toISOString().split('T')[0];
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextMonthStr = nextMonth.toISOString().split('T')[0];

        await page.locator('input[type="date"]').first().fill(today);
        await page.locator('input[type="date"]').last().fill(nextMonthStr);
        await page.getByRole("button", { name: /Next/i }).click();

        // Step 4: Review
        await expect(page.getByText(/John Doe/i)).toBeVisible();
        await page.getByRole("button", { name: /Complete/i }).click();

        // Wait for alert and redirect
        page.on('dialog', dialog => dialog.accept());

        // Wait for success / redirect
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByText(/John Doe/i)).toBeVisible();

        // Take a screenshot after stream creation
        await expect(page).toHaveScreenshot("stream-created.png");
    });
});
