# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: happy-path.spec.ts >> Responsive — Mobile Viewport >> mobile: left panel hidden, right panel as drawer
- Location: e2e/happy-path.spec.ts:50:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button[aria-label*=\'panneau\']')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button[aria-label*=\'panneau\']')

```

```yaml
- text: Hearst OS Accès sécurisé
- heading "Accédez à votre espace de travail" [level=1]
- paragraph: Connectez-vous via votre fournisseur d'identité professionnel.
- button "Continuer avec Google"
- button "Continuer avec Outlook"
- paragraph: En continuant, vous vous authentifiez via votre fournisseur d'entreprise.
- link "Confidentialité":
  - /url: https://hearstcorporation.io/privacy
- text: ·
- link "Conditions":
  - /url: https://hearstcorporation.io/terms
- text: ·
- link "Aide":
  - /url: https://hearstcorporation.io/contact
- alert
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Happy Path E2E Tests
  5   |  *
  6   |  * Critical user journey: login → send message → see focal object
  7   |  */
  8   | 
  9   | test.describe("Happy Path — Login to Focal", () => {
  10  |   test("complete flow: login → message → focal visible", async ({ page }) => {
  11  |     // 1. Login page
  12  |     await page.goto("/login");
  13  |     await expect(page.locator("text=Continuer avec Google")).toBeVisible();
  14  |     await expect(page.locator("text=Continuer avec Outlook")).toBeVisible();
  15  | 
  16  |     // Note: Actual OAuth login requires real credentials or dev bypass
  17  |     // For CI/E2E: use HEARST_DEV_AUTH_BYPASS=1 or mock OAuth provider
  18  |     // This test validates the UI flow structure exists
  19  |   });
  20  | 
  21  |   test("home page structure — authenticated @skip-ci", async ({ page }) => {
  22  |     // Navigate to home (requires auth session or dev bypass)
  23  |     // Set HEARST_DEV_AUTH_BYPASS=1 for local dev testing
  24  |     await page.goto("/");
  25  | 
  26  |     // If authenticated, core UI elements should be visible
  27  |     // If redirected to login, that's also a valid auth behavior
  28  |   });
  29  | 
  30  |   test("send message interaction flow @skip-ci", async ({ page }) => {
  31  |     // Requires: authenticated session
  32  |     // Start app with: HEARST_DEV_AUTH_BYPASS=1 npm run dev
  33  |     await page.goto("/");
  34  | 
  35  |     // Skip if redirected to login (not authenticated)
  36  |     if (page.url().includes("/login")) {
  37  |       test.skip();
  38  |     }
  39  | 
  40  |     // Type and send a message
  41  |     const input = page.locator("textarea, input[type='text']").first();
  42  |     if (await input.isVisible().catch(() => false)) {
  43  |       await input.fill("Test message for E2E");
  44  |       await page.keyboard.press("Enter");
  45  |     }
  46  |   });
  47  | });
  48  | 
  49  | test.describe("Responsive — Mobile Viewport", () => {
  50  |   test("mobile: left panel hidden, right panel as drawer", async ({ page }) => {
  51  |     // iPhone SE viewport
  52  |     await page.setViewportSize({ width: 375, height: 667 });
  53  |     await page.goto("/");
  54  | 
  55  |     // LeftPanel should be hidden
  56  |     await expect(page.locator("aside").first()).not.toBeVisible();
  57  | 
  58  |     // RightPanel toggle button should be visible (FAB)
> 59  |     await expect(page.locator("button[aria-label*='panneau']")).toBeVisible();
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
  60  |   });
  61  | 
  62  |   test("mobile: drawer opens and closes", async ({ page }) => {
  63  |     await page.setViewportSize({ width: 375, height: 667 });
  64  |     await page.goto("/");
  65  | 
  66  |     // Open drawer
  67  |     await page.click("button[aria-label='Ouvrir le panneau runtime']");
  68  | 
  69  |     // Drawer should be visible
  70  |     await expect(page.locator("text=Runtime")).toBeVisible();
  71  | 
  72  |     // Close via overlay
  73  |     await page.click("[class*='fixed inset-0']"); // Backdrop
  74  | 
  75  |     // Drawer should close
  76  |     await expect(page.locator("text=Runtime")).not.toBeVisible();
  77  |   });
  78  | 
  79  |   test("desktop: three column layout visible", async ({ page }) => {
  80  |     // Desktop viewport
  81  |     await page.setViewportSize({ width: 1280, height: 800 });
  82  |     await page.goto("/");
  83  | 
  84  |     // All panels should be visible
  85  |     await expect(page.locator("main")).toBeVisible();
  86  |   });
  87  | });
  88  | 
  89  | test.describe("Error Handling — Toast Visibility", () => {
  90  |   test("error toast appears on failed request", async ({ page }) => {
  91  |     await page.goto("/");
  92  | 
  93  |     // Mock a failed API call by blocking the orchestrate endpoint
  94  |     await page.route("/api/orchestrate", (route) => {
  95  |       route.fulfill({ status: 500, body: "{}" });
  96  |     });
  97  | 
  98  |     // Try to send message
  99  |     const input = page
  100 |       .locator("[data-testid='chat-input'] textarea, [data-testid='chat-input'] input")
  101 |       .first();
  102 |     await input.fill("Test error");
  103 |     await page.keyboard.press("Enter");
  104 | 
  105 |     // Toast should appear
  106 |     await expect(page.locator("text=Échec de l'envoi")).toBeVisible({ timeout: 3000 });
  107 |   });
  108 | });
  109 | 
```