import { defineConfig, devices } from "@playwright/test";

// BASE_URL points at the running web app. Local prod compose maps it to :3001;
// in CI (docker-compose.ci.yml) the web service is reachable as http://web:3000.
const baseURL = process.env.BASE_URL || "http://localhost:3001";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Mobile-first product: emulate a phone on Chromium + WebKit (iOS engine).
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
});
