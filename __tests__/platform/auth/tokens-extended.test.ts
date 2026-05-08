/**
 * Tests AES-256-GCM + lifecycle tokens — tokens.ts
 *
 * Invariants couverts :
 *   1. isTokenExpired : expiresAt > now+60 → false (pas expiré)
 *   2. isTokenExpired : expiresAt < now → true (expiré)
 *   3. isTokenExpired : expiresAt = 0 → true
 *   4. recordAuthFailure : 4 appels → false (pas encore révoqué)
 *   5. recordAuthFailure : 5ème appel → true (auto-revoke)
 *   6. AES-256-GCM roundtrip : saveTokens + getTokens → accessToken identique
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Clé de chiffrement AES-256 (64 hex chars = 32 bytes) ──────────────────
const TEST_KEY_HEX = "a".repeat(64);
const USER_ID = "test-user-aes-roundtrip";
const PROVIDER = "google";

const ENV_BACKUP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ENV_BACKUP_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENV_BACKUP_TOKEN = process.env.TOKEN_ENCRYPTION_KEY;

// ── isTokenExpired ────────────────────────────────────────────────────────

describe("isTokenExpired", () => {
  beforeEach(() => vi.resetModules());

  it("retourne false si expiresAt > now + 60s (pas expiré)", async () => {
    const { isTokenExpired } = await import("@/lib/platform/auth/tokens");
    const future = Math.floor(Date.now() / 1000) + 3600; // expire dans 1h
    expect(isTokenExpired(future)).toBe(false);
  });

  it("retourne true si expiresAt est dans le passé (expiré)", async () => {
    const { isTokenExpired } = await import("@/lib/platform/auth/tokens");
    const past = Math.floor(Date.now() / 1000) - 3600; // expiré il y a 1h
    expect(isTokenExpired(past)).toBe(true);
  });

  it("retourne true si expiresAt = 0 (jamais défini)", async () => {
    const { isTokenExpired } = await import("@/lib/platform/auth/tokens");
    expect(isTokenExpired(0)).toBe(true);
  });
});

// ── recordAuthFailure — auto-revoke au 5ème échec ────────────────────────

describe("recordAuthFailure — auto-revoke au 5ème échec", () => {
  beforeEach(() => {
    vi.resetModules();

    // Fournir des vars Supabase factices pour que USE_MEMORY_STORE = false
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY_HEX;
  });

  afterEach(() => {
    if (ENV_BACKUP_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = ENV_BACKUP_URL;

    if (ENV_BACKUP_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = ENV_BACKUP_KEY;

    if (ENV_BACKUP_TOKEN === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = ENV_BACKUP_TOKEN;

    vi.restoreAllMocks();
  });

  it("4 appels consécutifs → retourne false (pas encore révoqué)", async () => {
    let storedCount = 0;

    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockSelectSingle = vi.fn().mockImplementation(() => {
      const count = storedCount++;
      return Promise.resolve({ data: { auth_failure_count: count }, error: null });
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: mockSelectSingle,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mockUpdateEq,
            })),
          })),
        })),
      })),
    }));

    const { recordAuthFailure } = await import("@/lib/platform/auth/tokens");

    for (let i = 0; i < 4; i++) {
      const revoked = await recordAuthFailure(USER_ID, PROVIDER);
      expect(revoked).toBe(false);
    }
  });

  it("5ème appel → retourne true (auto-revoke déclenché)", async () => {
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockSelectSingle = vi.fn().mockResolvedValue({
      data: { auth_failure_count: 4 }, // count=4 avant ce 5ème appel
      error: null,
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: mockSelectSingle,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mockUpdateEq,
            })),
          })),
        })),
      })),
    }));

    const { recordAuthFailure } = await import("@/lib/platform/auth/tokens");
    const revoked = await recordAuthFailure(USER_ID, PROVIDER);
    expect(revoked).toBe(true);
  });
});

// ── AES-256-GCM roundtrip ─────────────────────────────────────────────────

describe("AES-256-GCM roundtrip — saveTokens → getTokens", () => {
  beforeEach(() => {
    vi.resetModules();
    // Supprime les vars Supabase → USE_MEMORY_STORE = true (in-memory path)
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY_HEX;
  });

  afterEach(() => {
    if (ENV_BACKUP_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = ENV_BACKUP_URL;

    if (ENV_BACKUP_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = ENV_BACKUP_KEY;

    if (ENV_BACKUP_TOKEN === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = ENV_BACKUP_TOKEN;
  });

  it("saveTokens + getTokens → accessToken identique (via in-memory store)", async () => {
    const { saveTokens, getTokens } = await import("@/lib/platform/auth/tokens");

    const ACCESS_TOKEN = "ya29.my-fake-access-token-12345";
    const EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;

    await saveTokens(
      USER_ID,
      { accessToken: ACCESS_TOKEN, refreshToken: null, expiresAt: EXPIRES_AT },
      PROVIDER,
    );

    const tokens = await getTokens(USER_ID, PROVIDER);
    expect(tokens.accessToken).toBe(ACCESS_TOKEN);
    expect(tokens.expiresAt).toBe(EXPIRES_AT);
  });
});
