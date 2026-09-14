import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

process.env.E2E_ADMIN_USERNAME ??= "e2e-admin";
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(24).toString("base64url");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node tests/e2e/start-server.mjs",
    url: "http://127.0.0.1:4173/api/v1/health",
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
