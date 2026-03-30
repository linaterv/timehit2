import { type Page, expect } from "@playwright/test";

export async function login(page: Page, email: string, password: string = "a") {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/^(?!.*\/login)/, { timeout: 10000 });
  await expect(page.getByTestId("sidebar")).toBeVisible({ timeout: 10000 });
}

/** Navigate to a path by clicking sidebar link, avoiding full-page reload that loses auth */
export async function navigateTo(page: Page, path: string) {
  // Use link click for sidebar-navigable paths to preserve auth context
  // Try multiple possible nav testids (role-dependent labels)
  const candidates: Record<string, string[]> = {
    "/": ["nav-dashboard", "nav-my-timesheets"],
    "/users": ["nav-users"],
    "/clients": ["nav-clients"],
    "/contractors": ["nav-contractors"],
    "/placements": ["nav-placements", "nav-my-placements"],
    "/timesheets": ["nav-timesheets", "nav-my-timesheets"],
    "/invoices": ["nav-invoices", "nav-my-invoices"],
    "/documents": ["nav-documents"],
    "/profile": ["nav-my-profile"],
  };
  for (const testId of candidates[path] || []) {
    const link = page.getByTestId(testId);
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForTimeout(500);
      return;
    }
  }
  // Fallback: direct navigation (may lose auth on client-only state)
  await page.goto(path);
  await page.waitForTimeout(500);
}

export const loginAs = {
  admin: (page: Page) => login(page, "admin@test.com"),
  broker1: (page: Page) => login(page, "broker1@test.com"),
  broker2: (page: Page) => login(page, "broker2@test.com"),
  contractor1: (page: Page) => login(page, "contractor1@test.com"),
  contractor2: (page: Page) => login(page, "contractor2@test.com"),
  client1: (page: Page) => login(page, "client1@test.com"),
  alex: (page: Page) => login(page, "dev.alex@mail.com"),
  anna: (page: Page) => login(page, "anna@techvibe.com"),
  jonas: (page: Page) => login(page, "jonas@timehit.com"),
};

export async function navItems(page: Page): Promise<string[]> {
  const nav = page.getByTestId("sidebar").locator("nav a");
  return nav.allTextContents();
}
