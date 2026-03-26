/**
 * Test Utilities for Playwright E2E Tests
 */

import { Page } from "@playwright/test";

/**
 * Fill the stream creation form
 */
export async function fillStreamForm(
  page: Page,
  data: {
    workerName: string;
    workerAddress: string;
    amount: string;
    token?: string;
    startDate: string;
    endDate: string;
  },
) {
  // Step 1: Recipient
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

/**
 * Wait for navigation with timeout
 */
export async function waitForNavigation(
  page: Page,
  url: string,
  timeout = 5000,
) {
  await page.waitForURL(url, { timeout });
}

/**
 * Check if element is visible
 */
export async function isVisible(
  page: Page,
  selector: string,
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 1000 });
    return await page.isVisible(selector);
  } catch {
    return false;
  }
}

/**
 * Get validation error message
 */
export async function getValidationError(page: Page): Promise<string | null> {
  const errorSelector = '[role="alert"], .error-message, [data-testid="error"]';
  if (await isVisible(page, errorSelector)) {
    return await page.textContent(errorSelector);
  }
  return null;
}

/**
 * Wait for alert dialog
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
