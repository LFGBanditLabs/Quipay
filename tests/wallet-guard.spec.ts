import { test, expect } from "@playwright/test";

test.describe("WalletGuard", () => {
  test("visiting /create-stream unauthenticated redirects to /", async ({
    page,
  }) => {
    // Navigate to the protected route
    await page.goto("/create-stream");

    // Wait for the redirect to happen (it should be automatic)
    await page.waitForURL("/");

    // Verify that we are indeed on the home page
    const url = page.url();
    expect(url).toBe("http://localhost:5173/");

    // Optional: check for a specific element on the home page that confirms it's the home page
    // For example, the "Connect Wallet" button or a landing hero section.
    // Given the previous verification, we know the redirect works.
  });

  test("visiting /payroll unauthenticated redirects to /", async ({ page }) => {
    await page.goto("/payroll");
    await page.waitForURL("/");
    expect(page.url()).toBe("http://localhost:5173/");
  });

  test("visiting /treasury-management unauthenticated redirects to /", async ({
    page,
  }) => {
    await page.goto("/treasury-management");
    await page.waitForURL("/");
    expect(page.url()).toBe("http://localhost:5173/");
  });
});
