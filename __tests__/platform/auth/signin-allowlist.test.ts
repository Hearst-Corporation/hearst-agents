/**
 * F-096 — signIn allowlist callback
 *
 * Vérifie que le callback signIn() bloque les domaines non autorisés,
 * passe les domaines allowlistés, et gère les cas limites (pas d'email,
 * prod sans allowlist, dev-bypass).
 */

import { describe, expect, it } from "vitest";

// Extrait la logique pure du callback signIn pour la tester indépendamment
// de NextAuth. Miroir exact de la fonction dans options.ts.
function createSignInCallback(nodeEnv: string, allowedDomainsEnv: string | undefined) {
  return async function signIn({
    user,
    account,
    profile,
  }: {
    user?: { email?: string | null } | null;
    account?: { provider?: string } | null;
    profile?: { email?: string } | null;
  }): Promise<boolean> {
    if (account?.provider === "dev-bypass") return true;

    const email = (profile as { email?: string } | undefined)?.email ?? user?.email ?? null;
    if (!email) return false;

    const allowed = (allowedDomainsEnv ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    if (nodeEnv === "production" && allowed.length === 0) return false;
    if (allowed.length === 0) return true;

    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    return allowed.includes(domain);
  };
}

describe("F-096 — signIn allowlist callback", () => {
  const PROD = "production";
  const DEV = "development";

  describe("production — allowlist set (hearstcorporation.io)", () => {
    const signIn = createSignInCallback(PROD, "hearstcorporation.io");

    it("accepte un email du domaine allowlisté", async () => {
      const result = await signIn({
        account: { provider: "google" },
        profile: { email: "adrien@hearstcorporation.io" },
      });
      expect(result).toBe(true);
    });

    it("rejette un email hors allowlist", async () => {
      const result = await signIn({
        account: { provider: "google" },
        profile: { email: "hacker@evil.com" },
      });
      expect(result).toBe(false);
    });

    it("rejette si pas d'email dans profile ni user", async () => {
      const result = await signIn({
        account: { provider: "google" },
        profile: {},
        user: {},
      });
      expect(result).toBe(false);
    });

    it("accepte si email dans user.email (pas profile)", async () => {
      const result = await signIn({
        account: { provider: "google" },
        profile: {},
        user: { email: "adrien@hearstcorporation.io" },
      });
      expect(result).toBe(true);
    });
  });

  describe("production — allowlist multi-domaines (CSV)", () => {
    const signIn = createSignInCallback(PROD, "hearstcorporation.io, partner.com , test.io");

    it("accepte chaque domaine de la CSV", async () => {
      for (const email of ["a@hearstcorporation.io", "b@partner.com", "c@test.io"]) {
        expect(await signIn({ account: { provider: "google" }, profile: { email } })).toBe(true);
      }
    });

    it("rejette un domaine hors CSV", async () => {
      const result = await signIn({
        account: { provider: "google" },
        profile: { email: "intrus@autre.fr" },
      });
      expect(result).toBe(false);
    });
  });

  describe("production — HEARST_ALLOWED_EMAIL_DOMAINS absent", () => {
    const signIn = createSignInCallback(PROD, undefined);

    it("rejette tous les signins (fail-closed)", async () => {
      const result = await signIn({
        account: { provider: "google" },
        profile: { email: "admin@hearstcorporation.io" },
      });
      expect(result).toBe(false);
    });
  });

  describe("development — HEARST_ALLOWED_EMAIL_DOMAINS absent", () => {
    const signIn = createSignInCallback(DEV, undefined);

    it("laisse passer tout le monde (dev pass-through)", async () => {
      const result = await signIn({
        account: { provider: "google" },
        profile: { email: "anyone@anydomain.xyz" },
      });
      expect(result).toBe(true);
    });
  });

  describe("dev-bypass provider — toujours autorisé", () => {
    it("accepte même sans allowlist ni email en prod", async () => {
      const signIn = createSignInCallback(PROD, undefined);
      const result = await signIn({
        account: { provider: "dev-bypass" },
        user: {},
        profile: {},
      });
      expect(result).toBe(true);
    });

    it("accepte même sans allowlist ni email en dev", async () => {
      const signIn = createSignInCallback(DEV, undefined);
      const result = await signIn({
        account: { provider: "dev-bypass" },
      });
      expect(result).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("email sans @ retourne false (domaine vide)", async () => {
      const signIn = createSignInCallback(PROD, "hearstcorporation.io");
      const result = await signIn({
        account: { provider: "google" },
        profile: { email: "notanemail" },
      });
      expect(result).toBe(false);
    });

    it("domaine en majuscules dans l'email est normalisé", async () => {
      const signIn = createSignInCallback(PROD, "hearstcorporation.io");
      const result = await signIn({
        account: { provider: "google" },
        profile: { email: "Adrien@HEARSTCORPORATION.IO" },
      });
      expect(result).toBe(true);
    });

    it("espaces autour des domaines CSV sont ignorés", async () => {
      const signIn = createSignInCallback(PROD, "  hearstcorporation.io  ,  partner.com  ");
      const result = await signIn({
        account: { provider: "google" },
        profile: { email: "user@partner.com" },
      });
      expect(result).toBe(true);
    });
  });
});
