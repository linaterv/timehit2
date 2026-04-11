import { test, expect } from "@playwright/test";

const SCREENSHOTS_DIR = "/home/timehit/a/timehit2/screenshots";

test("login and logout with screenshots", async ({ page }) => {
  // 1. Go to login page
  await page.goto("http://localhost:3000/login");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-page.png`, fullPage: true });

  // 2. Fill credentials and submit
  await page.getByTestId("login-email").fill("admin@timehit.com");
  await page.getByTestId("login-password").fill("a");
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-credentials-filled.png`, fullPage: true });

  await page.getByTestId("login-submit").click();
  await page.waitForURL(/^(?!.*\/login)/, { timeout: 10000 });
  await expect(page.getByTestId("sidebar")).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-logged-in-dashboard.png`, fullPage: true });

  // 3. Logout
  await page.getByTestId("user-menu").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-user-menu-open.png`, fullPage: true });

  await page.getByText("Logout").click();
  await expect(page).toHaveURL(/\/login/);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-logged-out.png`, fullPage: true });
});
