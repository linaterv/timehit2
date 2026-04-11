import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const SCREENSHOTS_DIR = "/home/timehit/a/timehit2/screenshots";

test("click Awaiting Approval card filters to pending_approval", async ({ page }) => {
  await login(page, "admin@timehit.com");
  await page.evaluate(() => {
    sessionStorage.setItem("control-year", "2026");
    sessionStorage.setItem("control-month", "3");
  });
  await page.goto("http://localhost:3000/");
  await expect(page.getByText("Control Screen")).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/flags-01-before.png`, fullPage: true });

  // Click the Awaiting Approval card
  await page.getByTestId("summary-awaiting").click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/flags-02-awaiting-clicked.png`, fullPage: true });

  // Click the flags dropdown to show it's selected
  await page.getByTestId("filter-flags").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/flags-03-dropdown-open.png`, fullPage: true });
});
