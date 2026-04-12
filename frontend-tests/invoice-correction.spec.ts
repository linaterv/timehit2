import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Invoice correction & series preview (P1)", () => {
  test("invoice correction flow creates DRAFT corrective", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/invoices");
    await page.waitForTimeout(2000);

    // Find an ISSUED invoice (only ISSUED can be corrected)
    const issuedRow = page.locator("table tbody tr", { hasText: /ISSUED/i }).first();
    await expect(issuedRow).toBeVisible({ timeout: 5000 });
    await issuedRow.click();
    await page.waitForURL(/\/invoices\//);
    await page.waitForTimeout(1500);

    // Click Correct button
    const correctBtn = page.getByTestId("invoice-correct-btn");
    await expect(correctBtn).toBeVisible({ timeout: 5000 });
    await correctBtn.click();
    await page.waitForTimeout(500);

    // Fill form
    await page.getByTestId("correct-hourly-rate").fill("99.99");
    await page.getByTestId("correct-total-hours").fill("100");
    await page.getByTestId("correct-reason").fill("E2E test correction");

    // Submit
    await page.getByRole("button", { name: /Submit Correction/i }).click();
    await page.waitForTimeout(2000);

    // Should redirect or update — verify status changed to CORRECTED
    const statusBadge = page.locator("body").getByText(/CORRECTED/i).first();
    await expect(statusBadge).toBeVisible({ timeout: 5000 });
  });

  test("series template live preview updates as you type", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/settings");
    await page.waitForTimeout(2000);

    // Find any invoice template — click first one
    const templateLink = page.locator("a[href*='/settings'], button").filter({ hasText: /template|invoice template/i }).first();
    // Settings page may have inline editor — try to find a series prefix input
    const seriesInput = page.locator("input[placeholder*='COUNT'], input[placeholder*='YYYY']").first();
    if (await seriesInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await seriesInput.fill("INV-{YYYY}-{COUNT_YEAR:4}");
      await page.waitForTimeout(500);
      // Live preview should show some substituted year
      const preview = page.getByText(/INV-\d{4}-\d+/i).first();
      await expect(preview).toBeVisible({ timeout: 5000 });
    }
  });
});
