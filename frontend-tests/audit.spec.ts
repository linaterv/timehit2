import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Audit", () => {
  test("admin sees audit page", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/audit");
    await expect(page.getByTestId("audit-page")).toBeVisible({ timeout: 10000 });
  });

  test("audit page shows log entries", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/audit");
    await page.waitForTimeout(2000);
    // Should show audit entries from seed data operations
    const rows = page.locator("[data-testid='audit-page'] table tbody tr, [data-testid='audit-page'] [class*='row'], [data-testid='audit-page'] [class*='entry']");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("contractor cannot access audit page", async ({ page }) => {
    await loginAs.contractor1(page);
    await page.goto("/audit");
    await page.waitForTimeout(2000);
    await expect(page.getByText(/admin access required|denied|forbidden/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("broker cannot access audit page", async ({ page }) => {
    await loginAs.broker1(page);
    await page.goto("/audit");
    await page.waitForTimeout(2000);
    await expect(page.getByText(/admin access required|denied|forbidden/i).first()).toBeVisible({ timeout: 5000 });
  });
});
