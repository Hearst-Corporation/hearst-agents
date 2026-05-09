/**
 * Tests e2e auth — get-user-id.ts + scope.ts
 *
 * Invariants couverts :
 *   1. DEV bypass → getUserId retourne l'UUID fixe (pas un email)
 *   2. Session avec user.id (UUID) → getUserId retourne ce UUID
 *   3. Pas de session → getUserId retourne null
 *   4. requireScope avec getUserId() = null → { scope: null, error: { status: 401 } }
 *   5. requireScope avec userId résolu → { scope: { userId, ... }, error: null }
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks hoisted ─────────────────────────────────────────────────────────
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/platform/auth/options", () => ({
  authOptions: {},
}));

// ── Constants ─────────────────────────────────────────────────────────────
const VALID_UUID = "36914162-75f9-4c27-b38b-bb050f51d52b";
const ENV_BACKUP = process.env.HEARST_DEV_AUTH_BYPASS;
const ENV_BACKUP_TENANT = process.env.HEARST_TENANT_ID;
const ENV_BACKUP_WORKSPACE = process.env.HEARST_WORKSPACE_ID;

// ── getUserId ─────────────────────────────────────────────────────────────

describe("getUserId", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetServerSession.mockReset();
    delete process.env.HEARST_DEV_AUTH_BYPASS;
  });

  afterEach(() => {
    if (ENV_BACKUP === undefined) delete process.env.HEARST_DEV_AUTH_BYPASS;
    else process.env.HEARST_DEV_AUTH_BYPASS = ENV_BACKUP;
  });

  it("DEV_BYPASS=1 → retourne l'UUID (pas un email, pas un appel à getServerSession)", async () => {
    process.env.HEARST_DEV_AUTH_BYPASS = "1";
    const { getUserId } = await import("@/lib/platform/auth/get-user-id");
    const result = await getUserId();

    expect(result).toBe(VALID_UUID);
    // UUID format
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    // Pas un email
    expect(result).not.toMatch(/@/);
    // Pas d'appel à NextAuth
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it("session avec user.id UUID défini → retourne ce UUID", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: VALID_UUID, email: "adrien@hearst.io" },
    });
    const { getUserId } = await import("@/lib/platform/auth/get-user-id");
    const result = await getUserId();
    expect(result).toBe(VALID_UUID);
  });

  it("pas de session → retourne null", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { getUserId } = await import("@/lib/platform/auth/get-user-id");
    const result = await getUserId();
    expect(result).toBeNull();
  });
});

// ── requireScope ──────────────────────────────────────────────────────────

describe("requireScope", () => {
  beforeEach(() => {
    vi.resetModules();
    // Isole les tests sur userId uniquement (tenant/workspace résolus via env)
    process.env.HEARST_TENANT_ID = "test-tenant";
    process.env.HEARST_WORKSPACE_ID = "test-workspace";
  });

  afterEach(() => {
    if (ENV_BACKUP_TENANT === undefined) delete process.env.HEARST_TENANT_ID;
    else process.env.HEARST_TENANT_ID = ENV_BACKUP_TENANT;

    if (ENV_BACKUP_WORKSPACE === undefined) delete process.env.HEARST_WORKSPACE_ID;
    else process.env.HEARST_WORKSPACE_ID = ENV_BACKUP_WORKSPACE;
  });

  it("getUserId() = null → { scope: null, error: { status: 401 } }", async () => {
    // Mock get-user-id dans ce module-level block via doMock
    vi.doMock("@/lib/platform/auth/get-user-id", () => ({
      getUserId: vi.fn().mockResolvedValueOnce(null),
    }));

    const { requireScope } = await import("@/lib/platform/auth/scope");
    const result = await requireScope({ context: "test-e2e" });

    expect(result.scope).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(401);
    expect(result.error?.message).toBe("not_authenticated");
  });

  it("getUserId() résolu → { scope: { userId }, error: null }", async () => {
    vi.doMock("@/lib/platform/auth/get-user-id", () => ({
      getUserId: vi.fn().mockResolvedValueOnce(VALID_UUID),
    }));

    const { requireScope } = await import("@/lib/platform/auth/scope");
    const result = await requireScope({ context: "test-e2e" });

    expect(result.error).toBeNull();
    expect(result.scope).not.toBeNull();
    expect(result.scope?.userId).toBe(VALID_UUID);
    // UUID, pas email
    expect(result.scope?.userId).toMatch(/^[0-9a-f]{8}-/i);
    expect(result.scope?.userId).not.toMatch(/@/);
  });
});
