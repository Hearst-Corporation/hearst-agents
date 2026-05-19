# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Environment Security >> analytics endpoint requires POST
- Location: e2e/smoke.spec.ts:47:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 401
Received array: [404, 405]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * Smoke tests — Critical path validation (Semaine 1)
  5  |  *
  6  |  * Quick validation that the application boots and core routes work.
  7  |  */
  8  | 
  9  | test.describe("Health & Availability", () => {
  10 |   test("health endpoint returns 200", async ({ request }) => {
  11 |     const response = await request.get("/api/health");
  12 |     expect(response.status()).toBe(200);
  13 |   });
  14 | });
  15 | 
  16 | test.describe("Login Page", () => {
  17 |   test("login page renders without crash", async ({ page }) => {
  18 |     await page.goto("/login");
  19 | 
  20 |     // OAuth buttons should be visible (FR labels — Semaine 4)
  21 |     await expect(page.locator("text=Continuer avec Google")).toBeVisible();
  22 |     await expect(page.locator("text=Continuer avec Outlook")).toBeVisible();
  23 | 
  24 |     // French title (Semaine 4 i18n)
  25 |     await expect(page.locator("text=Accédez à votre espace de travail")).toBeVisible();
  26 |   });
  27 | 
  28 |   test("login page is responsive", async ({ page }) => {
  29 |     // Mobile
  30 |     await page.setViewportSize({ width: 375, height: 667 });
  31 |     await page.goto("/login");
  32 |     await expect(page.locator("text=Continuer avec Google")).toBeVisible();
  33 | 
  34 |     // Desktop
  35 |     await page.setViewportSize({ width: 1280, height: 800 });
  36 |     await page.goto("/login");
  37 |     await expect(page.locator("text=Continuer avec Google")).toBeVisible();
  38 |   });
  39 | });
  40 | 
  41 | test.describe("Environment Security", () => {
  42 |   test("API routes require authentication", async ({ request }) => {
  43 |     const response = await request.get("/api/agents");
  44 |     expect([401, 302, 307]).toContain(response.status());
  45 |   });
  46 | 
  47 |   test("analytics endpoint requires POST", async ({ request }) => {
  48 |     const getResponse = await request.get("/api/analytics");
> 49 |     expect([404, 405]).toContain(getResponse.status());
     |                        ^ Error: expect(received).toContain(expected) // indexOf
  50 |   });
  51 | });
  52 | 
```