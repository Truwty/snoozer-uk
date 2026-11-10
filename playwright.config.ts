import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3000";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: {
    ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  } }],
  webServer: { command: "npm start", url: `${baseURL}/health/live`, reuseExistingServer: !process.env.CI },
});
