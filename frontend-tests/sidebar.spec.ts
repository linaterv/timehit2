import { test, expect } from "@playwright/test";
import { loginAs, navItems } from "./helpers";

test.describe("Sidebar Navigation", () => {
  test("admin sees 8 nav items", async ({ page }) => {
    await loginAs.admin(page);
    const items = await navItems(page);
    expect(items).toContain("Dashboard");
    expect(items).toContain("Users");
    expect(items).toContain("Clients");
    expect(items).toContain("Contractors");
    expect(items).toContain("Placements");
    expect(items).toContain("Timesheets");
    expect(items).toContain("Invoices");
    expect(items).toContain("Documents");
    expect(items).toHaveLength(8);
  });

  test("broker sees 7 nav items", async ({ page }) => {
    await loginAs.broker1(page);
    const items = await navItems(page);
    expect(items).not.toContain("Users");
    expect(items).toContain("Dashboard");
    expect(items).toContain("Documents");
    expect(items).toHaveLength(7);
  });

  test("contractor sees 4 nav items", async ({ page }) => {
    await loginAs.contractor1(page);
    const items = await navItems(page);
    expect(items).toContain("My Timesheets");
    expect(items).toContain("My Placements");
    expect(items).toContain("My Invoices");
    expect(items).toContain("My Profile");
    expect(items).toHaveLength(4);
  });

  test("client contact sees 3 nav items", async ({ page }) => {
    await loginAs.client1(page);
    const items = await navItems(page);
    expect(items).toContain("Timesheets");
    expect(items).toContain("Invoices");
    expect(items).toContain("Documents");
    expect(items).toHaveLength(3);
  });
});
