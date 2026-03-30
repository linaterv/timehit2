import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe("Documents", () => {
  test("admin sees documents page", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/documents");
    await page.waitForTimeout(1000);
    // Documents page should render (may be empty if no docs uploaded)
    await expect(page.getByText(/document|file|no data/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("broker sees documents page", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/documents");
    await page.waitForTimeout(1000);
    await expect(page.getByText(/document|file|no data/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("contractor has no documents nav", async ({ page }) => {
    await loginAs.contractor1(page);
    const items = page.getByTestId("sidebar").locator("nav a");
    const texts = await items.allTextContents();
    expect(texts).not.toContain("Documents");
  });
});
