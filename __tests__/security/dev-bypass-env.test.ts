/**
 * B1.4 — F-053 : isProductionEnv OR logic
 *
 * Vérifie que HEARST_ENV=staging ne peut pas masquer NODE_ENV=production.
 * Fichier séparé pour éviter l'interférence avec le mock global de dev-bypass
 * dans proxy-auth-hardening.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("F-053 — isProductionEnv OR logic", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("HEARST_ENV=staging ne masque pas NODE_ENV=production", async () => {
    // Ancien bug : HEARST_ENV=staging prenait la précédence sur NODE_ENV=production
    // via la logique `HEARST_ENV ?? NODE_ENV`. Désormais, OR logic : si l'un est prod → prod.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HEARST_ENV", "staging");
    vi.stubEnv("HEARST_DEV_AUTH_BYPASS", "");

    const { isDevBypassEnabled } = await import("@/lib/platform/auth/dev-bypass");
    expect(isDevBypassEnabled()).toBe(false);
  });

  it("VERCEL_ENV=production déclenche le guard prod même si NODE_ENV=development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("HEARST_DEV_AUTH_BYPASS", "");

    const { isDevBypassEnabled } = await import("@/lib/platform/auth/dev-bypass");
    expect(isDevBypassEnabled()).toBe(false);
  });

  it("HEARST_ENV=production déclenche le guard prod même si NODE_ENV=development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HEARST_ENV", "production");
    vi.stubEnv("HEARST_DEV_AUTH_BYPASS", "");

    const { isDevBypassEnabled } = await import("@/lib/platform/auth/dev-bypass");
    expect(isDevBypassEnabled()).toBe(false);
  });

  it("bypass actif en dev quand aucun vecteur prod n'est présent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("HEARST_ENV", "");
    vi.stubEnv("HEARST_DEV_AUTH_BYPASS", "1");

    const { isDevBypassEnabled } = await import("@/lib/platform/auth/dev-bypass");
    expect(isDevBypassEnabled()).toBe(true);
  });

  it("bypass + NODE_ENV=production → throw au boot (defense in depth)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HEARST_DEV_AUTH_BYPASS", "1");

    await expect(import("@/lib/platform/auth/dev-bypass")).rejects.toThrow(
      /HEARST_DEV_AUTH_BYPASS=1 detected in a production environment/
    );
  });

  it("HEARST_ENV=prod (alias) déclenche le guard prod", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HEARST_ENV", "prod");
    vi.stubEnv("HEARST_DEV_AUTH_BYPASS", "");

    const { isDevBypassEnabled } = await import("@/lib/platform/auth/dev-bypass");
    expect(isDevBypassEnabled()).toBe(false);
  });
});
