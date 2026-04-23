import { defineConfig, devices } from "@playwright/test";
import { resolve } from "path";

const BUN_EXE = resolve(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  ".bun",
  "bin",
  process.platform === "win32" ? "bun.exe" : "bun"
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // API server using the test database (port 3002)
      command: `${BUN_EXE} --env-file=.env.test src/index.ts`,
      cwd: "./server",
      url: "http://localhost:3002/api/health",
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Vite dev server proxying to the test API (port 5174)
      command: `${BUN_EXE} run dev:test`,
      cwd: "./client",
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
