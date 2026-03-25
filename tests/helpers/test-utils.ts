/**
 * Common test utilities and helpers
 */

import { Page } from "@playwright/test";

/**
 * Generates a valid Stellar public key for testing
 */
export function generateMockStellarAddress(prefix: string = "TEST"): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let address = "G";

  // Generate 55 random characters
  for (let i = 0; i < 55; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return address;
}

/**
 * Fills the stream creation form with valid data
 */
export async function fillStreamForm(
  page: Page,
  options: {
    workerAddress?: string;
    rate?: string;
    startDate?: string;
    endDate?: string;
    token?: string;
  } = {},
) {
  const {
    workerAddress = generateMockStellarAddress("WORKER"),
    rate = "0.0001",
    startDate = new Date().toISOString().split("T")[0],
    endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    token = "native",
  } = options;

  // Fill worker address
  await page.getByLabel(/worker.*address/i).fill(workerAddress);

  // Fill rate
  await page.getByLabel(/flow rate/i).fill(rate);

  // Fill dates
  await page.getByLabel(/start date/i).fill(startDate);
  await page.getByLabel(/end date/i).fill(endDate);

  // Select token if needed
  if (token !== "native") {
    const tokenSelect = page.locator('select[name="token"]');
    if (await tokenSelect.isVisible()) {
      await tokenSelect.selectOption(token);
    }
  }
}

/**
 * Waits for a transaction to complete (success or error)
 */
export async function waitForTransactionComplete(
  page: Page,
  timeout: number = 15000,
) {
  await page.waitForSelector(
    "text=/stream created successfully|transaction failed|error/i",
    { timeout },
  );
}

/**
 * Gets the current date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Gets a future date in YYYY-MM-DD format
 */
export function getFutureDateString(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}

/**
 * Gets a past date in YYYY-MM-DD format
 */
export function getPastDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

/**
 * Calculates expected stream total
 */
export function calculateStreamTotal(
  ratePerSecond: number,
  startDate: string,
  endDate: string,
): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const durationSeconds = (end - start) / 1000;
  return ratePerSecond * durationSeconds;
}

/**
 * Formats a number for display in tests
 */
export function formatTokenAmount(
  amount: number,
  decimals: number = 4,
): string {
  return amount.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

/**
 * Waits for an element to be visible with custom timeout
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 5000,
) {
  await page.waitForSelector(selector, { state: "visible", timeout });
}

/**
 * Checks if an element exists without throwing
 */
export async function elementExists(
  page: Page,
  selector: string,
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Takes a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  fullPage: boolean = false,
) {
  await page.screenshot({
    path: `playwright-report/screenshots/${name}-${Date.now()}.png`,
    fullPage,
  });
}

/**
 * Mocks a successful contract response
 */
export function mockSuccessResponse(data: any) {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      transactionData: "",
      minResourceFee: "100",
      cost: { cpuInsns: "0", memBytes: "0" },
      latestLedger: 1000,
      results: [
        {
          auth: [],
          xdr: btoa(JSON.stringify(data)),
        },
      ],
    },
  };
}

/**
 * Mocks a contract error response
 */
export function mockErrorResponse(errorCode: number, message: string) {
  return {
    jsonrpc: "2.0",
    id: 1,
    error: {
      code: errorCode,
      message,
      data: {
        extras: {
          result_xdr: "",
        },
      },
    },
  };
}
