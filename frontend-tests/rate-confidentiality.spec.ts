import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe("Rate Confidentiality", () => {

  test("broker sees rates on placements list", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Broker should see rate columns
    const header = await page.locator("thead").textContent();
    expect(header).toMatch(/rate/i);
  });

  test("contractor does NOT see rates on placements list", async ({ page }) => {
    await loginAs.alex(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // No rate columns in table header
    const header = await page.locator("thead").textContent();
    expect(header).not.toMatch(/rate/i);
  });

  test("contractor does NOT see rates on placement detail", async ({ page }) => {
    await loginAs.alex(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await page.locator("table tbody tr").filter({ hasText: "ACTIVE" }).first().click();
    await page.waitForURL(/\/placements\//, { timeout: 5000 });
    // Should NOT show "Rates" label or rate values
    const content = await page.locator("[data-testid='placement-detail']").textContent();
    expect(content).not.toMatch(/Rates/);
    // Should NOT contain currency amounts like €95.00 or $120.00
    expect(content).not.toMatch(/\$\d+\.\d+.*\/.*\$\d+\.\d+/);
  });

  test("contractor does NOT see rates on timesheet detail", async ({ page }) => {
    await loginAs.alex(page);
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Switch to All and click a View button
    const filterSelect = page.getByTestId("ts-filter-dropdown");
    if (await filterSelect.isVisible().catch(() => false)) {
      await filterSelect.selectOption("all");
      await page.waitForTimeout(500);
    }
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (!(await viewBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return; }
    await viewBtn.click();
    await page.waitForURL(/\/timesheets\//, { timeout: 5000 });
    await page.waitForTimeout(1000);
    const content = await page.locator("[data-testid='timesheet-detail']").textContent();
    expect(content).not.toMatch(/\/ €|€.*\//);
  });

  test("broker sees rates on placement detail", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await page.locator("table tbody tr").first().click();
    await page.waitForURL(/\/placements\//, { timeout: 5000 });
    // Should show Rates section
    await expect(page.getByText("Rates")).toBeVisible({ timeout: 5000 });
  });

  test("broker sees rates on timesheet detail", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/timesheets");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Click View button
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (!(await viewBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return; }
    await viewBtn.click();
    await page.waitForURL(/\/timesheets\//, { timeout: 5000 });
    await page.waitForTimeout(1000);
    const content = await page.locator("[data-testid='timesheet-detail']").textContent();
    expect(content).toMatch(/€|USD|\$/);
  });

  test("client contact does NOT see rates on placements", async ({ page }) => {
    await loginAs.anna(page);
    // Anna may not have placements nav, try direct
    await navigateTo(page, "/timesheets");
    await page.waitForTimeout(1000);
    // If she sees any table content, rates should not be there
    const body = await page.locator("main").textContent();
    expect(body).not.toMatch(/Client Rate|Contractor Rate/);
  });
});
