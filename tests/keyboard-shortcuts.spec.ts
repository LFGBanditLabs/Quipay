import { test, expect } from "@playwright/test";

test.describe("Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Ctrl+N navigates to Create Stream", async ({ page }) => {
    await page.keyboard.press("Control+n");
    await page.waitForURL("**/create-stream");
    expect(page.url()).toContain("/create-stream");
  });

  test("Ctrl+D navigates to Dashboard", async ({ page }) => {
    // Navigate elsewhere first to ensure Ctrl+D triggers navigation
    await page.keyboard.press("Control+n");
    await page.waitForURL("**/create-stream");

    await page.keyboard.press("Control+d");
    await page.waitForURL("**/dashboard");
    expect(page.url()).toContain("/dashboard");
  });

  test("Ctrl+W navigates to Withdraw", async ({ page }) => {
    await page.keyboard.press("Control+w");
    await page.waitForURL("**/withdraw");
    expect(page.url()).toContain("/withdraw");
  });

  test("Ctrl+, navigates to Settings", async ({ page }) => {
    await page.keyboard.press("Control+,");
    await page.waitForURL("**/settings");
    expect(page.url()).toContain("/settings");
  });

  test("Ctrl+/ toggles Keyboard Shortcuts Help Modal", async ({ page }) => {
    await page.keyboard.press("Control+/");
    const modalTitle = page.getByText("Keyboard Shortcuts", { exact: false });
    await expect(modalTitle).toBeVisible();

    // Press Esc to close
    await page.keyboard.press("Escape");
    await expect(modalTitle).not.toBeVisible();
  });

  test("shortcuts are ignored when typing in input fields", async ({
    page,
  }) => {
    await page.goto("/ui-primitives"); // Use a page with inputs

    const input = page.getByLabel("Work email");
    await input.focus();

    await page.keyboard.press("Control+n");

    // Should NOT navigate
    expect(page.url()).toContain("/ui-primitives");

    // Should have typed 'n' if it was a plain key, but Ctrl+N might be a system shortcut or just ignored.
    // The point is URL hasn't changed.
  });
});
