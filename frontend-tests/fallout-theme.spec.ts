import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const SCREENSHOTS_DIR = "/home/timehit/a/timehit2/screenshots";

test("fallout theme screenshot", async ({ page }) => {
  await login(page, "admin@timehit.com");
  await page.evaluate(() => {
    sessionStorage.setItem("control-year", "2026");
    sessionStorage.setItem("control-month", "3");
  });
  await page.goto("http://localhost:3000/");
  await expect(page.getByText("Control Screen")).toBeVisible({ timeout: 10000 });
  // Wait for auth-context to finish applying theme, then override
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "fallout";
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/fallout-dashboard.png`, fullPage: true });
});
