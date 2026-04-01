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

  test("admin generates invoice for Demo DevOps from dashboard, finds in invoices", async ({ page }) => {
    await loginAs.admin(page);
    await page.waitForTimeout(1500);

    // Ensure March 2026 is selected
    await page.getByTestId("control-month-filter").selectOption("2026-03");
    await page.waitForTimeout(1500);

    // Find Demo DevOps row and click Generate Invoice
    const row = page.locator("table tbody tr", { hasText: "Demo DevOps" });
    await expect(row).toBeVisible({ timeout: 5000 });
    const genBtn = row.getByRole("button", { name: "Generate Invoice" });
    await expect(genBtn).toBeVisible({ timeout: 3000 });
    await genBtn.click();
    await page.waitForTimeout(2000);

    // Button should disappear — invoice generated
    await expect(genBtn).not.toBeVisible({ timeout: 5000 });

    // Navigate to invoices page
    await page.getByTestId("nav-invoices").click();
    await page.waitForTimeout(1000);
    await expect(page.locator("table")).toBeVisible({ timeout: 5000 });

    // Find the DOP- invoice (Demo DevOps prefix)
    await expect(page.locator("table tbody tr", { hasText: "DOP-" }).first()).toBeVisible({ timeout: 5000 });

    // Also find the AGY- client invoice for Demo DevOps
    await expect(page.locator("table tbody tr", { hasText: "Demo DevOps" }).first()).toBeVisible({ timeout: 3000 });
  });

  test("contractor home shows content", async ({ page }) => {
    await loginAs.contractor1(page);
    await page.waitForTimeout(2000);
    // Contractor home shows timesheets or their content
    await expect(page.getByText(/timesheet|my timesheet|hours|placement/i).first()).toBeVisible({ timeout: 10000 });
  });
});
