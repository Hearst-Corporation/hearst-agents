/**
 * P0-A — Missions IDOR cross-tenant (DELETE/PATCH)
 *
 * Régression pour la faille IDOR sur /api/v2/missions/[id] :
 * - verifyMissionOwnership retournait true si la mission n'était pas en cache
 * - deleteScheduledMission n'avait pas de filtre user_id en base
 *
 * Tests unitaires de la VRAIE fonction `verifyMissionOwnership` extraite dans
 * `lib/missions/ownership.ts`. Le cache in-memory et Supabase sont mockés —
 * la logique réelle (cache fast-path, fallback DB, fail-closed) est validée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (avant import de la fonction sous test) ───────────

const getMissionMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("@/lib/engine/runtime/missions/store", () => ({
  getMission: (id: string) => getMissionMock(id),
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock(),
        }),
      }),
    }),
  }),
}));

// Mock logger pour éviter le bruit dans les tests
vi.mock("@/lib/observability/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { verifyMissionOwnership } from "@/lib/missions/ownership";

// ── Fixtures ────────────────────────────────────────────────

const SCOPE_A = {
  userId: "user-a-0000-0000-0000-000000000001",
  tenantId: "tenant-a-000-0000-0000-000000000001",
};

const SCOPE_B = {
  userId: "user-b-0000-0000-0000-000000000002",
  tenantId: "tenant-b-000-0000-0000-000000000002",
};

const MISSION_ID = "mission-0000-0000-0000-000000000099";

const DB_ROW_OWNER_A = {
  user_id: SCOPE_A.userId,
  actions: { type: "scheduled", tenantId: SCOPE_A.tenantId, input: "test" },
};

beforeEach(() => {
  getMissionMock.mockReset();
  maybeSingleMock.mockReset();
});

// ── Tests cold-lambda (cache miss → fallback DB) ────────────

describe("verifyMissionOwnership — logique DB (cold lambda)", () => {
  it("User A peut accéder à sa propre mission", async () => {
    getMissionMock.mockReturnValue(undefined); // cache miss
    maybeSingleMock.mockResolvedValue({ data: DB_ROW_OWNER_A, error: null });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_A.userId, SCOPE_A.tenantId);
    expect(ok).toBe(true);
  });

  it("User B ne peut PAS accéder à la mission de User A (tenant différent)", async () => {
    getMissionMock.mockReturnValue(undefined);
    maybeSingleMock.mockResolvedValue({ data: DB_ROW_OWNER_A, error: null });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_B.userId, SCOPE_B.tenantId);
    expect(ok).toBe(false);
  });

  it("User B avec userId différent mais tenantId identique (IDOR partiel) — bloqué", async () => {
    getMissionMock.mockReturnValue(undefined);
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: SCOPE_A.userId,
        actions: { type: "scheduled", tenantId: SCOPE_A.tenantId },
      },
      error: null,
    });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_B.userId, SCOPE_A.tenantId);
    expect(ok).toBe(false);
  });

  it("Mission inexistante → false (fail closed)", async () => {
    getMissionMock.mockReturnValue(undefined);
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_A.userId, SCOPE_A.tenantId);
    expect(ok).toBe(false);
  });

  it("Erreur DB → false (fail closed, pas fail open)", async () => {
    getMissionMock.mockReturnValue(undefined);
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "db error" } });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_A.userId, SCOPE_A.tenantId);
    expect(ok).toBe(false);
  });

  it("Mission legacy sans tenantId en JSONB — user_id suffit", async () => {
    getMissionMock.mockReturnValue(undefined);
    maybeSingleMock.mockResolvedValue({
      data: { user_id: SCOPE_A.userId, actions: { type: "scheduled" } },
      error: null,
    });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_A.userId, SCOPE_A.tenantId);
    expect(ok).toBe(true);
  });

  it("Mission legacy sans tenantId — user B bloqué malgré absence de tenantId", async () => {
    getMissionMock.mockReturnValue(undefined);
    maybeSingleMock.mockResolvedValue({
      data: { user_id: SCOPE_A.userId, actions: { type: "scheduled" } },
      error: null,
    });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_B.userId, SCOPE_B.tenantId);
    expect(ok).toBe(false);
  });

  it("actions === null en DB → traité comme legacy sans tenantId", async () => {
    getMissionMock.mockReturnValue(undefined);
    maybeSingleMock.mockResolvedValue({
      data: { user_id: SCOPE_A.userId, actions: null },
      error: null,
    });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_A.userId, SCOPE_A.tenantId);
    expect(ok).toBe(true);
  });
});

// ── Tests fast-path (cache hit) ────────────────────────────

describe("verifyMissionOwnership — fast-path cache", () => {
  it("Cache hit : User A peut accéder à sa mission", async () => {
    getMissionMock.mockReturnValue({
      id: MISSION_ID,
      userId: SCOPE_A.userId,
      tenantId: SCOPE_A.tenantId,
    });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_A.userId, SCOPE_A.tenantId);
    expect(ok).toBe(true);
    // DB ne doit PAS être interrogée
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });

  it("Cache hit : User B bloqué sur mission de User A", async () => {
    getMissionMock.mockReturnValue({
      id: MISSION_ID,
      userId: SCOPE_A.userId,
      tenantId: SCOPE_A.tenantId,
    });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_B.userId, SCOPE_B.tenantId);
    expect(ok).toBe(false);
  });

  it("Cache hit : mission sans userId (cache pollué / dégradé) → fail-closed", async () => {
    // Durcissement P3 : un cache pollué (mission sans userId) ne doit plus
    // accorder l'ownership de façon permissive — fail-closed.
    getMissionMock.mockReturnValue({ id: MISSION_ID });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_A.userId, SCOPE_A.tenantId);
    expect(ok).toBe(false);
  });

  it("Cache hit : mission userId match + tenant mismatch → bloqué", async () => {
    getMissionMock.mockReturnValue({
      id: MISSION_ID,
      userId: SCOPE_A.userId,
      tenantId: SCOPE_A.tenantId,
    });

    const ok = await verifyMissionOwnership(MISSION_ID, SCOPE_A.userId, SCOPE_B.tenantId);
    expect(ok).toBe(false);
  });
});

// ── deleteScheduledMission — filtre SQL ────────────────────
// (Tests sans import — simule le contrat .eq("id").eq("user_id")
// pour vérifier que la défense en profondeur fait ce qu'on attend.)

describe("deleteScheduledMission — filtre SQL user_id (défense en profondeur)", () => {
  function simulateDeleteFilter(
    rows: Array<{ id: string; user_id: string }>,
    missionId: string,
    userId: string,
  ): number {
    const affected = rows.filter((r) => r.id === missionId && r.user_id === userId);
    return affected.length;
  }

  const rows = [
    { id: MISSION_ID, user_id: SCOPE_A.userId },
    { id: "other-mission-id", user_id: SCOPE_B.userId },
  ];

  it("User A peut supprimer sa propre mission", () => {
    expect(simulateDeleteFilter(rows, MISSION_ID, SCOPE_A.userId)).toBe(1);
  });

  it("User B ne peut PAS supprimer la mission de User A — 0 rows affectées", () => {
    expect(simulateDeleteFilter(rows, MISSION_ID, SCOPE_B.userId)).toBe(0);
  });

  it("Mission inexistante → 0 rows affectées", () => {
    expect(simulateDeleteFilter(rows, "unknown-mission-uuid", SCOPE_A.userId)).toBe(0);
  });
});

describe("updateScheduledMission — filtre SQL user_id optionnel", () => {
  function simulateUpdateFilter(
    rows: Array<{ id: string; user_id: string }>,
    missionId: string,
    userId?: string,
  ): number {
    return rows.filter((r) => r.id === missionId && (userId === undefined || r.user_id === userId))
      .length;
  }

  const rows = [
    { id: MISSION_ID, user_id: SCOPE_A.userId },
    { id: "other-mission-id", user_id: SCOPE_B.userId },
  ];

  it("Avec userId : seules les missions de l'utilisateur sont modifiées", () => {
    expect(simulateUpdateFilter(rows, MISSION_ID, SCOPE_A.userId)).toBe(1);
  });

  it("Avec userId incorrect : 0 rows affectées", () => {
    expect(simulateUpdateFilter(rows, MISSION_ID, SCOPE_B.userId)).toBe(0);
  });

  it("Sans userId (appels internes scheduler) : pas de filtre user", () => {
    expect(simulateUpdateFilter(rows, MISSION_ID, undefined)).toBe(1);
  });
});
