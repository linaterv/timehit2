import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const SCREENSHOTS_DIR = "/home/timehit/a/timehit2/screenshots";

test("dashboard current month screenshot", async ({ page }) => {
  await login(page, "admin@timehit.com");
  // Clear sessionStorage to get default (current month)
  await page.evaluate(() => {
    sessionStorage.removeItem("control-year");
    sessionStorage.removeItem("control-month");
  });
  await page.goto("http://localhost:3000/");
  await expect(page.getByText("Control Screen")).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/dashboard-april.png`, fullPage: true });
});
