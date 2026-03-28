/**
 * Custom Playwright Fixture
 *
 * Provides an `authenticatedPage` fixture that automatically sets up the mock
 * wallet before each test, and a `mockWallet` fixture for granular control.
 *
 * Usage:
 *   import { test, expect } from "../fixtures/test-base";
 *   test("my test", async ({ authenticatedPage, mockWallet }) => { ... });
 */

/* eslint-disable react-hooks/rules-of-hooks */

import { test as base, Page } from "@playwright/test";
import { MockWallet, MockWalletOptions, TEST_PUBLIC_KEY } from "./wallet";

interface TestFixtures {
  /** A Page with the mock wallet already injected and connected. */
  authenticatedPage: Page;
  /** The MockWallet instance for the current test (auto-connected). */
  mockWallet: MockWallet;
  /** A Page with NO wallet connected (for unauthenticated flow tests). */
  unauthenticatedPage: Page;
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const wallet = new MockWallet(page, {
      publicKey: TEST_PUBLIC_KEY,
      isConnected: true,
    });
    await wallet.setup();
    await wallet.mockContractAPI();
    await use(page);
  },

  mockWallet: async ({ page }, use) => {
    const wallet = new MockWallet(page, {
      publicKey: TEST_PUBLIC_KEY,
      isConnected: true,
    });
    await wallet.setup();
    await wallet.mockContractAPI();
    await use(wallet);
  },

  unauthenticatedPage: async ({ page }, use) => {
    const wallet = new MockWallet(page, { isConnected: false });
    await wallet.setup();
    await use(page);
  },
});

export { expect } from "@playwright/test";
export type { MockWalletOptions };
