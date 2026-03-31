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

  test("admin creates contractor with autogen password, then deletes", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/contractors");
    await page.waitForURL(/\/contractors/, { timeout: 10000 });

    // Open create dialog
    await page.getByTestId("create-contractor-btn").click();
    await expect(page.getByTestId("create-contractor-dialog")).toBeVisible();

    // Fill name and email
    const name = "E2E Test Contractor";
    const email = "e2e-test-contr@example.com";
    const dialog = page.getByTestId("create-contractor-dialog");
    const inputs = dialog.locator("input");
    await inputs.nth(0).fill(name);  // Full Name
    await inputs.nth(1).fill(email); // Email

    // Wait for autogen password
    await page.waitForTimeout(1500);

    // Submit
    await page.getByTestId("create-contractor-submit").click();
    await page.waitForTimeout(1500);

    // Verify contractor appears in list
    await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });

    // Click on contractor to open detail
    await page.getByText(name).click();
    await page.waitForURL(/\/contractors\//, { timeout: 5000 });
    await expect(page.getByText(name)).toBeVisible();

    // Delete contractor
    await page.getByTestId("contractor-delete-btn").click();
    await page.getByRole("button", { name: "Delete" }).last().click();
    await page.waitForTimeout(1000);
  });

  test("contractor edits own company name in profile", async ({ page }) => {
    await loginAs.alex(page);
    await navigateTo(page, "/profile");
    await page.waitForTimeout(1000);

    // Go to Account tab
    await page.getByTestId("tab-account").click();
    await page.waitForTimeout(500);

    // Edit company name
    const companyInput = page.getByTestId("field-company_name");
    await expect(companyInput).toBeVisible();
    const original = await companyInput.inputValue();
    await companyInput.fill("E2E Test Company");
    await page.getByTestId("contractor-save").click();
    await page.waitForTimeout(1000);

    // Verify saved
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 3000 });

    // Restore original
    await companyInput.fill(original);
    await page.getByTestId("contractor-save").click();
    await page.waitForTimeout(1000);
  });

  test("client contact cannot access contractors", async ({ page }) => {
    await loginAs.client1(page);
    const items = page.getByTestId("sidebar").locator("nav a");
    const texts = await items.allTextContents();
    expect(texts).not.toContain("Contractors");
  });
});
