import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe("Users", () => {
  test("admin lists users", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/users");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("admin@test.com")).toBeVisible();
  });

  test("admin sees user details", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/users");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Verify seeded users are in the table
    await expect(page.getByText("broker1@test.com")).toBeVisible();
    await expect(page.getByText("contractor1@test.com")).toBeVisible();
    // Verify role badges are shown in the table
    await expect(page.locator("table").getByText("BROKER").first()).toBeVisible();
    await expect(page.locator("table").getByText("CONTRACTOR").first()).toBeVisible();
  });

  test("broker cannot access users page", async ({ page }) => {
    await loginAs.broker1(page);
    const items = page.getByTestId("sidebar").locator("nav a");
    const texts = await items.allTextContents();
    expect(texts).not.toContain("Users");
  });
});
