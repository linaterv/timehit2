import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Settings", () => {
  test("admin sees settings page", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/settings");
    await expect(page.getByTestId("settings-page")).toBeVisible({ timeout: 10000 });
  });

  test("settings page has tabs", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/settings");
    await page.waitForTimeout(1000);
    // Should have at least placement settings or invoice templates
    await expect(page.getByText(/placement|template|invoice|agency/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("repopulate button visible for admin", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/settings");
    await page.waitForTimeout(1000);
    // Look for repopulate/danger button
    const btn = page.getByText(/repopulate|reset.*database/i);
    await expect(btn.first()).toBeVisible({ timeout: 5000 });
  });

  test("contractor cannot access settings", async ({ page }) => {
    await loginAs.contractor1(page);
    await page.goto("/settings");
    await page.waitForTimeout(2000);
    await expect(page.getByText(/admin access required|denied|forbidden/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("broker cannot access settings", async ({ page }) => {
    await loginAs.broker1(page);
    await page.goto("/settings");
    await page.waitForTimeout(2000);
    await expect(page.getByText(/admin access required|denied|forbidden/i).first()).toBeVisible({ timeout: 5000 });
  });
});
