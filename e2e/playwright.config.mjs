import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "payment-recovery.spec.mjs",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    browserName: "chromium",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/print",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    // Local test server gets non-routable .invalid URLs only.
    // Even if a browser test regresses, it cannot contact a live backend.
    env: {
      NEXT_PUBLIC_DEPLOYMENT_STAGE: "preview",
      NEXT_PUBLIC_PREVIEW_API_URL: "https://api-staging.invalid",
      NEXT_PUBLIC_PREVIEW_TERMINAL_02_API_URL: "https://api2-staging.invalid",
      NEXT_PUBLIC_PREVIEW_KIOSK_API_URL: "https://kiosk-staging.invalid",
    },
  },
});
