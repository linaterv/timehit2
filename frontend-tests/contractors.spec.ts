import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe("Contractors", () => {
  test("broker lists all contractors", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/contractors");
    await page.waitForURL(/\/contractors/, { timeout: 10000 });
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("John Doe")).toBeVisible();
    await expect(page.getByText("Jane Smith")).toBeVisible();
  });

  test("contractor sees own profile", async ({ page }) => {
    await loginAs.contractor1(page);
    await navigateTo(page, "/profile");
    await page.waitForTimeout(1000);
    // Should show profile with company name or user info
    await expect(page.getByText(/company|profile|john/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("client contact cannot access contractors", async ({ page }) => {
    await loginAs.client1(page);
    const items = page.getByTestId("sidebar").locator("nav a");
    const texts = await items.allTextContents();
    expect(texts).not.toContain("Contractors");
  });
});
