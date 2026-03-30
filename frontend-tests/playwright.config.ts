import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
