import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const chrome = { ...devices["Desktop Chrome"], channel: "chrome" };
const siteWideSpecs = /(admin-settings|mobile-app-release)\.spec\.ts$/u;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Several specs render the WebGL field; more than two browsers at once
  // starve an 8 GB machine. PLAYWRIGHT_WORKERS overrides this locally.
  workers: process.env.CI ? 1 : Number(process.env.PLAYWRIGHT_WORKERS) || 2,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results",
  // Every worker shares one development server that compiles routes on first
  // use and hashes passwords deliberately slowly.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // The development server restarts itself near its memory limit,
        // refusing requests mid-run; a larger heap keeps it up.
        command:
          "NODE_OPTIONS=--max-old-space-size=4096 pnpm exec next dev --hostname 127.0.0.1 --port 3100",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      // Enrolls the staff fixture accounts in two-factor authentication.
      name: "setup",
      testMatch: /\.setup\.ts$/u,
      use: chrome,
    },
    {
      name: "chrome",
      testIgnore: siteWideSpecs,
      dependencies: ["setup"],
      use: chrome,
    },
    {
      // These change what every public page shows (notices, hidden
      // sections), so they run alone once everything else has finished.
      name: "chrome-site-wide",
      testMatch: siteWideSpecs,
      dependencies: ["chrome"],
      use: chrome,
    },
  ],
});
