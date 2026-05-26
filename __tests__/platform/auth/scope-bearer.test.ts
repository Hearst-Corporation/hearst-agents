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
