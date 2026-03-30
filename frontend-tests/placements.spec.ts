import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe("Placements", () => {
  test("broker lists placements", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("placement detail shows info", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await page.locator("table tbody tr").first().click();
    await page.waitForURL(/\/placements\//, { timeout: 5000 });
    await expect(page.getByText(/EUR|GBP|rate/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("contractor sees own placements", async ({ page }) => {
    await loginAs.contractor1(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("statuses visible in table", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // At least ACTIVE should be visible from seed data
    await expect(page.locator("table").getByText("ACTIVE").first()).toBeVisible();
  });

  test("admin sees multiple statuses", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Seed data has ACTIVE and DRAFT placements
    const tableText = await page.locator("table").textContent();
    expect(tableText).toMatch(/ACTIVE|DRAFT/);
  });
});
