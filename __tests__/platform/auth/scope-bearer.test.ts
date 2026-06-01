/**
 * F1a.1 — Tests early-return Bearer hsk_* dans resolveScope.
 *
 * Vérifie que :
 *   1. Bearer hsk_ valide → scope service avec userId/tenantId/workspaceId
 *   2. Bearer hsk_ avec user_id null → reject (null, log warn)
 *   3. Bearer hsk_ invalide ou révoquée → fall-through au flow NextAuth
 *   4. Bearer non-hsk_ format → fall-through au flow NextAuth
 *   5. Pas d'header Authorization → fall-through silencieux
 *   6. headers() throw → fall-through silencieux (Edge static safe)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockHeaders = vi.hoisted(() => vi.fn());
const mockVerifyApiKey = vi.hoisted(() => vi.fn());
const mockGetUserId = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/lib/platform/auth/api-key", () => ({
  API_KEY_PREFIX: "hsk_",
  verifyApiKey: mockVerifyApiKey,
}));

vi.mock("@/lib/platform/auth/get-user-id", () => ({
  getUserId: mockGetUserId,
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/platform/auth/options", () => ({
  authOptions: {},
}));

const TENANT_ID = "d10c9c22-2432-4daa-b4f2-ab849a87dfae";
const OWNER_USER_ID = "36914162-75f9-4c27-b38b-bb050f51d52b";
const VALID_RAW_KEY = `hsk_${"a".repeat(64)}`;

function headersListMock(authValue: string | null) {
  return {
    get: vi.fn((name: string) => (name.toLowerCase() === "authorization" ? authValue : null)),
  };
}

beforeEach(() => {
  vi.resetModules();
  mockHeaders.mockReset();
  mockVerifyApiKey.mockReset();
  mockGetUserId.mockReset();
  mockGetServerSession.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveScope — Bearer hsk_* early-return", () => {
  it("Bearer hsk_ valide → scope service (userId/tenantId/workspaceId depuis api_keys)", async () => {
    mockHeaders.mockResolvedValue(headersListMock(`Bearer ${VALID_RAW_KEY}`));
    mockVerifyApiKey.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: OWNER_USER_ID,
      scopes: ["read", "write"],
    });

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-bearer-valid" });

    expect(scope).toEqual({
      userId: OWNER_USER_ID,
      tenantId: TENANT_ID,
      workspaceId: TENANT_ID,
      isDevFallback: false,
      isServiceAccount: true,
    });
    expect(mockVerifyApiKey).toHaveBeenCalledWith(VALID_RAW_KEY);
    expect(mockGetUserId).not.toHaveBeenCalled();
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it("Bearer hsk_ valide mais user_id null → return null (rejected)", async () => {
    mockHeaders.mockResolvedValue(headersListMock(`Bearer ${VALID_RAW_KEY}`));
    mockVerifyApiKey.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: null,
      scopes: ["read"],
    });

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-bearer-no-user" });

    expect(scope).toBeNull();
    expect(mockGetUserId).not.toHaveBeenCalled();
  });

  it("Bearer hsk_ invalide/révoquée → reject sans fall-through (sécu : pas de retombée cookie)", async () => {
    mockHeaders.mockResolvedValue(headersListMock(`Bearer ${VALID_RAW_KEY}`));
    mockVerifyApiKey.mockResolvedValue(null);

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-bearer-invalid" });

    expect(scope).toBeNull();
    expect(mockVerifyApiKey).toHaveBeenCalled();
    expect(mockGetUserId).not.toHaveBeenCalled();
  });

  it("Bearer non-hsk_ format → fall-through (verifyApiKey jamais appelé)", async () => {
    mockHeaders.mockResolvedValue(headersListMock("Bearer some-other-token"));
    mockGetUserId.mockResolvedValue(null);

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-bearer-non-hsk" });

    expect(scope).toBeNull();
    expect(mockVerifyApiKey).not.toHaveBeenCalled();
    expect(mockGetUserId).toHaveBeenCalled();
  });

  it("Pas d'header Authorization → fall-through silencieux", async () => {
    mockHeaders.mockResolvedValue(headersListMock(null));
    mockGetUserId.mockResolvedValue(null);

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-no-auth" });

    expect(scope).toBeNull();
    expect(mockVerifyApiKey).not.toHaveBeenCalled();
    expect(mockGetUserId).toHaveBeenCalled();
  });

  it("headers() throw (Edge static context) → fall-through silencieux", async () => {
    mockHeaders.mockRejectedValue(new Error("headers() called out of Request context"));
    mockGetUserId.mockResolvedValue(null);

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-headers-throw" });

    expect(scope).toBeNull();
    expect(mockVerifyApiKey).not.toHaveBeenCalled();
    expect(mockGetUserId).toHaveBeenCalled();
  });

  it("Bearer hsk_ valide cohabite avec session NextAuth — Bearer prioritaire", async () => {
    mockHeaders.mockResolvedValue(headersListMock(`Bearer ${VALID_RAW_KEY}`));
    mockVerifyApiKey.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: OWNER_USER_ID,
      scopes: ["read", "write"],
    });
    // Session NextAuth présente — mais ne doit PAS être consultée
    mockGetUserId.mockResolvedValue("other-user-id-from-cookie");
    mockGetServerSession.mockResolvedValue({
      user: { id: "other-user-id-from-cookie", tenantId: "other-tenant" },
    });

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-bearer-priority" });

    expect(scope?.userId).toBe(OWNER_USER_ID);
    expect(scope?.tenantId).toBe(TENANT_ID);
    expect(mockGetUserId).not.toHaveBeenCalled();
  });
});

// ─── Impersonation Hive ───────────────────────────────────────────────────────

const HIVE_USER_ID = "11111111-2222-3333-4444-555555555555";
const HIVE_TENANT_ID = "99999999-8888-7777-6666-555555555555";

/** headers list mock qui répond aussi aux headers x-hive-*. */
function hiveHeadersMock(opts: {
  auth: string | null;
  hiveUserId?: string | null;
  hiveTenantId?: string | null;
}) {
  return {
    get: vi.fn((name: string) => {
      const n = name.toLowerCase();
      if (n === "authorization") return opts.auth;
      if (n === "x-hive-user-id") return opts.hiveUserId ?? null;
      if (n === "x-hive-tenant-id") return opts.hiveTenantId ?? null;
      return null;
    }),
  };
}

describe("resolveScope — impersonation Hive (Bearer hsk_* scope=impersonate)", () => {
  it("scope=impersonate + headers Hive valides → identité Hive + composioEntityId + impersonatedBy", async () => {
    mockHeaders.mockResolvedValue(
      hiveHeadersMock({
        auth: `Bearer ${VALID_RAW_KEY}`,
        hiveUserId: HIVE_USER_ID,
        hiveTenantId: HIVE_TENANT_ID,
      }),
    );
    mockVerifyApiKey.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: OWNER_USER_ID,
      scopes: ["read", "impersonate"],
    });

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-impersonate-ok" });

    expect(scope).toEqual({
      userId: HIVE_USER_ID,
      tenantId: HIVE_TENANT_ID,
      workspaceId: HIVE_TENANT_ID,
      composioEntityId: `hive:${HIVE_TENANT_ID}`,
      impersonatedBy: OWNER_USER_ID,
      isDevFallback: false,
      isServiceAccount: true,
    });
    // Aucun fall-through session
    expect(mockGetUserId).not.toHaveBeenCalled();
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it("token SANS scope impersonate → headers Hive ignorés, comportement service inchangé", async () => {
    // Headers Hive présents mais la clé ne porte PAS le scope impersonate :
    // ils doivent être totalement ignorés, scope = clé (pas composioEntityId).
    mockHeaders.mockResolvedValue(
      hiveHeadersMock({
        auth: `Bearer ${VALID_RAW_KEY}`,
        hiveUserId: HIVE_USER_ID,
        hiveTenantId: HIVE_TENANT_ID,
      }),
    );
    mockVerifyApiKey.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: OWNER_USER_ID,
      scopes: ["read", "write"],
    });

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-no-impersonate-scope" });

    expect(scope).toEqual({
      userId: OWNER_USER_ID,
      tenantId: TENANT_ID,
      workspaceId: TENANT_ID,
      isDevFallback: false,
      isServiceAccount: true,
    });
    expect(scope?.composioEntityId).toBeUndefined();
    expect(scope?.impersonatedBy).toBeUndefined();
  });

  it("scope=impersonate + x-hive-user-id manquant → reject (null), pas de fall-through", async () => {
    mockHeaders.mockResolvedValue(
      hiveHeadersMock({
        auth: `Bearer ${VALID_RAW_KEY}`,
        hiveUserId: null,
        hiveTenantId: HIVE_TENANT_ID,
      }),
    );
    mockVerifyApiKey.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: OWNER_USER_ID,
      scopes: ["impersonate"],
    });
    mockGetUserId.mockResolvedValue("cookie-user");

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-impersonate-missing-user" });

    expect(scope).toBeNull();
    // Sécu : aucun fall-through cookie/session
    expect(mockGetUserId).not.toHaveBeenCalled();
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it("scope=impersonate + x-hive-tenant-id manquant → reject (null)", async () => {
    mockHeaders.mockResolvedValue(
      hiveHeadersMock({
        auth: `Bearer ${VALID_RAW_KEY}`,
        hiveUserId: HIVE_USER_ID,
        hiveTenantId: null,
      }),
    );
    mockVerifyApiKey.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: OWNER_USER_ID,
      scopes: ["impersonate"],
    });

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-impersonate-missing-tenant" });

    expect(scope).toBeNull();
    expect(mockGetUserId).not.toHaveBeenCalled();
  });

  it("scope=impersonate + headers Hive vides/whitespace → reject (null)", async () => {
    mockHeaders.mockResolvedValue(
      hiveHeadersMock({
        auth: `Bearer ${VALID_RAW_KEY}`,
        hiveUserId: "   ",
        hiveTenantId: HIVE_TENANT_ID,
      }),
    );
    mockVerifyApiKey.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: OWNER_USER_ID,
      scopes: ["impersonate"],
    });

    const { resolveScope } = await import("@/lib/platform/auth/scope");
    const scope = await resolveScope({ context: "test-impersonate-whitespace" });

    expect(scope).toBeNull();
    expect(mockGetUserId).not.toHaveBeenCalled();
  });
});
