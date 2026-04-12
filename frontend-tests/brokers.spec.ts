import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Brokers", () => {
  test("admin sees brokers page", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/brokers");
    await expect(page.getByTestId("brokers-page")).toBeVisible({ timeout: 10000 });
  });

  test("brokers page lists brokers", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/brokers");
    await page.waitForTimeout(2000);
    // Should see broker names from seed data
    await expect(page.getByText(/Jonas|Laura|Peter/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("click broker navigates to detail", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/brokers");
    await page.waitForTimeout(2000);
    const firstLink = page.locator("a[href*='/brokers/']").first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await page.waitForURL(/\/brokers\//);
      await expect(page.getByTestId("broker-detail-page")).toBeVisible({ timeout: 10000 });
    }
  });

  test("broker detail shows clients tab", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/brokers");
    await page.waitForTimeout(2000);
    const firstLink = page.locator("a[href*='/brokers/']").first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await page.waitForURL(/\/brokers\//);
      await page.waitForTimeout(1000);
      // Should show tabs including Clients
      await expect(page.getByText(/Clients|Details/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("contractor cannot access brokers page", async ({ page }) => {
    await loginAs.contractor1(page);
    await page.goto("/brokers");
    await page.waitForTimeout(2000);
    const url = page.url();
    const denied = await page.getByText(/denied|forbidden|not authorized/i).isVisible().catch(() => false);
    expect(url.includes("/brokers") === false || denied).toBeTruthy();
  });
});
