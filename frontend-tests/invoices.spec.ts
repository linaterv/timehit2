import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe("Invoices", () => {
  test("broker sees invoices", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/invoices");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table").getByText("AGY-").first()).toBeVisible({ timeout: 5000 });
  });

  test("seeded invoice statuses visible", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/invoices");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const tableText = await page.locator("table").textContent();
    expect(tableText).toMatch(/ISSUED|DRAFT/);
  });

  test("invoice detail shows amounts", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/invoices");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await page.locator("table tbody tr").first().click();
    await page.waitForURL(/\/invoices\//, { timeout: 5000 });
    await expect(page.getByText(/EUR|GBP|total|amount/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("contractor sees own invoices", async ({ page }) => {
    await loginAs.contractor1(page);
    await navigateTo(page, "/invoices");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
  });

  test("admin sees all invoices", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/invoices");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThanOrEqual(1);
  });
});
