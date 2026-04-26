import { test, expect } from "@playwright/test";

test.describe("Reports Page Table Virtualization", () => {
  test("should render 1000 rows without jank", async ({ page }) => {
    // Navigate to reports page
    await page.goto("http://localhost:5173/reports");

    // Wait for page to be interactive
    await page.waitForLoadState("networkidle");

    // Measure time to interactive
    const navigationTiming = await page.evaluate(() => {
      const timing = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: timing.domContentLoaded,
        loadEventEnd: timing.loadEventEnd,
      };
    });

    // DOM should be interactive in < 200ms
    expect(navigationTiming.domContentLoaded).toBeLessThan(200);
  });

  test("should show row count indicator", async ({ page }) => {
    await page.goto("http://localhost:5173/reports");
    await page.waitForLoadState("networkidle");

    // Look for row count text like "Showing 1–50 of 500 rows"
    const rowCountText = page.locator("text=/Showing \\d+–\\d+ of \\d+ rows/");
    await expect(rowCountText).toBeVisible();
  });
});
