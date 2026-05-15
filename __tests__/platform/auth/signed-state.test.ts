/**
 * F-006 — signOAuthState / verifyOAuthState
 *
 * Invariants couverts :
 *   1. Round-trip : sign → verify retourne le payload exact
 *   2. verify rejette un state sans séparateur '.' (non signé)
 *   3. verify rejette un state avec signature corrompue
 *   4. verify rejette un state avec body modifié (HMAC mismatch)
 *   5. verify rejette null / undefined / empty string
 *   6. verify rejette un state forgé avec un autre secret
 *   7. Payload complexe (objets imbriqués) round-trip OK
 *   8. Deux states différents ont des signatures différentes
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_SECRET = "super-secret-nextauth-key-for-testing-purposes-ok";
const ENV_KEY = "NEXTAUTH_SECRET";
const ENV_BACKUP = process.env[ENV_KEY];

describe("signOAuthState / verifyOAuthState (F-006)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env[ENV_KEY] = VALID_SECRET;
    // NODE_ENV est "test" dans vitest par défaut — pas besoin de le forcer
  });

  afterEach(() => {
    if (ENV_BACKUP === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = ENV_BACKUP;
  });

  it("round-trip : signOAuthState → verifyOAuthState retourne le payload exact", async () => {
    const { signOAuthState, verifyOAuthState } = await import("@/lib/platform/auth/signed-state");
    const payload = { v: "code-verifier-abc", u: "user-uuid-123", t: "tenant-1", w: "ws-1" };
    const state = signOAuthState(payload);

    expect(typeof state).toBe("string");
    expect(state).toContain(".");

    const decoded = verifyOAuthState<typeof payload>(state);
    expect(decoded).not.toBeNull();
    expect(decoded?.v).toBe("code-verifier-abc");
    expect(decoded?.u).toBe("user-uuid-123");
    expect(decoded?.t).toBe("tenant-1");
    expect(decoded?.w).toBe("ws-1");
  });

  it("verify rejette un state sans séparateur '.' (non signé / forgé en base64url brut)", async () => {
    const { verifyOAuthState } = await import("@/lib/platform/auth/signed-state");
    // Simule l'ancien format : JSON base64url sans HMAC
    const forgery = Buffer.from(JSON.stringify({ v: "x", u: "victim", t: "t", w: "w" })).toString(
      "base64url",
    );
    const result = verifyOAuthState(forgery);
    expect(result).toBeNull();
  });

  it("verify rejette un state avec signature corrompue (dernier char altéré)", async () => {
    const { signOAuthState, verifyOAuthState } = await import("@/lib/platform/auth/signed-state");
    const state = signOAuthState({ v: "v", u: "u", t: "t", w: "w" });

    // Corrompt le dernier caractère de la signature
    const corrupted = state.slice(0, -1) + (state.endsWith("A") ? "B" : "A");
    expect(verifyOAuthState(corrupted)).toBeNull();
  });

  it("verify rejette un state avec body modifié (signature mismatch)", async () => {
    const { signOAuthState, verifyOAuthState } = await import("@/lib/platform/auth/signed-state");
    const original = signOAuthState({ v: "v", u: "victim-uuid", t: "t", w: "w" });
    const [, sig] = original.split(".");

    // Attaquant substitue un payload malveillant mais garde la signature de l'original
    const maliciousBody = Buffer.from(
      JSON.stringify({ v: "v", u: "attacker-uuid", t: "other-tenant", w: "w" }),
    ).toString("base64url");
    const tampered = `${maliciousBody}.${sig}`;

    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it("verify rejette null", async () => {
    const { verifyOAuthState } = await import("@/lib/platform/auth/signed-state");
    expect(verifyOAuthState(null)).toBeNull();
  });

  it("verify rejette undefined", async () => {
    const { verifyOAuthState } = await import("@/lib/platform/auth/signed-state");
    expect(verifyOAuthState(undefined)).toBeNull();
  });

  it("verify rejette empty string", async () => {
    const { verifyOAuthState } = await import("@/lib/platform/auth/signed-state");
    expect(verifyOAuthState("")).toBeNull();
  });

  it("verify rejette un state forgé avec un autre secret (HMAC différent)", async () => {
    const { signOAuthState } = await import("@/lib/platform/auth/signed-state");
    const state = signOAuthState({ v: "v", u: "u", t: "t", w: "w" });

    // Recharge le module avec un secret différent → la signature ne colle plus
    vi.resetModules();
    process.env[ENV_KEY] = "completely-different-secret-that-is-long-enough";
    const { verifyOAuthState: verifyWithOtherSecret } = await import(
      "@/lib/platform/auth/signed-state"
    );

    expect(verifyWithOtherSecret(state)).toBeNull();
  });

  it("payload complexe (objets imbriqués, unicode) round-trip OK", async () => {
    const { signOAuthState, verifyOAuthState } = await import("@/lib/platform/auth/signed-state");
    const payload = {
      v: "verifier-with-special-chars_-~",
      u: "36914162-75f9-4c27-b38b-bb050f51d52b",
      t: "tenant-uuid-abcd",
      w: "ws-uuid-efgh",
      extra: { nested: true, count: 42, emoji: "ok" },
    };
    const state = signOAuthState(payload);
    const decoded = verifyOAuthState<typeof payload>(state);

    expect(decoded).not.toBeNull();
    expect(decoded?.extra?.nested).toBe(true);
    expect(decoded?.extra?.count).toBe(42);
    expect(decoded?.u).toBe("36914162-75f9-4c27-b38b-bb050f51d52b");
  });

  it("deux payloads différents produisent deux states différents", async () => {
    const { signOAuthState } = await import("@/lib/platform/auth/signed-state");
    const s1 = signOAuthState({ v: "v1", u: "u1", t: "t", w: "w" });
    const s2 = signOAuthState({ v: "v2", u: "u2", t: "t", w: "w" });
    expect(s1).not.toBe(s2);
  });
});
