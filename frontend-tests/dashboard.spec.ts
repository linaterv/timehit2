import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Dashboard", () => {
  test("admin sees dashboard content", async ({ page }) => {
    await loginAs.admin(page);
    await page.waitForTimeout(2000);
    // Dashboard should have some content — control screen or summary
    await expect(page.getByText(/control|screen|awaiting|approval|placement|invoice/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("dashboard has month selector", async ({ page }) => {
    await loginAs.admin(page);
    await page.waitForTimeout(2000);
    // Look for month name text
    await expect(page.getByText(/January|February|March|April|May|June|July|August|September|October|November|December/).first()).toBeVisible({ timeout: 10000 });
  });

  test("broker sees dashboard", async ({ page }) => {
    await loginAs.broker1(page);
    await page.waitForTimeout(2000);
    await expect(page.getByText(/control|screen|awaiting|approval|placement|invoice/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("contractor home shows content", async ({ page }) => {
    await loginAs.contractor1(page);
    await page.waitForTimeout(2000);
    // Contractor home shows timesheets or their content
    await expect(page.getByText(/timesheet|my timesheet|hours|placement/i).first()).toBeVisible({ timeout: 10000 });
  });
});
