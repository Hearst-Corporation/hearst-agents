/**
 * Tests unitaires — resolveOrCreateUserUuid (user-resolver.ts)
 *
 * Couvre la régression post-migration 0070 :
 * users.primary_tenant_id NOT NULL oblige à passer par la RPC atomique
 * create_user_with_tenant pour éviter la violation NOT NULL sur INSERT.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock Supabase ---

const mockRpc = vi.fn();
const mockGetServerSupabase = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: mockGetServerSupabase,
}));

// Simule un client Supabase minimal avec .rpc()
function makeSupabaseMock(rpcImpl: typeof mockRpc) {
  return { rpc: rpcImpl } as unknown as ReturnType<typeof mockGetServerSupabase>;
}

const VALID_UUID = "aabbccdd-1234-5678-abcd-000000000001";
const TENANT_UUID = "bbccddee-1234-5678-abcd-000000000002";

describe("resolveOrCreateUserUuid", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRpc.mockReset();
    mockGetServerSupabase.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  // Cas 1 : user existant backfillé (a déjà un primary_tenant_id)
  // La RPC est idempotente → retourne l'id sans créer de nouveau tenant
  // -------------------------------------------------------------------
  it("retourne l'UUID pour un user existant backfillé (no-op tenant)", async () => {
    mockRpc.mockResolvedValueOnce({ data: VALID_UUID, error: null });
    mockGetServerSupabase.mockReturnValue(makeSupabaseMock(mockRpc));

    const { resolveOrCreateUserUuid } = await import("@/lib/platform/auth/user-resolver");

    const result = await resolveOrCreateUserUuid("existing@hearstcorporation.io");

    expect(result).toBe(VALID_UUID);
    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith("create_user_with_tenant", {
      p_email: "existing@hearstcorporation.io",
    });
  });

  // -------------------------------------------------------------------
  // Cas 2 : nouveau user signup → RPC crée user + tenant + lien
  // La RPC retourne l'UUID du nouveau user (tenant créé en interne)
  // -------------------------------------------------------------------
  it("retourne l'UUID pour un nouveau user et déclenche la création de tenant via RPC", async () => {
    // La RPC retourne directement l'uuid user (tenant créé en interne côté DB)
    mockRpc.mockResolvedValueOnce({ data: TENANT_UUID, error: null });
    mockGetServerSupabase.mockReturnValue(makeSupabaseMock(mockRpc));

    const { resolveOrCreateUserUuid } = await import("@/lib/platform/auth/user-resolver");

    const result = await resolveOrCreateUserUuid("nouveau@hearstcorporation.io");

    expect(result).toBe(TENANT_UUID);
    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith("create_user_with_tenant", {
      p_email: "nouveau@hearstcorporation.io",
    });
  });

  // -------------------------------------------------------------------
  // Cas 3 : la RPC échoue (ex: DB unreachable, NOT NULL violated, etc.)
  // → doit retourner null et logger l'erreur
  // -------------------------------------------------------------------
  it("retourne null si la RPC échoue et logue l'erreur", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "connection refused" },
    });
    mockGetServerSupabase.mockReturnValue(makeSupabaseMock(mockRpc));

    const { resolveOrCreateUserUuid } = await import("@/lib/platform/auth/user-resolver");

    const result = await resolveOrCreateUserUuid("fail@hearstcorporation.io");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[UserResolver] rpc create_user_with_tenant failed:"),
      "connection refused",
    );
  });

  // -------------------------------------------------------------------
  // Cas 4 : email vide → court-circuit immédiat, pas d'appel Supabase
  // -------------------------------------------------------------------
  it("retourne null immédiatement si email vide", async () => {
    mockGetServerSupabase.mockReturnValue(makeSupabaseMock(mockRpc));

    const { resolveOrCreateUserUuid } = await import("@/lib/platform/auth/user-resolver");

    const result = await resolveOrCreateUserUuid("");

    expect(result).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------
  // Cas 5 : service role non configuré (env manquant en dev/CI)
  // → warn + retourne null, pas d'appel RPC
  // -------------------------------------------------------------------
  it("retourne null et warn si Supabase service role non configuré", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetServerSupabase.mockReturnValue(null);

    const { resolveOrCreateUserUuid } = await import("@/lib/platform/auth/user-resolver");

    const result = await resolveOrCreateUserUuid("adrien@hearstcorporation.io");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[UserResolver] Supabase service role not configured"),
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------
  // Cas 6 : RPC retourne data=null sans error (edge case inattendu)
  // → doit retourner null
  // -------------------------------------------------------------------
  it("retourne null si la RPC retourne data=null sans error", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    mockGetServerSupabase.mockReturnValue(makeSupabaseMock(mockRpc));

    const { resolveOrCreateUserUuid } = await import("@/lib/platform/auth/user-resolver");

    const result = await resolveOrCreateUserUuid("edge@hearstcorporation.io");

    expect(result).toBeNull();
  });
});
