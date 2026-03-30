import { test, expect } from "@playwright/test";
import { login, loginAs } from "./helpers";

test.describe("Authentication", () => {
  test("login with valid credentials", async ({ page }) => {
    await login(page, "admin@test.com");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("user-menu")).toBeVisible();
  });

  test("login with invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("admin@test.com");
    await page.getByTestId("login-password").fill("wrong");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Invalid")).toBeVisible();
  });

  test("logout", async ({ page }) => {
    await loginAs.admin(page);
    await page.getByTestId("user-menu").click();
    await page.getByText("Logout").click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated redirect", async ({ page }) => {
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/login/);
  });
});
