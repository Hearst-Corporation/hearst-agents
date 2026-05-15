import { test, expect } from "@playwright/test";

test.describe("VideoQuickLaunch — Smoke", () => {
  test("login page s'affiche sans crash", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Continuer avec Google")).toBeVisible();
  });
});

test.describe("VideoQuickLaunch — Panel @skip-ci", () => {
  // Requiert HEARST_DEV_AUTH_BYPASS=1 npm run dev sur localhost

  test("panel s'ouvre via ⌘G @skip-ci", async ({ page }) => {
    await page.goto("/");
    if (page.url().includes("/login")) { test.skip(); return; }
    await page.keyboard.press("Meta+g");
    await expect(page.getByRole("dialog", { name: /lancement rapide vidéo/i }))
      .toBeVisible();
  });

  test("ESC ferme le panel @skip-ci", async ({ page }) => {
    await page.goto("/");
    if (page.url().includes("/login")) { test.skip(); return; }
    await page.keyboard.press("Meta+g");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /lancement rapide vidéo/i }))
      .toHaveAttribute("aria-hidden", "true");
  });

  test("toggle Mode batch affiche 2 variants @skip-ci", async ({ page }) => {
    await page.goto("/");
    if (page.url().includes("/login")) { test.skip(); return; }
    await page.keyboard.press("Meta+g");
    await page.getByRole("button", { name: /mode batch/i }).click();
    await expect(page.getByText("Variant 1")).toBeVisible();
    await expect(page.getByText("Variant 2")).toBeVisible();
  });
});
