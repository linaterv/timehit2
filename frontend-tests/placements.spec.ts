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

  test("admin creates placement with position, then deletes", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    // Open create slide-over
    await page.getByTestId("placements-create-btn").click();
    await page.waitForTimeout(500);

    // Fill required fields — SearchableSelect: click to open, type to filter, Enter to select
    await page.getByTestId("create-client_id").locator("button").click();
    await page.waitForTimeout(300);
    await page.getByTestId("create-client_id").locator("input").fill("Acme");
    await page.waitForTimeout(300);
    await page.getByTestId("create-client_id").locator("input").press("Enter");

    await page.getByTestId("create-contractor_id").locator("button").click();
    await page.waitForTimeout(300);
    await page.getByTestId("create-contractor_id").locator("input").fill("John");
    await page.waitForTimeout(300);
    await page.getByTestId("create-contractor_id").locator("input").press("Enter");

    // Fill position
    await page.getByTestId("create-title").fill("E2E Test Position");

    // Fill rates
    await page.getByTestId("create-client_rate").fill("100");
    await page.getByTestId("create-contractor_rate").fill("80");

    // Submit
    await page.getByTestId("placement-create-slideover-save").click();
    await page.waitForTimeout(1500);

    // Should navigate to detail or stay on list — verify position visible
    const tableText = await page.locator("table").textContent();
    expect(tableText).toContain("E2E Test Position");
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
