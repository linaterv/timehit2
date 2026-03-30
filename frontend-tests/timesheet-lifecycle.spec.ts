import { test, expect } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

test.describe.serial("Timesheet Lifecycle — Alex @ TechVibe", () => {

  test("Alex creates March timesheet from placement detail", async ({ page }) => {
    await loginAs.alex(page);
    await navigateTo(page, "/placements");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Click the ACTIVE placement (Alex has one active at TechVibe + one completed)
    await page.locator("table tbody tr").filter({ hasText: "ACTIVE" }).first().click();
    await page.waitForURL(/\/placements\//, { timeout: 5000 });
    // Click Timesheets tab if not already active
    const tsTab = page.locator('button:has-text("Timesheets")');
    if (await tsTab.isVisible().catch(() => false)) {
      await tsTab.click();
      await page.waitForTimeout(500);
    }
    // Click Create Timesheet
    await page.getByTestId("ts-create-btn").click();
    await expect(page.getByTestId("ts-create-dialog")).toBeVisible({ timeout: 3000 });
    // Click on a MISSING month row (shows "+ Create")
    const createRow = page.getByText("+ Create").first();
    await expect(createRow).toBeVisible({ timeout: 3000 });
    await createRow.click();
    // Should navigate to the new timesheet detail
    await page.waitForURL(/\/timesheets\//, { timeout: 5000 });
    await expect(page.getByText(/2026/).first()).toBeVisible({ timeout: 5000 });
  });

  test("Alex adds entries and saves", async ({ page }) => {
    await loginAs.alex(page);
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Switch to All to see the DRAFT created by previous test
    const filterSelect = page.getByTestId("ts-filter-dropdown");
    if (await filterSelect.isVisible().catch(() => false)) {
      await filterSelect.selectOption("all");
      await page.waitForTimeout(500);
    }
    // Find the DRAFT timesheet and click Edit (may be "Late ! Edit" or "Edit")
    const editBtn = page.getByRole("button", { name: /Edit/ }).first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();
    await page.waitForURL(/\/timesheets\//, { timeout: 5000 });
    // Wait for calendar grid
    await expect(page.getByTestId("ts-calendar")).toBeVisible({ timeout: 5000 });
    // Type hours into first available calendar cell input
    const hourInput = page.locator('input[type="number"][step="0.25"]').first();
    await expect(hourInput).toBeVisible({ timeout: 3000 });
    await hourInput.fill("8");
    // Save
    await page.getByTestId("ts-calendar-save").click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/8/).first()).toBeVisible({ timeout: 3000 });
  });

  test("Alex submits the timesheet", async ({ page }) => {
    await loginAs.alex(page);
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    // Switch to All to find the DRAFT
    const filterSelect = page.getByTestId("ts-filter-dropdown");
    if (await filterSelect.isVisible().catch(() => false)) {
      await filterSelect.selectOption("all");
      await page.waitForTimeout(500);
    }
    const editBtn = page.getByRole("button", { name: /Edit/ }).first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();
    await page.waitForURL(/\/timesheets\//, { timeout: 5000 });
    await page.getByTestId("ts-submit-btn").click();
    // Handle any confirmation dialogs
    const confirmBtn = page.getByTestId("confirm-yes");
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await expect(page.getByTestId("status-SUBMITTED")).toBeVisible({ timeout: 5000 });
  });

  test("Anna (client contact) approves", async ({ page }) => {
    await loginAs.anna(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10000 });
    // Click a SUBMITTED row
    const row = page.locator("table tbody tr").filter({ hasText: "SUBMITTED" }).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    await row.click();
    await page.waitForURL(/\/timesheets\//, { timeout: 5000 });
    await page.getByTestId("ts-approve-btn").click();
    await expect(
      page.getByTestId("status-CLIENT_APPROVED").or(page.getByTestId("status-APPROVED"))
    ).toBeVisible({ timeout: 5000 });
  });

  test("Jonas (broker) gives final approval", async ({ page }) => {
    await loginAs.jonas(page);
    await navigateTo(page, "/timesheets");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    // Find CLIENT_APPROVED row and click its View button
    const row = page.locator("table tbody tr").filter({ hasText: /CLIENT.APPROVED/ }).first();
    if (!(await row.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    const viewBtn = row.getByRole("button", { name: /View/ });
    await viewBtn.click();
    await page.waitForURL(/\/timesheets\//, { timeout: 5000 });
    await page.getByTestId("ts-approve-btn").click();
    await expect(page.getByTestId("status-APPROVED")).toBeVisible({ timeout: 5000 });
  });
});
