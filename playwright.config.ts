/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Playwright configuration — Smoke tests for critical paths
 *
 * Tests:
 * - Health endpoint availability
 * - Login page rendering without crash
 *
 * Note: Install Playwright before using: npm install --save-dev @playwright/test
 */

// Conditionally import to avoid build errors when Playwright is not installed
let defineConfig: any;
let devices: any;

try {
  const playwright = require("@playwright/test");
  defineConfig = playwright.defineConfig;
  devices = playwright.devices;
} catch {
  // Fallback for build when Playwright is not installed
  defineConfig = (config: any) => config;
  devices = {};
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:4102",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-desktop",
      testDir: "./e2e",
      testIgnore: "**/visual/**",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      testDir: "./e2e",
      testIgnore: "**/visual/**",
      use: { ...devices["iPhone 12"] },
    },
    {
      name: "mobile-chrome",
      testDir: "./e2e",
      testIgnore: "**/visual/**",
      use: { ...devices["Pixel 5"] },
    },
    /**
     * Visual regression — captures snapshot par mode Stage cockpit.
     *
     * Lancé uniquement en local via `npm run test:visual` :
     *   1. `npm run dev` (port 4102)
     *   2. `npm run test:visual:update` UNE FOIS pour générer baselines
     *   3. `npm run test:visual` ensuite pour détecter les régressions
     *
     * Tag `@skip-ci` car les baselines exigent un Next dev live + browser
     * stable (pas dispo en CI actuellement).
     */
    {
      name: "visual-regression",
      testDir: "./e2e/visual",
      snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  // Tolérance par défaut pour `toHaveScreenshot` (utilisée par
  // visual-regression — les autres projets n'appellent pas cette assertion).
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
      caret: "hide",
    },
  },
  // Skip auth-required tests + visual regression in CI
  // (visual exige Next dev live + browser stable, not yet available)
  grepInvert: process.env.CI ? /@skip-ci/ : undefined,
});
