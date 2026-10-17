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
  },
});
