/**
 * Shared Test Utilities for Playwright E2E Tests
 *
 * Reusable helpers for form filling, navigation,
 * visual regression, and assertion shortcuts.
 */

import { Page, expect } from "@playwright/test";

/* ─── Stream Creation Form ─── */

export interface StreamFormData {
  workerName: string;
  workerAddress: string;
  amount: string;
  token?: string;
  startDate: string;
  endDate: string;
}

/**
 * Fill the complete multi-step stream creation wizard.
 */
export async function fillStreamForm(
  page: Page,
  data: StreamFormData,
): Promise<void> {
  // Step 1: Recipient
  await page.waitForURL("**/create-stream", { timeout: 15_000 });
  await page.waitForSelector('input[placeholder="e.g. John Doe"]', {
    timeout: 15_000,
  });
  await page.fill('input[placeholder="e.g. John Doe"]', data.workerName);
  await page.fill('input[placeholder="G..."]', data.workerAddress);
  await page.click('button:has-text("Next")');

  // Step 2: Payment
  await page.fill('input[placeholder="0.00"]', data.amount);
  if (data.token) {
    await page.selectOption("select", data.token);
  }
  await page.click('button:has-text("Next")');

  // Step 3: Schedule
  await page.fill('input[type="date"]', data.startDate);
  const dateInputs = await page.locator('input[type="date"]').all();
  await dateInputs[1].fill(data.endDate);
  await page.click('button:has-text("Next")');
}

/* ─── Navigation ─── */

/**
 * Navigate and wait for the URL to settle.
 */
export async function navigateTo(
  page: Page,
  path: string,
  timeout = 15_000,
): Promise<void> {
  await page.goto(path);
  await page.waitForURL(`**${path}`, { timeout });
}

/**
 * Wait for navigation with timeout.
 */
export async function waitForNavigation(
  page: Page,
  url: string,
  timeout = 5_000,
): Promise<void> {
  await page.waitForURL(url, { timeout });
}

/* ─── Element Helpers ─── */

/**
 * Check if element is visible with a short timeout.
 */
export async function isVisible(
  page: Page,
  selector: string,
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 2_000 });
    return await page.isVisible(selector);
  } catch {
    return false;
  }
}

/**
 * Get validation error message from common error selectors.
 */
export async function getValidationError(page: Page): Promise<string | null> {
  const errorSelector = '[role="alert"], .error-message, [data-testid="error"]';
  if (await isVisible(page, errorSelector)) {
    return await page.textContent(errorSelector);
  }
  return null;
}

/**
 * Wait for an alert dialog, accept it, and return the message.
 */
export async function waitForAlert(page: Page): Promise<string> {
  return new Promise((resolve) => {
    page.once("dialog", async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      resolve(message);
    });
  });
}

/* ─── Loading / Idle Helpers ─── */

/**
 * Wait until the page has no pending network requests and no loading spinners.
 */
export async function waitForPageIdle(
  page: Page,
  timeout = 10_000,
): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout });
  // Also wait for any spinner elements to disappear
  const spinners = page.locator(
    ".animate-spin, [aria-label*='loading'], [data-testid='loading']",
  );
  if ((await spinners.count()) > 0) {
    await spinners.first().waitFor({ state: "hidden", timeout: 10_000 });
  }
}

/**
 * Disable CSS transitions/animations for deterministic visual snapshots.
 */
export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

/* ─── Protected Route Helpers ─── */

/** All routes that require a connected wallet. */
export const PROTECTED_ROUTES = [
  "/dashboard",
  "/payroll",
  "/withdraw",
  "/treasury-management",
  "/create-stream",
  "/governance",
  "/reports",
  "/analytics",
  "/settings",
  "/dashboard-customization",
  "/templates",
  "/stream-comparison",
  "/worker",
  "/workforce",
  "/address-book",
] as const;

/** Routes that are publicly accessible without a wallet. */
export const PUBLIC_ROUTES = ["/", "/help", "/ui-primitives"] as const;

/* ─── Assertion Shortcuts ─── */

/**
 * Assert that the page contains a visible heading matching the given text.
 */
export async function expectHeading(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  const heading = page.getByRole("heading", { name: text });
  await expect(heading).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert that the page URL contains the given path fragment.
 */
export function expectURLContains(page: Page, fragment: string): void {
  expect(page.url()).toContain(fragment);
}
