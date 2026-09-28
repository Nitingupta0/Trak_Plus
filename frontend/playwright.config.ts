import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false, // one shared backend; flow tests are stateful
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build matches CI (docker compose up --build); dev mode's
    // <nextjs-portal> overlay intercepts pointer events and breaks E2E.
    command: "npm run build && npm start",
    url: "http://localhost:3000",
    reuseExistingServer: true, // compose stack usually serves :3000
    timeout: 180_000,
  },
});
