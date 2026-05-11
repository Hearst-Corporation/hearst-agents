/**
 * B1.2 — Admin RBAC
 *
 * F-001 : les routes /api/admin/* doivent retourner 403 pour les non-admins
 *         et autoriser les admins.
 *
 * On teste le helper requireAdmin() directement — pas d'infra HTTP nécessaire.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────

const mockResolveScope = vi.hoisted(() => vi.fn());
const mockCheckPermission = vi.hoisted(() => vi.fn());
const mockGetServerSupabase = vi.hoisted(() => vi.fn());
const mockIsDevBypassEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: mockResolveScope,
}));

vi.mock("@/lib/admin/permissions", () => ({
  checkPermission: mockCheckPermission,
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: mockGetServerSupabase,
}));

vi.mock("@/lib/platform/auth/dev-bypass", () => ({
  isDevBypassEnabled: mockIsDevBypassEnabled,
}));

// Import après les mocks
const { requireAdmin, isError } = await import("@/app/api/admin/_helpers");

const ADMIN_SCOPE = {
  userId: "user-admin-123",
  tenantId: "tenant-123",
  workspaceId: "workspace-123",
  isDevFallback: false,
};

const VIEWER_SCOPE = {
  userId: "user-viewer-456",
  tenantId: "tenant-123",
  workspaceId: "workspace-123",
  isDevFallback: false,
};

const mockDb = {} as import("@supabase/supabase-js").SupabaseClient;

describe("F-001 Admin RBAC — requireAdmin()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDevBypassEnabled.mockReturnValue(false);
    mockGetServerSupabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si l'utilisateur n'est pas authentifié", async () => {
    mockResolveScope.mockResolvedValue({
      scope: null,
      error: { message: "not_authenticated", status: 401 },
    });

    const result = await requireAdmin("test-context", { resource: "settings", action: "admin" });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      const body = await result.json();
      expect(result.status).toBe(401);
      expect(body.error).toBe("not_authenticated");
    }
  });

  it("retourne 403 si l'utilisateur n'a pas le rôle admin", async () => {
    mockResolveScope.mockResolvedValue({ scope: VIEWER_SCOPE, error: null });
    mockCheckPermission.mockResolvedValue(false);

    const result = await requireAdmin("test-context", { resource: "settings", action: "admin" });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.status).toBe(403);
      const body = await result.json();
      expect(body.error).toBe("forbidden");
    }
  });

  it("autorise l'accès si l'utilisateur a le rôle admin", async () => {
    mockResolveScope.mockResolvedValue({ scope: ADMIN_SCOPE, error: null });
    mockCheckPermission.mockResolvedValue(true);

    const result = await requireAdmin("test-context", { resource: "settings", action: "admin" });

    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.scope.userId).toBe(ADMIN_SCOPE.userId);
    }
  });

  it("isError() retourne true pour une NextResponse", async () => {
    mockResolveScope.mockResolvedValue({
      scope: null,
      error: { message: "not_authenticated", status: 401 },
    });

    const result = await requireAdmin("test-context", { resource: "runs", action: "read" });
    expect(isError(result)).toBe(true);
  });

  it("autorise en dev bypass sans vérifier les permissions", async () => {
    mockIsDevBypassEnabled.mockReturnValue(true);
    mockResolveScope.mockResolvedValue({ scope: VIEWER_SCOPE, error: null });
    // checkPermission ne doit pas être appelé

    const result = await requireAdmin("test-context", { resource: "settings", action: "admin" });

    expect(isError(result)).toBe(false);
    expect(mockCheckPermission).not.toHaveBeenCalled();
  });

  it("retourne 503 si la DB est indisponible", async () => {
    mockResolveScope.mockResolvedValue({ scope: ADMIN_SCOPE, error: null });
    mockGetServerSupabase.mockReturnValue(null);

    const result = await requireAdmin("test-context", { resource: "settings", action: "admin" });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.status).toBe(503);
    }
  });
});
