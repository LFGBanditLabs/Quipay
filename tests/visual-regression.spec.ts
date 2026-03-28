/**
 * Visual Regression Tests — Landing Page & Dashboards
 *
 * Issue #585 – Captures baseline screenshots for critical pages and compares
 * future renders against them. Visual diffs are flagged automatically in PRs.
 *
 * First run generates baseline images into tests/visual-regression.spec.ts-snapshots/.
 * Subsequent runs compare against those baselines.
 *
 * To update baselines:  npx playwright test --update-snapshots
 */

import { test, expect } from "./fixtures/test-base";
import { disableAnimations, waitForPageIdle } from "./helpers/test-utils";
// import { MockWallet, TEST_PUBLIC_KEY } from "./fixtures/wallet";

/* ─── Helper: prepare page for deterministic screenshots ─── */

async function prepareForScreenshot(page: import("@playwright/test").Page) {
  await disableAnimations(page);
  await waitForPageIdle(page).catch(() => {});
  // Small extra delay for any CSS transitions that slipped through
  await page.waitForTimeout(500);
}

/* ============================================================
 *  LANDING PAGE — Visual Regression
 * ============================================================ */

test.describe("Visual Regression — Landing Page", () => {
  test("landing page full viewport", async ({ unauthenticatedPage: page }) => {
    await page.goto("/");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("landing-page-full.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("landing page full scroll", async ({ unauthenticatedPage: page }) => {
    await page.goto("/");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("landing-page-scroll.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("landing page navbar", async ({ unauthenticatedPage: page }) => {
    await page.goto("/");
    await prepareForScreenshot(page);

    const navbar = page.locator("nav, header").first();
    await expect(navbar).toHaveScreenshot("landing-navbar.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("landing page footer", async ({ unauthenticatedPage: page }) => {
    await page.goto("/");
    await prepareForScreenshot(page);

    const footer = page.locator("footer").first();
    if (await footer.isVisible()) {
      await expect(footer).toHaveScreenshot("landing-footer.png", {
        maxDiffPixelRatio: 0.02,
      });
    }
  });
});

/* ============================================================
 *  EMPLOYER DASHBOARD — Visual Regression
 * ============================================================ */

test.describe("Visual Regression — Employer Dashboard", () => {
  test("dashboard full viewport (authenticated)", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("employer-dashboard-full.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("dashboard full scroll", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("employer-dashboard-scroll.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

/* ============================================================
 *  CREATE STREAM PAGE — Visual Regression
 * ============================================================ */

test.describe("Visual Regression — Create Stream Wizard", () => {
  test("step 1: recipient form", async ({ authenticatedPage: page }) => {
    await page.goto("/create-stream");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("create-stream-step1.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("step 2: payment form", async ({ authenticatedPage: page }) => {
    await page.goto("/create-stream");
    await page.waitForSelector('input[placeholder="e.g. John Doe"]', {
      timeout: 15_000,
    });
    await page.fill('input[placeholder="e.g. John Doe"]', "Visual Test");
    await page.fill(
      'input[placeholder="G..."]',
      "GWORKER123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    await page.click('button:has-text("Next")');
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("create-stream-step2.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});

/* ============================================================
 *  WITHDRAW PAGE — Visual Regression
 * ============================================================ */

test.describe("Visual Regression — Withdraw Page", () => {
  test("withdraw page viewport", async ({ authenticatedPage: page }) => {
    await page.goto("/withdraw");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("withdraw-page-full.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});

/* ============================================================
 *  PAYROLL DASHBOARD — Visual Regression
 * ============================================================ */

test.describe("Visual Regression — Payroll Dashboard", () => {
  test("payroll page viewport", async ({ authenticatedPage: page }) => {
    await page.goto("/payroll");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("payroll-dashboard-full.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});

/* ============================================================
 *  SETTINGS PAGE — Visual Regression
 * ============================================================ */

test.describe("Visual Regression — Settings", () => {
  test("settings page viewport", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("settings-page-full.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});

/* ============================================================
 *  HELP PAGE (PUBLIC) — Visual Regression
 * ============================================================ */

test.describe("Visual Regression — Help Page", () => {
  test("help page viewport", async ({ unauthenticatedPage: page }) => {
    await page.goto("/help");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("help-page-full.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});

/* ============================================================
 *  404 NOT FOUND — Visual Regression
 * ============================================================ */

test.describe("Visual Regression — 404 Page", () => {
  test("404 page renders correctly", async ({ unauthenticatedPage: page }) => {
    await page.goto("/this-page-does-not-exist");
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot("404-page.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});
