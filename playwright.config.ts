import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL:
      process.env.TEST_BASE_URL || "http://127.0.0.1:4173/pastel-music-finder/",
    viewport: { width: 1366, height: 768 },
    trace: "retain-on-failure",
  },
  projects: process.env.WINDOWS_BROWSERS
    ? [
        { name: "Windows Chrome", use: { channel: "chrome" } },
        { name: "Windows Edge", use: { channel: "msedge" } },
      ]
    : [{ name: "Chrome", use: { channel: "chrome" } }],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --port 4173",
        url: "http://127.0.0.1:4173/pastel-music-finder/",
        reuseExistingServer: !process.env.CI,
      },
});
