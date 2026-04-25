/**
 * E2E Tests — Landing Page
 *
 * Tests the public-facing landing page for structure,
 * navigation, responsiveness, and accessibility.
 */

import { test, expect } from "./fixtures/test-base";

test.describe("Landing Page", () => {
  /* ─── Structure ─── */

  test("renders without errors", async ({ unauthenticatedPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // No console errors that indicate a crash
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.waitForTimeout(2_000);
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });

  test("has correct document title", async ({ unauthenticatedPage: page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.toLowerCase()).toContain("quipay");
  });

  test("displays navigation bar", async ({ unauthenticatedPage: page }) => {
    await page.goto("/");
    const nav = page.locator("nav, header").first();
    await expect(nav).toBeVisible();
  });

  test("displays footer", async ({ unauthenticatedPage: page }) => {
    await page.goto("/");
    const footer = page.locator("footer").first();
    await expect(footer).toBeVisible();
  });

  test("contains a Connect Wallet call-to-action", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/");
    const connectCTA = page.getByRole("button", { name: /connect/i });
    await expect(connectCTA.first()).toBeVisible({ timeout: 10_000 });
  });

  /* ─── Navigation Links ─── */

  test("logo/brand links to home", async ({ unauthenticatedPage: page }) => {
    await page.goto("/help");
    // Click the brand / logo link
    const brand = page
      .locator('a[href="/"], [class*="brand"], [class*="logo"]')
      .first();
    if (await brand.isVisible()) {
      await brand.click();
      await expect(page).toHaveURL("/");
    }
  });

  test("help page is publicly accessible", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/help");
    await expect(page).toHaveURL(/\/help/);
    await expect(page.locator("main")).toBeVisible();
  });

  /* ─── Accessibility ─── */

  test("skip-to-content link is present", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/");
    // The App has a skip-to-content link as the first focusable element
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });

  test("main landmark has correct id for skip link", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/");
    const main = page.locator("main#main-content");
    await expect(main).toBeAttached();
  });

  /* ─── 404 Page ─── */

  test("non-existent route shows 404 page", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/this-page-does-not-exist-at-all");
    await page.waitForLoadState("domcontentloaded");

    // Should display some kind of "not found" content
    const notFoundText = page.getByText(/not found|404|page.*exist/i);
    await expect(notFoundText.first()).toBeVisible({ timeout: 10_000 });
  });
});
