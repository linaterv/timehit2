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

  test("admin uploads doc on placement, edits visibility, deletes", async ({ page }) => {
    await loginAs.admin(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    // Click first ACTIVE placement
    await page.locator("table tbody tr").first().click();
    await page.waitForURL(/\/placements\//, { timeout: 5000 });

    // Go to Documents tab
    await page.locator("nav button, button").filter({ hasText: "Documents" }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Upload Document")).toBeVisible({ timeout: 5000 });

    // Open upload dialog
    await page.getByText("Upload Document").click();
    await page.waitForTimeout(300);

    // Fill label
    await page.getByTestId("doc-label-input").fill("E2E Test NDA");

    // Check visibility
    const checkboxes = page.locator(".fixed input[type='checkbox']");
    await checkboxes.nth(0).check(); // Visible to client
    await checkboxes.nth(1).check(); // Visible to contractor

    // Upload a file
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles({
      name: "test-doc.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("E2E test document content"),
    });
    await page.waitForTimeout(500);

    // Click Save
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(1500);

    // Verify doc appears with badges
    await expect(page.getByText("E2E Test NDA")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Client").first()).toBeVisible();
    await expect(page.getByText("Contractor").first()).toBeVisible();

    // Click doc row to edit
    await page.getByText("E2E Test NDA").click();
    await page.waitForTimeout(300);

    // Change label
    await page.getByTestId("doc-label-input").fill("E2E Edited Label");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(1000);

    // Verify edited label
    await expect(page.getByText("E2E Edited Label")).toBeVisible({ timeout: 3000 });

    // Delete the doc — set dialog handler before clicking
    page.on("dialog", (d) => d.accept());
    await page.getByText("Delete").last().click();
    await page.waitForTimeout(1000);
  });

  test("contractor has no documents nav", async ({ page }) => {
    await loginAs.contractor1(page);
    const items = page.getByTestId("sidebar").locator("nav a");
    const texts = await items.allTextContents();
    expect(texts).not.toContain("Documents");
  });
});
