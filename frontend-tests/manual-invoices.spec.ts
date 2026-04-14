import { test, expect, type Page } from "@playwright/test";
import { loginAs, navigateTo } from "./helpers";

const uniqueNum = (prefix = "MANTEST") =>
  `${prefix}-${Date.now().toString(36).slice(-6).toUpperCase()}-${Math.floor(Math.random() * 9999)}`;

async function openManualForm(page: Page) {
  await navigateTo(page, "/invoices");
  await expect(page.getByTestId("manual-invoice-btn")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("manual-invoice-btn").click();
  await expect(page.getByTestId("manual-invoice-form")).toBeVisible({ timeout: 5000 });
}

async function fillOneLine(page: Page, idx: number, desc: string, qty: string, price: string) {
  await page.getByTestId(`mi-line-${idx}-desc`).fill(desc);
  await page.getByTestId(`mi-line-${idx}-qty`).fill(qty);
  await page.getByTestId(`mi-line-${idx}-price`).fill(price);
}

test.describe("Manual Invoices — create", () => {
  test("admin creates manual invoice with existing client", async ({ page }) => {
    await loginAs.admin(page);
    await openManualForm(page);
    const num = uniqueNum("MAN-ADM-C");
    await page.getByTestId("mi-number").fill(num);
    await page.getByTestId("mi-issue-date").fill("2026-04-14");
    // bill-to: existing client (default)
    await page.getByTestId("mi-client-select").click();
    await page.getByRole("button", { name: /Acme|Globex|TechVibe|CloudBase|NordSoft|MediCorp/ }).first().click();
    await fillOneLine(page, 0, "Permanent placement fee", "1", "5000");
    await page.getByTestId("mi-currency").selectOption("EUR");
    await expect(page.getByTestId("mi-submit")).toBeEnabled();
    await page.getByTestId("mi-submit").click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]+/, { timeout: 10000 });
    await expect(page.getByTestId("manual-invoice-detail")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: num })).toBeVisible();
    await expect(page.getByText("Manual").first()).toBeVisible();
  });

  test("admin creates manual invoice with manual bill-to (no client)", async ({ page }) => {
    await loginAs.admin(page);
    await openManualForm(page);
    const num = uniqueNum("MAN-ADM-M");
    await page.getByTestId("mi-number").fill(num);
    await page.getByTestId("mi-issue-date").fill("2026-04-14");
    await page.getByTestId("mi-bill-to-mode").getByRole("radio", { name: /Manual/i }).check();
    await page.getByTestId("mi-bill-company").fill("One-Off Customer Ltd");
    await page.getByTestId("mi-bill-address").fill("123 Example St\nVilnius\nLT-01234");
    await fillOneLine(page, 0, "Consulting fee", "2", "1500");
    await page.getByTestId("mi-add-line").click();
    await fillOneLine(page, 1, "Travel expenses", "1", "300");
    await page.getByTestId("mi-vat").fill("21");
    await expect(page.getByTestId("mi-totals-subtotal")).toContainText("3,300");
    await expect(page.getByTestId("mi-submit")).toBeEnabled();
    await page.getByTestId("mi-submit").click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]+/, { timeout: 10000 });
    await expect(page.getByTestId("manual-invoice-detail")).toBeVisible();
    await expect(page.getByTestId("mi-line-items")).toContainText("Consulting fee");
    await expect(page.getByTestId("mi-line-items")).toContainText("Travel expenses");
  });

  test("broker creates manual invoice with assigned client", async ({ page }) => {
    await loginAs.broker1(page);
    await openManualForm(page);
    const num = uniqueNum("MAN-BR-C");
    await page.getByTestId("mi-number").fill(num);
    await page.getByTestId("mi-issue-date").fill("2026-04-14");
    await page.getByTestId("mi-client-select").click();
    // broker1 is assigned to Acme Corp + Globex Inc
    await page.getByRole("button", { name: /Acme|Globex/ }).first().click();
    await fillOneLine(page, 0, "Finder fee", "1", "2000");
    await expect(page.getByTestId("mi-submit")).toBeEnabled();
    await page.getByTestId("mi-submit").click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]+/, { timeout: 10000 });
    await expect(page.getByTestId("manual-invoice-detail")).toBeVisible();
  });

  test("broker creates manual invoice without client (manual bill-to)", async ({ page }) => {
    await loginAs.broker1(page);
    await openManualForm(page);
    const num = uniqueNum("MAN-BR-M");
    await page.getByTestId("mi-number").fill(num);
    await page.getByTestId("mi-issue-date").fill("2026-04-14");
    await page.getByTestId("mi-bill-to-mode").getByRole("radio", { name: /Manual/i }).check();
    await page.getByTestId("mi-bill-company").fill("Direct Sale Co");
    await page.getByTestId("mi-bill-address").fill("456 Other Ln");
    await fillOneLine(page, 0, "Referral bonus", "1", "750");
    await expect(page.getByTestId("mi-submit")).toBeEnabled();
    await page.getByTestId("mi-submit").click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]+/, { timeout: 10000 });
    await expect(page.getByTestId("manual-invoice-detail")).toBeVisible();
  });
});

test.describe("Manual Invoices — permissions", () => {
  test("contractor does NOT see New Manual Invoice button", async ({ page }) => {
    await loginAs.contractor1(page);
    await navigateTo(page, "/invoices");
    await expect(page.getByTestId("manual-invoice-btn")).toHaveCount(0);
  });

  test("client contact does NOT see New Manual Invoice button", async ({ page }) => {
    await loginAs.client1(page);
    await navigateTo(page, "/invoices");
    await expect(page.getByTestId("manual-invoice-btn")).toHaveCount(0);
  });
});

test.describe("Manual Invoices — detail / edit / lifecycle", () => {
  async function createMinimal(page: Page, prefix = "MAN-LC"): Promise<{ num: string; id: string }> {
    await loginAs.admin(page);
    await openManualForm(page);
    const num = uniqueNum(prefix);
    await page.getByTestId("mi-number").fill(num);
    await page.getByTestId("mi-issue-date").fill("2026-04-14");
    await page.getByTestId("mi-bill-to-mode").getByRole("radio", { name: /Manual/i }).check();
    await page.getByTestId("mi-bill-company").fill("Lifecycle Corp");
    await page.getByTestId("mi-bill-address").fill("1 Test Ave");
    await fillOneLine(page, 0, "Initial fee", "1", "1000");
    await page.getByTestId("mi-submit").click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]+/, { timeout: 10000 });
    const url = page.url();
    const id = url.split("/").pop() || "";
    return { num, id };
  }

  test("validation — submit disabled without line items / empty desc", async ({ page }) => {
    await loginAs.admin(page);
    await openManualForm(page);
    await page.getByTestId("mi-number").fill(uniqueNum("VAL"));
    await page.getByTestId("mi-issue-date").fill("2026-04-14");
    await page.getByTestId("mi-bill-to-mode").getByRole("radio", { name: /Manual/i }).check();
    await page.getByTestId("mi-bill-company").fill("X");
    await page.getByTestId("mi-bill-address").fill("Y");
    // line qty=1 default but desc empty, price empty → should be disabled
    await expect(page.getByTestId("mi-submit")).toBeDisabled();
    await page.getByTestId("mi-line-0-desc").fill("something");
    await expect(page.getByTestId("mi-submit")).toBeDisabled();
    await page.getByTestId("mi-line-0-price").fill("100");
    await expect(page.getByTestId("mi-submit")).toBeEnabled();
  });

  test("edit DRAFT — change line item, totals recomputed", async ({ page }) => {
    const { num } = await createMinimal(page, "MAN-EDIT");
    await expect(page.getByTestId("manual-invoice-detail")).toBeVisible();
    await expect(page.getByRole("heading", { name: num })).toBeVisible();
    await page.getByTestId("mi-edit-btn").click();
    await expect(page.getByTestId("mi-edit-save")).toBeVisible();
    await page.getByTestId("mi-edit-line-0-price").fill("2500");
    await page.getByTestId("mi-edit-save").click();
    await expect(page.getByTestId("mi-edit-save")).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByTestId("mi-line-items")).toContainText("2,500");
  });

  test("issue → ISSUED; then delete is gone", async ({ page }) => {
    const { num } = await createMinimal(page, "MAN-ISS");
    await expect(page.getByRole("heading", { name: num })).toBeVisible();
    await page.getByTestId("invoice-issue-btn").click();
    await expect(page.getByTestId("invoice-paid-btn")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("invoice-issue-btn")).toHaveCount(0);
    await expect(page.getByTestId("invoice-delete-btn")).toHaveCount(0);
  });

  test("PDF button always visible (DRAFT)", async ({ page }) => {
    await createMinimal(page, "MAN-PDF");
    await expect(page.getByTestId("invoice-pdf-btn")).toBeVisible();
  });

  test("delete DRAFT manual — row disappears from list", async ({ page }) => {
    const { num, id } = await createMinimal(page, "MAN-DEL");
    await expect(page.getByRole("heading", { name: num })).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("invoice-delete-btn").click();
    // ConfirmDialog might be inline
    const confirmBtn = page.getByTestId("confirm-yes");
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
    await page.waitForURL(/\/invoices(\?|$)/, { timeout: 10000 });
    // re-navigate to /invoices and ensure row is gone
    await navigateTo(page, "/invoices");
    await expect(page.locator("table").getByText(num)).toHaveCount(0);
    // direct visit should 404 gracefully
    await page.goto(`/invoices/${id}`);
    await expect(page.getByTestId("invoice-not-found")).toBeVisible({ timeout: 5000 });
  });

  test("duplicate invoice_number — error shown", async ({ page }) => {
    // create once
    const { num } = await createMinimal(page, "MAN-DUP");
    // try a second with the same number
    await navigateTo(page, "/invoices");
    await page.getByTestId("manual-invoice-btn").click();
    await page.getByTestId("mi-number").fill(num);
    // wait for debounced validation
    await expect(page.getByTestId("mi-number-error")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Manual Invoices — list badge + filter", () => {
  test("list shows Manual badge and filter toggle works", async ({ page }) => {
    await loginAs.admin(page);
    // create a manual invoice first so there's at least one
    await openManualForm(page);
    const num = uniqueNum("MAN-BDG");
    await page.getByTestId("mi-number").fill(num);
    await page.getByTestId("mi-issue-date").fill("2026-04-14");
    await page.getByTestId("mi-bill-to-mode").getByRole("radio", { name: /Manual/i }).check();
    await page.getByTestId("mi-bill-company").fill("Badge Test");
    await page.getByTestId("mi-bill-address").fill("Addr");
    await fillOneLine(page, 0, "Fee", "1", "100");
    await page.getByTestId("mi-submit").click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]+/, { timeout: 10000 });
    // go back to list
    await navigateTo(page, "/invoices");
    await expect(page.getByTestId("invoices-manual-filter")).toBeVisible();
    await page.getByTestId("invoices-manual-filter").selectOption("true");
    await expect(page.locator("table").getByText(num)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table").getByText("Manual").first()).toBeVisible();
  });
});
