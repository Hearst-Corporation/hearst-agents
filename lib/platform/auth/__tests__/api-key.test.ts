/**
 * Tests unitaires — api-key.ts
 *
 * Couverture :
 * - hashApiKey : déterministe, SHA-256 connu
 * - verifyApiKey : préfixe invalide → null (sans toucher Supabase)
 * - verifyApiKey : clé révoquée → null (mock Supabase)
 * - verifyApiKey : clé valide → VerifiedApiKey
 * - generateApiKey : mock INSERT → retourne clé en clair + id
 */

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_KEY_PREFIX, generateApiKey, hashApiKey, verifyApiKey } from "../api-key";

// ─── Mock Supabase ────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockThen = vi.fn();

// Chaînage fluide : chaque méthode retourne l'objet builder
const chainBuilder = {
  select: mockSelect,
  eq: mockEq,
  is: mockIs,
  single: mockSingle,
  insert: mockInsert,
  update: mockUpdate,
  then: mockThen,
};

Object.values(chainBuilder).forEach((fn) => fn.mockReturnValue(chainBuilder));

const mockFrom = vi.fn().mockReturnValue(chainBuilder);

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: () => ({ from: mockFrom }),
  requireServerSupabase: () => ({ from: mockFrom }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("hashApiKey", () => {
  it("est déterministe — même input → même hash", () => {
    const raw = "hsk_deadbeef1234567890abcdef";
    expect(hashApiKey(raw)).toBe(hashApiKey(raw));
  });

  it("produit le SHA-256 hex attendu", () => {
    const raw = "hsk_test_value";
    expect(hashApiKey(raw)).toBe(sha256(raw));
  });

  it("deux clés différentes → hashes différents", () => {
    expect(hashApiKey("hsk_aaa")).not.toBe(hashApiKey("hsk_bbb"));
  });

  it("retourne une chaîne de 64 caractères hex", () => {
    expect(hashApiKey("hsk_anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyApiKey — préfixe invalide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null si le préfixe n'est pas hsk_", async () => {
    const result = await verifyApiKey("sk-openai-abc123");
    expect(result).toBeNull();
    // Supabase ne doit PAS être appelé
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("retourne null pour une chaîne vide", async () => {
    expect(await verifyApiKey("")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("retourne null pour un préfixe partiel", async () => {
    expect(await verifyApiKey("hsk")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("verifyApiKey — mock Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser le chaînage
    mockFrom.mockReturnValue(chainBuilder);
    Object.values(chainBuilder).forEach((fn) => fn.mockReturnValue(chainBuilder));
  });

  it("retourne null si la DB ne trouve pas la clé (error)", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    const result = await verifyApiKey("hsk_validprefixbutunknown1234567890ab");
    expect(result).toBeNull();
  });

  it("retourne null si data est null (clé révoquée ou inexistante)", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await verifyApiKey("hsk_validprefixbutrevoked1234567890ab");
    expect(result).toBeNull();
  });

  it("retourne VerifiedApiKey pour une clé valide", async () => {
    const mockRow = {
      id: "row-uuid-123",
      tenant_id: "tenant-abc",
      user_id: "user-xyz",
      scopes: ["read", "write"],
    };
    mockSingle.mockResolvedValueOnce({ data: mockRow, error: null });
    // fire-and-forget update → on laisse le chaînage par défaut

    const result = await verifyApiKey("hsk_" + "a".repeat(64));

    expect(result).toEqual({
      tenantId: "tenant-abc",
      userId: "user-xyz",
      scopes: ["read", "write"],
    });
  });

  it("retourne userId null si user_id est null en DB", async () => {
    const mockRow = {
      id: "row-uuid-456",
      tenant_id: "tenant-def",
      user_id: null,
      scopes: ["read"],
    };
    mockSingle.mockResolvedValueOnce({ data: mockRow, error: null });

    const result = await verifyApiKey("hsk_" + "b".repeat(64));

    expect(result?.userId).toBeNull();
    expect(result?.tenantId).toBe("tenant-def");
  });

  it("ne throw pas si Supabase lève une exception (fail-soft)", async () => {
    mockSingle.mockRejectedValueOnce(new Error("DB connection error"));
    const result = await verifyApiKey("hsk_" + "c".repeat(64));
    expect(result).toBeNull();
  });
});

describe("generateApiKey — mock Supabase INSERT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(chainBuilder);
    Object.values(chainBuilder).forEach((fn) => fn.mockReturnValue(chainBuilder));
  });

  it("retourne une clé préfixée hsk_ et un id UUID", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "new-uuid-789" }, error: null });

    const result = await generateApiKey({
      tenantId: "tenant-123",
      name: "Test SDK key",
      scopes: ["read"],
    });

    expect(result.id).toBe("new-uuid-789");
    expect(result.key).toMatch(new RegExp(`^${API_KEY_PREFIX}[0-9a-f]{64}$`));
    expect(result.keyPrefix).toBe(result.key.slice(0, 8));
  });

  it("insère le hash (pas la clé brute) en DB", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "new-uuid-000" }, error: null });

    const result = await generateApiKey({ tenantId: "t", name: "n" });

    // Vérifier que le payload INSERT contient key_hash, pas key
    const insertCall = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertCall).toHaveProperty("key_hash");
    expect(insertCall).not.toHaveProperty("key");
    // Le hash doit correspondre à la clé retournée
    expect(insertCall["key_hash"]).toBe(hashApiKey(result.key));
  });

  it("throw si l'INSERT échoue", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "unique violation" } });

    await expect(generateApiKey({ tenantId: "t", name: "duplicate" })).rejects.toThrow(
      "INSERT failed",
    );
  });
});
