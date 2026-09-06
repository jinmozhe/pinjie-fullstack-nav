import { defineConfig, devices } from "@playwright/test";

const backendURL = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:8000";
const reuseExistingServer = false;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }], ["./scripts/e2e/summary-reporter.mjs"]],
  use: {
    trace: process.env.CI ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.CI ? "off" : "retain-on-failure",
  },
  projects: [
    {
      name: "web-desktop",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "web-mobile",
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "admin-desktop",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3001" },
    },
    {
      name: "admin-mobile",
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:3001" },
    },
  ],
  webServer: process.env.E2E_MANAGED_SERVERS === "1" ? undefined : [
    {
      command: "node apps/web/.next/standalone/apps/web/server.js",
      url: "http://127.0.0.1:3000",
      reuseExistingServer,
      timeout: 120_000,
      env: {
        BACKEND_INTERNAL_URL: backendURL,
        HOSTNAME: "127.0.0.1",
        PORT: "3000",
        WEB_PUBLIC_ORIGIN: "http://127.0.0.1:3000",
      },
    },
    {
      command: "node scripts/e2e/admin-preview.mjs",
      url: "http://127.0.0.1:3001",
      reuseExistingServer,
      timeout: 120_000,
      env: { E2E_BACKEND_URL: backendURL },
    },
  ],
});
