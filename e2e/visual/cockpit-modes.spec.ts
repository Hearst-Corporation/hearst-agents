/**
 * Visual regression — Cockpit polymorphe (11 modes Stage)
 *
 * Spec post-pivot 2026-04-29 : le cockpit a 11 modes Stage (cf
 * `stores/stage.ts` — discriminated union `StageMode`). On capture
 * un screenshot par mode + viewport et compare aux baselines pour
 * détecter les régressions visuelles (refonte, drift de tokens,
 * shell layout cassé, etc).
 *
 * Comment switcher de mode sans naviguer ?
 * --------------------------------------------
 * Le store stage n'a pas de middleware persist et n'est pas exposé
 * via query string. En revanche `stores/stage.ts` expose le store
 * Zustand sur `window.__hearstStageStore` quand
 * `process.env.NODE_ENV !== "production"`. On l'utilise depuis Playwright
 * via `page.evaluate()` pour appeler `setMode(payload)` directement.
 *
 * Génération initiale des baselines
 * ---------------------------------
 *   1. `npm run dev` (port 9001)
 *   2. `npm run test:visual:update`  ← écrit les baselines dans
 *      `e2e/visual/__screenshots__/`
 *   3. Vérifier les screenshots, commit
 *
 * Détection des régressions
 * -------------------------
 *   `npm run test:visual` compare aux baselines (tolérance 2% pixel diff).
 *
 * Tag `@skip-ci` : tant qu'aucun job CI n'a un Next dev + browser
 * disponibles, ces tests ne tournent pas en CI (cf grepInvert dans
 * `playwright.config.ts`).
 */

import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────
// Viewports
// ──────────────────────────────────────────────────────────────
const VIEWPORTS = [{ name: "desktop-1440", width: 1440, height: 900 }] as const;

// ──────────────────────────────────────────────────────────────
// Modes Stage — alignés sur stores/stage.ts (StageMode union)
//
// Pour les modes qui exigent un payload (asset, mission, browser…), on
// fournit un id mock — le sous-Stage affichera son état d'erreur ou son
// skeleton, ce qui est un état visuel valide à freezer dans la baseline.
// Les régressions de chrome (rails, header, footer) seront détectées
// même si le sous-Stage est en empty/error state.
// ──────────────────────────────────────────────────────────────

type ModeFixture = {
  id: string;
  /** Payload à passer à setMode(). */
  payload: Record<string, unknown>;
};

const MODES: ReadonlyArray<ModeFixture> = [
  { id: "cockpit", payload: { mode: "cockpit" } },
  { id: "chat", payload: { mode: "chat" } },
  {
    id: "asset",
    payload: { mode: "asset", assetId: "visual-regression-mock-asset" },
  },
  {
    id: "asset-compare",
    payload: {
      mode: "asset_compare",
      assetIds: ["visual-regression-mock-a", "visual-regression-mock-b"],
    },
  },
  {
    id: "mission",
    payload: { mode: "mission", missionId: "visual-regression-mock-mission" },
  },
  {
    id: "browser",
    payload: { mode: "browser", sessionId: "visual-regression-mock-session" },
  },
  {
    id: "meeting",
    payload: { mode: "meeting", meetingId: "visual-regression-mock-meeting" },
  },
  { id: "kg", payload: { mode: "kg" } },
  { id: "voice", payload: { mode: "voice" } },
  { id: "simulation", payload: { mode: "simulation" } },
  { id: "artifact", payload: { mode: "artifact" } },
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** Force le mode Stage via le store exposé en dev sur window. */
async function setStageMode(
  page: import("@playwright/test").Page,
  payload: Record<string, unknown>,
): Promise<void> {
  await page.evaluate((p) => {
    const w = window as unknown as {
      __hearstStageStore?: {
        getState: () => { setMode: (payload: unknown) => void };
      };
    };
    if (!w.__hearstStageStore) {
      throw new Error(
        "window.__hearstStageStore introuvable — le test exige NODE_ENV !== production (dev mode).",
      );
    }
    w.__hearstStageStore.getState().setMode(p);
  }, payload);
}

/**
 * Désactive animations + caches/blinks + masque les éléments marqués
 * `data-skip-snapshot` (utile pour timestamps live, dots animés, etc).
 */
async function freezeUI(page: import("@playwright/test").Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      [data-skip-snapshot] { visibility: hidden !important; }
    `,
  });
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

test.describe("Visual regression — Cockpit modes @visual @skip-ci", () => {
  for (const viewport of VIEWPORTS) {
    for (const mode of MODES) {
      test(`${mode.id} @ ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        // 1. Charger la home (cockpit par défaut)
        await page.goto("/", { waitUntil: "domcontentloaded" });

        // 2. Attendre que le store Stage soit exposé (mount client)
        await page.waitForFunction(
          () =>
            typeof (window as unknown as { __hearstStageStore?: unknown }).__hearstStageStore !==
            "undefined",
          undefined,
          { timeout: 10_000 },
        );

        // 3. Switch vers le mode cible (no-op si déjà cockpit)
        await setStageMode(page, mode.payload);

        // 4. Laisser le sous-Stage rendre son skeleton / data
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        // 5. Désactiver animations + blink caret pour stabilité
        await freezeUI(page);

        // 6. Snapshot
        await expect(page).toHaveScreenshot(`cockpit-${mode.id}-${viewport.name}.png`, {
          fullPage: false,
          maxDiffPixelRatio: 0.02,
          animations: "disabled",
          caret: "hide",
        });
      });
    }
  }
});
