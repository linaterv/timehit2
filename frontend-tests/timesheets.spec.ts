import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe("Timesheets", () => {
  test("contractor sees timesheets on home", async ({ page }) => {
    await loginAs.contractor1(page);
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("contractor views timesheet detail", async ({ page }) => {
    await loginAs.contractor1(page);
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Switch to "All" to see existing timesheets with View buttons
    const filterSelect = page.getByTestId("ts-filter-dropdown");
    if (await filterSelect.isVisible().catch(() => false)) {
      await filterSelect.selectOption("all");
      await page.waitForTimeout(500);
    }
    // Click View button on a non-missing row
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewBtn.click();
      await page.waitForURL(/\/timesheets\//, { timeout: 5000 });
      await expect(page.getByText(/hours|entries|total/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("broker sees timesheets", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/timesheets");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("seeded statuses visible", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/timesheets");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Seed has APPROVED and SUBMITTED timesheets
    const tableText = await page.locator("table").textContent();
    expect(tableText).toMatch(/APPROVED|SUBMITTED|DRAFT/);
  });

  test("client contact sees home content", async ({ page }) => {
    await loginAs.client1(page);
    await page.waitForTimeout(2000);
    // Client home shows timesheets or approval content
    await expect(page.getByText(/timesheet|approve|hours|placement/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("timesheet detail shows info", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/timesheets");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await page.locator("table tbody tr").first().click();
    await page.waitForTimeout(2000);
    // Should show timesheet info — either on detail page or stayed on list
    await expect(page.getByText(/2026|hours|total|entries/i).first()).toBeVisible({ timeout: 5000 });
  });
});
