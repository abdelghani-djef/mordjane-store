import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the dev stack (`devenv up`): Next on :3000 proxying FastAPI.
 * They need a seeded catalog (`seed`) and the admin from E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
