import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E + Visual Regression Configuration
 *
 * https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests",

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Limit parallelism on CI to reduce flakiness */
  workers: process.env.CI ? 2 : undefined,

  /* Reporter: HTML locally, multi-reporter on CI */
  reporter: process.env.CI
    ? [
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["github"],
        ["json", { outputFile: "test-results/results.json" }],
      ]
    : [["html", { open: "on-failure" }]],

  /* Global timeout per test */
  timeout: 60_000,

  /* Shared settings for all projects. */
  use: {
    baseURL: "http://localhost:5173",

    /* Collect trace on first retry for debugging */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on first retry for CI debugging */
    video: process.env.CI ? "on-first-retry" : "off",

    /* Consistent viewport for visual regression */
    viewport: { width: 1280, height: 720 },

    /* Reduce animation-driven flakiness */
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  /* Expect configuration for visual regression */
  expect: {
    toHaveScreenshot: {
      /* Allow small pixel differences (anti-aliasing, subpixel rendering) */
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: "disabled",
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.01,
    },
  },

  /* Configure projects for major browsers */
  projects: [
    /* ─── Desktop browsers ─── */
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    /* ─── Mobile viewports ─── */
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],

  /* Run local dev server before starting tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
