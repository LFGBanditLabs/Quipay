import { defineConfig } from "@playwright/test";

/**
 * Playwright config for on-chain E2E tests against Stellar testnet.
 * No browser / web-server required — tests interact solely with the
 * Soroban RPC node.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.test.ts",
  /* Long timeout: testnet ledger closes every ~5 s, each tx takes 5-15 s */
  timeout: 120_000,
  /* Run sequentially — tests share a deployed contract suite */
  workers: 1,
  retries: 0,
  reporter: [["list"], ["junit", { outputFile: "e2e-results.xml" }]],
});
