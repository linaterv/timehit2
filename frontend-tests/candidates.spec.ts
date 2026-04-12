import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Candidates", () => {
  test("admin sees candidates page", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/candidates");
    await expect(page.getByTestId("candidates-page")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("candidates-search")).toBeVisible();
  });

  test("broker sees candidates page", async ({ page }) => {
    await loginAs.broker1(page);
    await page.goto("/candidates");
    await expect(page.getByTestId("candidates-page")).toBeVisible({ timeout: 10000 });
  });

  test("candidates list shows seeded data", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/candidates");
    await page.waitForTimeout(2000);
    // Should see at least one candidate name from seed
    await expect(page.getByText(/Tomas|Marta|Erik|Ieva|Lukas|Agata/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("search candidates by skill", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/candidates");
    await page.getByTestId("candidates-search").fill("java");
    await page.getByTestId("candidates-search").press("Enter");
    await page.waitForTimeout(2000);
    // Should show results with java skills
    const content = await page.textContent("body");
    expect(content?.toLowerCase()).toContain("java");
  });

  test("search with no results", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/candidates");
    await page.getByTestId("candidates-search").fill("zzzznonexistent999");
    await page.getByTestId("candidates-search").press("Enter");
    await page.waitForTimeout(2000);
    // Should show some "no results" indication or empty state
    const count = await page.locator("[data-testid='candidates-page'] a, [data-testid='candidates-page'] [class*='card']").count();
    // Expect very few results (0 or just UI elements)
    expect(count).toBeLessThan(5);
  });

  test("click candidate navigates to detail", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/candidates");
    await page.waitForTimeout(2000);
    // Click first candidate card/link
    const firstLink = page.locator("[data-testid='candidates-page'] a[href*='/candidates/']").first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await page.waitForURL(/\/candidates\//);
      await expect(page.getByTestId("candidate-detail-page")).toBeVisible({ timeout: 10000 });
    }
  });

  test("candidate detail shows tabs", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/candidates");
    await page.waitForTimeout(2000);
    const firstLink = page.locator("[data-testid='candidates-page'] a[href*='/candidates/']").first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await page.waitForURL(/\/candidates\//);
      await page.waitForTimeout(1000);
      // Should show Profile, CVs, Timeline tabs
      await expect(page.getByText(/Profile|CVs|Timeline/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("contractor cannot access candidates", async ({ page }) => {
    await loginAs.contractor1(page);
    await page.goto("/candidates");
    await page.waitForTimeout(2000);
    // Should be redirected or see access denied
    const url = page.url();
    const denied = await page.getByText(/denied|forbidden|not authorized/i).isVisible().catch(() => false);
    expect(url.includes("/candidates") === false || denied).toBeTruthy();
  });

  test("client contact cannot access candidates", async ({ page }) => {
    await loginAs.client1(page);
    await page.goto("/candidates");
    await page.waitForTimeout(2000);
    const url = page.url();
    const denied = await page.getByText(/denied|forbidden|not authorized/i).isVisible().catch(() => false);
    expect(url.includes("/candidates") === false || denied).toBeTruthy();
  });
});
