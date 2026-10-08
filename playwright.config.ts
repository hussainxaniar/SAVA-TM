import { defineConfig, devices } from "@playwright/test";

// Section 13.2 smoke suite. `pnpm e2e` runs it against the local dev server (started if needed) and the
// local Docker Postgres; the teardown removes every `e2e-*@example.test` user it created. Against a remote
// BASE_URL (a preview or staging deployment) nothing is cleaned up automatically: see tests/e2e/teardown.ts.
export default defineConfig({
  testDir: "./tests/e2e",
  // The flows share one user and space and run in order (serial describe), so a single worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalTeardown: "./tests/e2e/teardown.ts",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Locally the installed Chrome is used (no browser download); CI uses Playwright's Chromium (`playwright install chromium`).
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome", viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
