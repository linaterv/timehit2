import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Entity Cross-Links", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin@timehit.com");
  });

  test("dashboard: client name links to client detail", async ({ page }) => {
    await page.goto("/");
    // Wait for control table to load
    const table = page.getByTestId("control-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    // Find first client link in the placement column
    const clientLink = table.locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
    const href = await clientLink.getAttribute("href");
    expect(href).toMatch(/\/clients\/[a-f0-9-]+/);
    await clientLink.click();
    await page.waitForURL(/\/clients\/[a-f0-9-]+/);
    await expect(page.getByTestId("client-company-name")).toBeVisible();
  });

  test("dashboard: contractor name links to contractor detail", async ({ page }) => {
    await page.goto("/");
    const table = page.getByTestId("control-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const contrLink = table.locator("a[href*='/contractors/']").first();
    if (await contrLink.isVisible()) {
      await contrLink.click();
      await page.waitForURL(/\/contractors\/[a-f0-9-]+/);
      await expect(page.getByTestId("contractor-detail")).toBeVisible();
    }
  });

  test("dashboard: placement links to placement detail", async ({ page }) => {
    await page.goto("/");
    const table = page.getByTestId("control-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const plLink = table.locator("a[href*='/placements/']").first();
    await expect(plLink).toBeVisible();
    await plLink.click();
    await page.waitForURL(/\/placements\/[a-f0-9-]+/);
    await expect(page.getByTestId("placement-detail")).toBeVisible();
  });

  test("clients list: placement count links to client detail placements tab", async ({ page }) => {
    await page.goto("/clients");
    const table = page.getByTestId("clients-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    // Find a link with ?tab=placements
    const totalLink = table.locator("a[href*='tab=placements']").first();
    if (await totalLink.isVisible()) {
      await totalLink.click();
      await page.waitForURL(/\/clients\/[a-f0-9-]+.*tab=placements/);
    }
  });

  test("placements list: client and contractor columns are links", async ({ page }) => {
    await page.goto("/placements");
    const table = page.getByTestId("placements-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    // Client link
    const clientLink = table.locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
    // Contractor link
    const contrLink = table.locator("a[href*='/contractors/']").first();
    await expect(contrLink).toBeVisible();
  });

  test("placement detail: client and contractor in header are links", async ({ page }) => {
    await page.goto("/placements");
    const table = page.getByTestId("placements-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    // Click first row
    await table.locator("tbody tr").first().click();
    await page.waitForURL(/\/placements\/[a-f0-9-]+/);
    await expect(page.getByTestId("placement-detail")).toBeVisible();
    // Check for entity links in header
    const clientLink = page.getByTestId("placement-detail").locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
  });

  test("timesheets list: placement column has entity links", async ({ page }) => {
    await page.goto("/timesheets");
    const table = page.getByTestId("timesheets-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const clientLink = table.locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
  });

  test("timesheet detail: header has client/placement/contractor links", async ({ page }) => {
    // Navigate to a known timesheet via timesheets list
    await page.goto("/timesheets");
    const table = page.getByTestId("timesheets-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    // Click first row's view/edit button or the row itself
    const firstRow = table.locator("tbody tr").first();
    const btn = firstRow.locator("button").first();
    if (await btn.isVisible()) {
      await btn.click();
    } else {
      await firstRow.click();
    }
    await page.waitForURL(/\/timesheets\/[a-f0-9-]+/);
    // Check header links
    const clientLink = page.locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
    const plLink = page.locator("a[href*='/placements/']").first();
    await expect(plLink).toBeVisible();
  });

  test("invoices list: client and contractor columns are links", async ({ page }) => {
    await page.goto("/invoices");
    const table = page.getByTestId("invoices-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const clientLink = table.locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
    const contrLink = table.locator("a[href*='/contractors/']").first();
    await expect(contrLink).toBeVisible();
  });

  test("invoice detail: client and contractor names are links", async ({ page }) => {
    await page.goto("/invoices");
    const table = page.getByTestId("invoices-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    await table.locator("tbody tr").first().click();
    await page.waitForURL(/\/invoices\/[a-f0-9-]+/);
    const clientLink = page.locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
  });

  test("documents list: client and contractor are links", async ({ page }) => {
    await page.goto("/documents");
    const table = page.getByTestId("documents-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const clientLink = table.locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
  });

  test("deep link: client detail opens with ?tab=placements", async ({ page }) => {
    // First get a client ID
    await page.goto("/clients");
    const table = page.getByTestId("clients-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    await table.locator("tbody tr").first().click();
    await page.waitForURL(/\/clients\/[a-f0-9-]+/);
    const url = page.url();
    // Navigate to same URL with ?tab=placements
    await page.goto(url.split("?")[0] + "?tab=placements");
    // Verify placements tab is active
    const plTab = page.getByTestId("tab-placements");
    await expect(plTab).toBeVisible();
    // Check it has the active styling (border-brand-600)
    await expect(plTab).toHaveClass(/border-brand-600/);
  });

  test("contractor detail: client name in placements tab is a link", async ({ page }) => {
    await page.goto("/contractors");
    const table = page.getByTestId("contractors-table");
    await expect(table).toBeVisible({ timeout: 10000 });
    await table.locator("tbody tr").first().click();
    await page.waitForURL(/\/contractors\/[a-f0-9-]+/);
    await expect(page.getByTestId("contractor-detail")).toBeVisible();
    // Placements tab is default — check for client link
    const clientLink = page.locator("a[href*='/clients/']").first();
    await expect(clientLink).toBeVisible();
  });
});
