import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe("Clients", () => {
  test("broker lists clients", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/clients");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table").getByText("Acme Corp")).toBeVisible();
  });

  test("broker clicks client row", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/clients");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await page.locator("table tbody tr").filter({ hasText: "Acme Corp" }).first().click();
    await page.waitForURL(/\/clients\//, { timeout: 5000 });
    await expect(page.getByText("Acme Corp")).toBeVisible();
  });

  test("client detail has sections", async ({ page }) => {
    await loginAs.broker1(page);
    await navigateTo(page, "/clients");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await page.locator("table tbody tr").filter({ hasText: "Acme Corp" }).first().click();
    await page.waitForURL(/\/clients\//, { timeout: 5000 });
    await expect(page.getByText(/contact|broker|placement/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("broker2 sees Globex", async ({ page }) => {
    await loginAs.broker2(page);
    await navigateTo(page, "/clients");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // broker2 is always assigned to Globex
    await expect(page.locator("table").getByText("Globex Inc")).toBeVisible();
  });

  test("admin sees all clients", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/clients");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table").getByText("Acme Corp")).toBeVisible();
    await expect(page.locator("table").getByText("Globex Inc")).toBeVisible();
  });
});
