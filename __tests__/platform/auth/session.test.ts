/**
 * F-015 — getCurrentUserId : pas de fallback email comme userId
 *
 * Invariants couverts :
 *   1. session avec userId top-level → retourne userId (UUID)
 *   2. session avec user.id → retourne user.id (UUID)
 *   3. session avec uniquement user.email → retourne null (PAS l'email)
 *   4. session nulle → retourne null
 *   5. dev bypass (HEARST_DEV_AUTH_BYPASS=1) → retourne UUID fixe, jamais email
 *   6. L'email ne filtre jamais comme userId même s'il ressemble à un UUID
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/platform/auth/options", () => ({
  authOptions: {},
}));

const ENV_BYPASS_KEY = "HEARST_DEV_AUTH_BYPASS";
const ENV_BYPASS_BACKUP = process.env[ENV_BYPASS_KEY];
const VALID_UUID = "36914162-75f9-4c27-b38b-bb050f51d52b";
const TEST_UUID = "aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb";

describe("getCurrentUserId — F-015 no email fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetServerSession.mockReset();
    delete process.env[ENV_BYPASS_KEY];
  });

  afterEach(() => {
    if (ENV_BYPASS_BACKUP === undefined) delete process.env[ENV_BYPASS_KEY];
    else process.env[ENV_BYPASS_KEY] = ENV_BYPASS_BACKUP;
  });

  it("session avec userId top-level → retourne le userId (UUID)", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      userId: TEST_UUID,
      user: { email: "adrien@hearstcorporation.io" },
    });
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    expect(result).toBe(TEST_UUID);
    expect(result).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("session avec user.id → retourne user.id (UUID)", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: TEST_UUID, email: "adrien@hearstcorporation.io" },
    });
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    expect(result).toBe(TEST_UUID);
    expect(result).not.toContain("@");
  });

  it("session avec uniquement user.email → retourne null (pas l'email comme userId)", async () => {
    // Cas critique F-015 : si le callback NextAuth n'a pas pu résoudre l'UUID,
    // on NE doit PAS retourner l'email. Le caller doit recevoir null = unauthorized.
    mockGetServerSession.mockResolvedValueOnce({
      user: { email: "adrien@hearstcorporation.io" },
    });
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    expect(result).toBeNull();
    expect(result).not.toBe("adrien@hearstcorporation.io");
  });

  it("session nulle → retourne null", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    expect(result).toBeNull();
  });

  it("dev bypass HEARST_DEV_AUTH_BYPASS=1 → retourne UUID fixe (jamais email)", async () => {
    process.env[ENV_BYPASS_KEY] = "1";
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    expect(result).toBe(VALID_UUID);
    expect(result).not.toContain("@");
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it("priorité : userId top-level > user.id (les deux présents → userId top-level gagne)", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      userId: TEST_UUID,
      user: { id: "11112222-3333-4444-5555-666677778888", email: "other@test.com" },
    });
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    // sessionUserId ?? userIdFromUser : c'est sessionUserId qui gagne
    expect(result).toBe(TEST_UUID);
  });
});
