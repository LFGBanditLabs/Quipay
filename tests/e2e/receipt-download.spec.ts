import { test, expect, type Route } from "@playwright/test";

test("download paycheck PDF", async ({ page }) => {
  // Provide a mock connected wallet via localStorage so WalletGuard permits access
  await page.addInitScript(() => {
    try {
      localStorage.setItem("walletId", JSON.stringify("mock"));
      localStorage.setItem(
        "walletAddress",
        JSON.stringify(
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ),
      );
      localStorage.setItem("walletNetwork", JSON.stringify("testnet"));
      localStorage.setItem(
        "networkPassphrase",
        JSON.stringify("Test SDF Network ; September 2015"),
      );
    } catch {
      /* ignore in non-browser contexts */
    }
  });

  // Intercept backend analytics call and return deterministic demo streams
  const fulfillDemo = async (route: Route) => {
    const now = Math.floor(Date.now() / 1000);
    const demo = [
      {
        stream_id: 1,
        employer: "GEMPLOYEREXAMPLEADDRESS000000000000000000000",
        worker: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        total_amount: String(3500 * 1e7),
        start_ts: now - 86400 * 30,
        end_ts: now - 86400 * 1,
        status: "completed",
        ledger_created: 1234567890,
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: demo }),
    });
  };

  await page.route("**/analytics/streams*", fulfillDemo);
  await page.route("http://localhost:3001/**", fulfillDemo);

  // Navigate to a test-only page that triggers a paycheck PDF download
  await page.goto("/__test/receipt");

  // Click the page button to trigger a controlled download and wait for it
  const btn = page.locator('button:has-text("Download Test Paycheck")').first();
  await expect(btn).toBeVisible({ timeout: 10_000 });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    btn.click(),
  ]);

  const suggested = download.suggestedFilename();
  expect(suggested).toContain("quipay-paycheck-");

  // Save to a temp path and assert non-empty
  const tmpPath = `/tmp/${suggested}`;
  await download.saveAs(tmpPath);
  const fs = await import("fs");
  const stats = fs.statSync(tmpPath);
  expect(stats.size).toBeGreaterThan(1024);
});
