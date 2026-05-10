/**
 * F-095 — resolveScope multi-tenant isolation
 *
 * Vérifie que resolveScope() lit session.user.tenantId (chargé depuis DB)
 * plutôt que process.env, et applique fail-closed en production.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserId = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform/auth/get-user-id", () => ({
  getUserId: mockGetUserId,
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

// authOptions mock minimal — resolveScope l'importe juste comme paramètre
vi.mock("@/lib/platform/auth/options", () => ({
  authOptions: {},
}));

const VALID_UUID = "36914162-75f9-4c27-b38b-bb050f51d52b";
const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WORKSPACE_A = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeSession(tenantId?: string, workspaceId?: string) {
  return {
    user: {
      id: VALID_UUID,
      email: "adrien@hearstcorporation.io",
      tenantId,
      workspaceId,
    },
    tenantId,
    workspaceId,
    expires: "2099-01-01",
  };
}

describe("F-095 — resolveScope multi-tenant (source: session JWT, pas env)", () => {
  const ENV_TENANT = process.env.HEARST_TENANT_ID;
  const ENV_WORKSPACE = process.env.HEARST_WORKSPACE_ID;

  beforeEach(() => {
    vi.resetModules();
    mockGetUserId.mockReset();
    mockGetServerSession.mockReset();
    // Assurer que userId est toujours résolu par défaut
    mockGetUserId.mockResolvedValue(VALID_UUID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (ENV_TENANT === undefined) delete process.env.HEARST_TENANT_ID;
    else process.env.HEARST_TENANT_ID = ENV_TENANT;
    if (ENV_WORKSPACE === undefined) delete process.env.HEARST_WORKSPACE_ID;
    else process.env.HEARST_WORKSPACE_ID = ENV_WORKSPACE;
  });

  describe("session avec tenantId hydraté (cas nominal)", () => {
    it("retourne le tenantId de la session, pas depuis process.env", async () => {
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_A, WORKSPACE_A));
      process.env.HEARST_TENANT_ID = "env-tenant-should-NOT-be-used";
      process.env.HEARST_WORKSPACE_ID = "env-workspace-should-NOT-be-used";

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "test" });

      expect(scope).not.toBeNull();
      expect(scope?.tenantId).toBe(TENANT_A);
      expect(scope?.tenantId).not.toBe("env-tenant-should-NOT-be-used");
    });

    it("retourne le workspaceId de la session", async () => {
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_A, WORKSPACE_A));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "test" });

      expect(scope?.workspaceId).toBe(WORKSPACE_A);
    });

    it("isDevFallback = false quand session a tenantId", async () => {
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_A, WORKSPACE_A));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "test" });

      expect(scope?.isDevFallback).toBe(false);
    });
  });

  describe("production — session sans tenantId → fail-closed", () => {
    it("retourne null si session.tenantId absent en prod", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "test-prod" });

      expect(scope).toBeNull();
    });

    it("requireScope retourne 401 si session.tenantId absent en prod", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { requireScope } = await import("@/lib/platform/auth/scope");
      const result = await requireScope({ context: "test-prod" });

      expect(result.scope).toBeNull();
      expect(result.error?.status).toBe(401);
    });

    it("retourne null même si HEARST_TENANT_ID env est set en prod", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("HEARST_TENANT_ID", "legacy-env-tenant");
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "test-prod" });

      // En prod fail-closed : pas de fallback env
      expect(scope).toBeNull();
    });
  });

  describe("development — session sans tenantId → fallback env bruyant", () => {
    it("fallback sur HEARST_TENANT_ID env en dev", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("HEARST_TENANT_ID", "dev-env-tenant");
      vi.stubEnv("HEARST_WORKSPACE_ID", "dev-env-workspace");
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "test-dev" });

      expect(scope).not.toBeNull();
      expect(scope?.tenantId).toBe("dev-env-tenant");
      expect(scope?.isDevFallback).toBe(true);
    });

    it("fallback sur constante DEV_TENANT_ID si env absent en dev", async () => {
      vi.stubEnv("NODE_ENV", "development");
      delete process.env.HEARST_TENANT_ID;
      delete process.env.HEARST_WORKSPACE_ID;
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "test-dev-fallback" });

      expect(scope).not.toBeNull();
      expect(scope?.tenantId).toBe("dev-tenant");
      expect(scope?.isDevFallback).toBe(true);
    });
  });

  describe("session null (non authentifié)", () => {
    it("retourne null si pas de session du tout", async () => {
      mockGetUserId.mockResolvedValue(null);
      mockGetServerSession.mockResolvedValue(null);

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "test" });

      expect(scope).toBeNull();
    });
  });
});
