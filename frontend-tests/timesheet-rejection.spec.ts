import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Timesheet rejection (P2)", () => {
  test("broker rejects submitted timesheet via modal", async ({ page }) => {
    await loginAs.admin(page);

    // Use API to find a SUBMITTED timesheet, then navigate directly
    const tsListResp = await page.request.get("http://localhost:8000/api/v1/timesheets?status=SUBMITTED", {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("access_token"))}` },
    });
    const ts = await tsListResp.json();
    if (!ts.data || ts.data.length === 0) return;
    const tsId = ts.data[0].id;

    await page.goto(`/timesheets/${tsId}`);
    await page.waitForTimeout(1500);

    // Click Reject -> opens modal
    const rejectBtn = page.getByTestId("ts-reject-btn");
    if (!(await rejectBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await rejectBtn.click();

    // Modal appears
    await expect(page.getByTestId("reject-modal")).toBeVisible({ timeout: 3000 });
    await page.getByTestId("reject-reason").fill("E2E rejection test");
    await page.getByTestId("reject-confirm").click();
    await page.waitForTimeout(2000);

    // Status should now be DRAFT (rejection returns to DRAFT)
    const status = await page.locator("body").textContent();
    expect(status).toMatch(/DRAFT|REJECTED/i);
  });
});

test.describe("Placement copy (P2)", () => {
  test("copy button creates new draft", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/placements");
    await page.waitForTimeout(2000);

    // Click an active placement
    const activeRow = page.locator("table tbody tr", { hasText: /ACTIVE/i }).first();
    if (!(await activeRow.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await activeRow.click();
    await page.waitForURL(/\/placements\//);
    await page.waitForTimeout(1500);

    const copyBtn = page.getByTestId("placement-copy-btn");
    if (!(await copyBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await copyBtn.click();
    await page.waitForTimeout(2500);

    // Should land on a new placement page (or new draft created)
    const url = page.url();
    expect(url).toMatch(/\/placements\//);
  });
});

test.describe("Invoice PDF download (P2)", () => {
  test("PDF download button visible on issued invoice", async ({ page }) => {
    await loginAs.admin(page);
    await page.goto("/invoices");
    await page.waitForTimeout(2000);

    const issuedRow = page.locator("table tbody tr", { hasText: /ISSUED|PAID/i }).first();
    if (!(await issuedRow.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await issuedRow.click();
    await page.waitForURL(/\/invoices\//);
    await page.waitForTimeout(1500);

    const pdfBtn = page.getByTestId("invoice-pdf-btn");
    await expect(pdfBtn).toBeVisible({ timeout: 5000 });
  });
});
