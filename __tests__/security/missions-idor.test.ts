/**
 * P0-A — Missions IDOR cross-tenant (DELETE/PATCH)
 *
 * Régression pour la faille IDOR sur /api/v2/missions/[id] :
 * - verifyMissionOwnership retournait true si la mission n'était pas en cache
 * - deleteScheduledMission n'avait pas de filtre user_id en base
 *
 * Tests unitaires :
 *  - VRAIE fonction `verifyMissionOwnership` (lib/missions/ownership.ts)
 *  - VRAIES fonctions `deleteScheduledMission` / `updateScheduledMission`
 *    (lib/engine/runtime/state/adapter.ts) — on mocke le client Supabase et
 *    on intercepte la query chain pour asserter que `.eq("user_id", …)` est
 *    bien posé (défense en profondeur niveau DB).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (avant import de la fonction sous test) ───────────

const getMissionMock = vi.fn();
const maybeSingleMock = vi.fn();
const getServerSupabaseMock = vi.fn();

vi.mock("@/lib/engine/runtime/missions/store", () => ({
  getMission: (id: string) => getMissionMock(id),
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: () => getServerSupabaseMock(),
}));

// Mock logger pour éviter le bruit dans les tests
vi.mock("@/lib/observability/logger", () => {
  const childLogger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  childLogger.child.mockReturnValue(childLogger);
  return {
    logger: childLogger,
    redactedError: (err: unknown) => ({
      message: err instanceof Error ? err.message : String(err),
    }),
  };
});

import { deleteScheduledMission, updateScheduledMission } from "@/lib/engine/runtime/state/adapter";
import { verifyMissionOwnership } from "@/lib/missions/ownership";

/**
 * Helper : construit un client Supabase factice où `.from(table).select(...).eq(...).maybeSingle()`
 * retourne la valeur attendue par les tests de `verifyMissionOwnership`.
 *
 * Pour les autres méthodes (delete, update), on délègue à un constructeur
 * dédié dans chaque suite.
 */
function makeOwnershipClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock(),
        }),
      }),
    }),
  };
}

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
  getServerSupabaseMock.mockReset();
  // Par défaut, le client expose la chaîne d'ownership (select/eq/maybeSingle).
  // Les suites delete/update overrident via getServerSupabaseMock.mockReturnValue.
  getServerSupabaseMock.mockReturnValue(makeOwnershipClient());
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

// ── deleteScheduledMission — VRAIE fonction (filtre SQL user_id) ─────────
//
// Mock la chaîne `sb.from("missions").delete({ count }).eq("id", ...).eq("user_id", ...)`.
// On capture chaque appel `.eq(col, val)` et on simule l'exécution à la fin du
// builder en filtrant un tableau de rows. Cela atteste que la vraie fonction
// pose bien le filtre user_id en plus du filtre id (défense en profondeur DB).

interface DeleteBuilderCalls {
  table?: string;
  deleteOptions?: { count?: string };
  eqCalls: Array<[string, unknown]>;
}

function makeDeleteClient(rows: Array<{ id: string; user_id: string }>) {
  const calls: DeleteBuilderCalls = { eqCalls: [] };

  function executeDelete() {
    let filtered = rows;
    for (const [col, val] of calls.eqCalls) {
      filtered = filtered.filter((r) => {
        if (col === "id") return r.id === val;
        if (col === "user_id") return r.user_id === val;
        return true;
      });
    }
    return { error: null, count: filtered.length };
  }

  const deleteBuilder = {
    eq(col: string, val: unknown) {
      calls.eqCalls.push([col, val]);
      return this;
    },
    then<TResult1, TResult2>(
      onfulfilled?: (value: { error: null; count: number }) => TResult1 | PromiseLike<TResult1>,
      onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
    ) {
      return Promise.resolve(executeDelete()).then(onfulfilled, onrejected);
    },
  };

  const client = {
    from(table: string) {
      calls.table = table;
      return {
        delete(options?: { count?: string }) {
          calls.deleteOptions = options;
          return deleteBuilder;
        },
      };
    },
  };

  return { client, calls };
}

describe("deleteScheduledMission — filtre SQL user_id (défense en profondeur)", () => {
  const rows = [
    { id: MISSION_ID, user_id: SCOPE_A.userId },
    { id: "other-mission-id", user_id: SCOPE_B.userId },
  ];

  it("User A peut supprimer sa propre mission → 1 row affectée", async () => {
    const { client, calls } = makeDeleteClient(rows);
    getServerSupabaseMock.mockReturnValue(client);

    const result = await deleteScheduledMission(MISSION_ID, SCOPE_A.userId);

    expect(result.ok).toBe(true);
    expect(result.deletedCount).toBe(1);
    // Atteste la défense en profondeur : la requête filtre par id ET user_id
    expect(calls.table).toBe("missions");
    expect(calls.deleteOptions).toEqual({ count: "exact" });
    expect(calls.eqCalls).toContainEqual(["id", MISSION_ID]);
    expect(calls.eqCalls).toContainEqual(["user_id", SCOPE_A.userId]);
  });

  it("User B ne peut PAS supprimer la mission de User A — 0 rows affectées", async () => {
    const { client, calls } = makeDeleteClient(rows);
    getServerSupabaseMock.mockReturnValue(client);

    const result = await deleteScheduledMission(MISSION_ID, SCOPE_B.userId);

    expect(result.ok).toBe(true);
    expect(result.deletedCount).toBe(0);
    expect(calls.eqCalls).toContainEqual(["user_id", SCOPE_B.userId]);
  });

  it("Mission inexistante → 0 rows affectées", async () => {
    const { client } = makeDeleteClient(rows);
    getServerSupabaseMock.mockReturnValue(client);

    const result = await deleteScheduledMission("unknown-mission-uuid", SCOPE_A.userId);

    expect(result.ok).toBe(true);
    expect(result.deletedCount).toBe(0);
  });

  it("Pas de client Supabase → ok=false (fail-soft)", async () => {
    getServerSupabaseMock.mockReturnValue(null);

    const result = await deleteScheduledMission(MISSION_ID, SCOPE_A.userId);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_supabase_client");
  });
});

// ── updateScheduledMission — VRAIE fonction (filtre user_id optionnel) ───
//
// Mock la chaîne `sb.from("missions").update(patch).eq("id", ...).eq("user_id", ...)`.
// On capture chaque appel `.eq()` pour vérifier que `user_id` est posé
// quand l'appelant le passe, et omis sinon (appels internes scheduler).
// Cas testé : patch.enabled — pas de hasOpsFields, donc pas de select() préalable.

interface UpdateBuilderCalls {
  table?: string;
  updatePatch?: Record<string, unknown>;
  eqCalls: Array<[string, unknown]>;
}

function makeUpdateClient() {
  const calls: UpdateBuilderCalls = { eqCalls: [] };

  const updateBuilder = {
    eq(col: string, val: unknown) {
      calls.eqCalls.push([col, val]);
      return this;
    },
    then<TResult1, TResult2>(
      onfulfilled?: (value: { error: null }) => TResult1 | PromiseLike<TResult1>,
      onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
    ) {
      return Promise.resolve({ error: null }).then(onfulfilled, onrejected);
    },
  };

  const client = {
    from(table: string) {
      calls.table = table;
      return {
        update(patch: Record<string, unknown>) {
          calls.updatePatch = patch;
          return updateBuilder;
        },
      };
    },
  };

  return { client, calls };
}

describe("updateScheduledMission — filtre SQL user_id optionnel", () => {
  it("Avec userId : filtre par id ET user_id (défense en profondeur)", async () => {
    const { client, calls } = makeUpdateClient();
    getServerSupabaseMock.mockReturnValue(client);

    const ok = await updateScheduledMission(MISSION_ID, { enabled: true }, SCOPE_A.userId);

    expect(ok).toBe(true);
    expect(calls.table).toBe("missions");
    expect(calls.eqCalls).toContainEqual(["id", MISSION_ID]);
    expect(calls.eqCalls).toContainEqual(["user_id", SCOPE_A.userId]);
  });

  it("Avec userId d'un autre user : le filtre SQL est posé, la DB renverra 0 rows", async () => {
    const { client, calls } = makeUpdateClient();
    getServerSupabaseMock.mockReturnValue(client);

    await updateScheduledMission(MISSION_ID, { enabled: false }, SCOPE_B.userId);

    // L'attaquant B ne peut pas modifier la mission de A : le filtre user_id
    // est bien posé avec SCOPE_B → 0 rows affectées côté Postgres.
    expect(calls.eqCalls).toContainEqual(["user_id", SCOPE_B.userId]);
    expect(calls.eqCalls).toContainEqual(["id", MISSION_ID]);
  });

  it("Sans userId (appels internes scheduler) : seul le filtre id est posé", async () => {
    const { client, calls } = makeUpdateClient();
    getServerSupabaseMock.mockReturnValue(client);

    const ok = await updateScheduledMission(MISSION_ID, { enabled: true });

    expect(ok).toBe(true);
    expect(calls.eqCalls).toContainEqual(["id", MISSION_ID]);
    expect(calls.eqCalls.some(([col]) => col === "user_id")).toBe(false);
  });
});
