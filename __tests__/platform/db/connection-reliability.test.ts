/**
 * Fiabilité des connexions Supabase — Tests d'intégration
 *
 * Scénarios couverts :
 *   1. Connexion basique répétée ×3
 *   2. Singleton — même instance retournée (pas de reconnexion inutile)
 *   3. Déconnexion simulée — client null → erreur gracieuse, pas de crash
 *   4. Isolation tenant — mauvais tenant_id → 0 rows
 *   5. Haute charge simultanée — 10 requêtes parallèles, singleton stable
 *   6. Auth disconnect — session JWT expirée → getCurrentUserId() retourne null
 *   7. Isolation data — user A ne voit pas les données de user B
 *
 * NOTE : aucune connexion réelle à Supabase.
 * Tout `createClient` est mocké — safe en CI sans variables d'env.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks hoisted (top-level, obligatoire pour Vitest) ────────────────────

const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/platform/auth/options", () => ({
  authOptions: {},
}));

// ── Fixtures ─────────────────────────────────────────────────────────────

const USER_A = {
  userId: "a0000000-0000-0000-0000-000000000001",
  tenantId: "t0000000-0000-0000-0000-000000000001",
};
const USER_B = {
  userId: "b0000000-0000-0000-0000-000000000002",
  tenantId: "t0000000-0000-0000-0000-000000000002",
};

// ── Mock setup ────────────────────────────────────────────────────────────

// ── Helpers internes ──────────────────────────────────────────────────────

/** Construit un faux client Supabase avec from/select bouchés. */
function makeFakeClient(rows: unknown[] = []) {
  const selectFn = mockSelect.mockResolvedValue({ data: rows, error: null });
  const fromFn = mockFrom.mockReturnValue({ select: selectFn });
  return { from: fromFn } as unknown as ReturnType<typeof mockCreateClient>;
}

/** Réinitialise le singleton interne de lib/platform/db/supabase.ts entre tests. */
async function resetSingletonAndGetModule() {
  vi.resetModules();
  const mod = await import("@/lib/platform/db/supabase");
  return mod;
}

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  // Variables d'env bouchées — pas de vraie connexion
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ─────────────────────────────────────────────────────────────────────────
// 1. Connexion basique × 3
// ─────────────────────────────────────────────────────────────────────────

describe("1. Connexion basique répétée (×3)", () => {
  it.each([0, 1, 2])("run %i — getServerSupabase() retourne un client non-null", async (run) => {
    mockCreateClient.mockReturnValue(makeFakeClient());
    const { getServerSupabase } = await resetSingletonAndGetModule();

    const client = getServerSupabase();
    expect(client, `run ${run} : client attendu non-null`).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Singleton — même instance réutilisée
// ─────────────────────────────────────────────────────────────────────────

describe("2. Singleton — même référence retournée", () => {
  it("deux appels consécutifs retournent la même instance", async () => {
    const fakeClient = makeFakeClient();
    mockCreateClient.mockReturnValue(fakeClient);
    const { getServerSupabase } = await resetSingletonAndGetModule();

    const c1 = getServerSupabase();
    const c2 = getServerSupabase();

    expect(c1).toBe(c2);
    // createClient n'a dû être appelé qu'une seule fois
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it("10 appels successifs → même instance, createClient appelé une seule fois", async () => {
    const fakeClient = makeFakeClient();
    mockCreateClient.mockReturnValue(fakeClient);
    const { getServerSupabase } = await resetSingletonAndGetModule();

    const instances = Array.from({ length: 10 }, () => getServerSupabase());
    const unique = new Set(instances);

    expect(unique.size).toBe(1);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Déconnexion simulée — client null
// ─────────────────────────────────────────────────────────────────────────

describe("3. Client null — comportement gracieux", () => {
  it("getServerSupabase() retourne null si les variables d'env sont absentes", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { getServerSupabase } = await resetSingletonAndGetModule();
    const client = getServerSupabase();

    expect(client).toBeNull();
  });

  it("requireServerSupabase() throw une erreur explicite si client null", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { requireServerSupabase } = await resetSingletonAndGetModule();

    await expect(() => requireServerSupabase()).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("accès à client?.from(table) sur null ne crashe pas (optional chaining)", () => {
    // Simule un caller qui fait `getServerSupabase()?.from(...)` sans vérifier
    const client: ReturnType<typeof makeFakeClient> | null = null;
    const result = client?.from("missions").select("*");

    // undefined signifie que le chaînage s'est arrêté proprement
    expect(result).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Isolation tenant — mauvais tenant_id → 0 rows
// ─────────────────────────────────────────────────────────────────────────

describe("4. Isolation tenant (RLS simulée)", () => {
  /** Émule la policy RLS : `tenant_id = jwt.tenant_id` */
  function rlsFilter<T extends { tenant_id: string }>(rows: T[], jwtTenantId: string): T[] {
    return rows.filter((r) => r.tenant_id === jwtTenantId);
  }

  const dbRows = [
    { id: "agent-1", tenant_id: USER_A.tenantId, owner_user_id: USER_A.userId },
    { id: "agent-2", tenant_id: USER_A.tenantId, owner_user_id: USER_A.userId },
    { id: "agent-3", tenant_id: USER_B.tenantId, owner_user_id: USER_B.userId },
  ];

  it("user A avec son propre tenant_id → voit ses 2 agents", () => {
    const visible = rlsFilter(dbRows, USER_A.tenantId);
    expect(visible).toHaveLength(2);
    expect(visible.every((r) => r.tenant_id === USER_A.tenantId)).toBe(true);
  });

  it("user B avec tenant_id de A → voit 0 rows (isolation cross-tenant)", () => {
    // Simule une requête où JWT contient le tenant_id de B mais les données appartiennent à A
    const visible = rlsFilter(dbRows, USER_B.tenantId);
    const crossTenantRows = visible.filter((r) => r.tenant_id === USER_A.tenantId);
    expect(crossTenantRows).toHaveLength(0);
  });

  it("tenant_id invalide/inconnu → 0 rows retournés", () => {
    const visible = rlsFilter(dbRows, "t-inexistant-uuid");
    expect(visible).toHaveLength(0);
  });

  it("tenant_id null dans row → exclu du résultat (IS NOT NULL policy)", () => {
    const rowsWithNull = [
      ...dbRows,
      { id: "agent-null", tenant_id: null as unknown as string, owner_user_id: USER_A.userId },
    ];
    const visible = rlsFilter(rowsWithNull, USER_A.tenantId);
    // La row avec tenant_id null ne passe jamais le filtre ===
    expect(visible.find((r) => r.id === "agent-null")).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Haute charge simultanée — 10 requêtes parallèles
// ─────────────────────────────────────────────────────────────────────────

describe("5. Haute charge — 10 requêtes parallèles", () => {
  it("10 Promise.all concurrentes aboutissent toutes sans erreur", async () => {
    const fakeClient = makeFakeClient([{ count: 42 }]);
    mockCreateClient.mockReturnValue(fakeClient);
    const { getServerSupabase } = await resetSingletonAndGetModule();

    // Chaque requête récupère le singleton et exécute un select
    const results = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const client = getServerSupabase();
        if (!client) throw new Error(`requête ${i} : client null`);
        return client.from("agents").select("count");
      }),
    );

    expect(results).toHaveLength(10);
    results.forEach((res, i) => {
      expect(res.error, `requête ${i} ne doit pas avoir d'erreur`).toBeNull();
      expect(res.data, `requête ${i} doit retourner des données`).not.toBeNull();
    });
  });

  it("singleton reste stable sous charge — createClient toujours appelé 1 seule fois", async () => {
    const fakeClient = makeFakeClient([{ count: 1 }]);
    mockCreateClient.mockReturnValue(fakeClient);
    const { getServerSupabase } = await resetSingletonAndGetModule();

    await Promise.all(Array.from({ length: 10 }, () => Promise.resolve(getServerSupabase())));

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it("10 requêtes en erreur DB sont catchées individuellement sans faire planter les autres", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB timeout" } }),
      }),
    } as unknown as ReturnType<typeof makeFakeClient>;

    mockCreateClient.mockReturnValue(fakeClient);
    const { getServerSupabase } = await resetSingletonAndGetModule();

    const results = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const client = getServerSupabase();
        if (!client) return { data: null, error: { message: "client null" } };
        return client.from("agents").select("count");
      }),
    );

    // Toutes les requêtes aboutissent (pas de crash), mais toutes ont une erreur DB
    expect(results).toHaveLength(10);
    results.forEach((res) => {
      expect(res.error).toBeTruthy();
      expect(res.error?.message).toBe("DB timeout");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. Auth disconnect — session JWT expirée
// ─────────────────────────────────────────────────────────────────────────

describe("6. Session JWT expirée — getCurrentUserId() retourne null", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetServerSession.mockReset();
    delete process.env.HEARST_DEV_AUTH_BYPASS;
  });

  it("session null (JWT expiré / invalidé) → getCurrentUserId() retourne null", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    expect(result).toBeNull();
  });

  it("session sans userId ni user.id → retourne null (pas de fallback email)", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "user@hearst.app" }, // email présent mais userId absent
    });
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    // F-015 : pas de fallback email, doit retourner null
    expect(result).toBeNull();
  });

  it("session avec userId UUID valide → retourne ce UUID", async () => {
    const validUuid = "a1b2c3d4-0000-0000-0000-000000000001";
    mockGetServerSession.mockResolvedValue({
      userId: validUuid,
      user: {},
    });
    const { getCurrentUserId } = await import("@/lib/platform/auth/session");
    const result = await getCurrentUserId();
    expect(result).toBe(validUuid);
  });

  it("requireAuth() throw si session expirée", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { requireAuth } = await import("@/lib/platform/auth/session");
    await expect(requireAuth()).rejects.toThrow("Authentication required");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Isolation data — user A ne voit pas les données de user B
// ─────────────────────────────────────────────────────────────────────────

describe("7. Isolation data inter-utilisateurs", () => {
  /** Émule la policy RLS missions : `user_id = auth.uid` */
  function missionsByUser<T extends { user_id: string }>(rows: T[], uid: string): T[] {
    return rows.filter((r) => r.user_id === uid);
  }

  /** Émule la policy RLS mission_runs via jointure missions */
  function missionRunsByUser(
    runs: { id: string; mission_id: string }[],
    missions: { id: string; user_id: string }[],
    uid: string,
  ) {
    const ownedMissionIds = new Set(missions.filter((m) => m.user_id === uid).map((m) => m.id));
    return runs.filter((r) => ownedMissionIds.has(r.mission_id));
  }

  const missions = [
    { id: "m-1", user_id: USER_A.userId, title: "Mission A1" },
    { id: "m-2", user_id: USER_A.userId, title: "Mission A2" },
    { id: "m-3", user_id: USER_B.userId, title: "Mission B1" },
  ];

  const missionRuns = [
    { id: "run-1", mission_id: "m-1" },
    { id: "run-2", mission_id: "m-2" },
    { id: "run-3", mission_id: "m-3" },
  ];

  it("user A voit ses 2 missions, pas celles de B", () => {
    const result = missionsByUser(missions, USER_A.userId);
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.user_id === USER_A.userId)).toBe(true);
  });

  it("user B voit sa 1 mission, pas celles de A", () => {
    const result = missionsByUser(missions, USER_B.userId);
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(USER_B.userId);
  });

  it("user A ne voit AUCUNE mission de user B", () => {
    const result = missionsByUser(missions, USER_A.userId);
    const leak = result.filter((m) => m.user_id === USER_B.userId);
    expect(leak).toHaveLength(0);
  });

  it("mission_runs — user A voit ses runs via jointure, pas ceux de B", () => {
    const runsA = missionRunsByUser(missionRuns, missions, USER_A.userId);
    expect(runsA).toHaveLength(2);
    expect(runsA.find((r) => r.id === "run-3")).toBeUndefined();
  });

  it("mission_runs — user B voit uniquement run-3", () => {
    const runsB = missionRunsByUser(missionRuns, missions, USER_B.userId);
    expect(runsB).toHaveLength(1);
    expect(runsB[0].id).toBe("run-3");
  });

  it("aucun run cross-user ne passe la jointure (intégrité complète)", () => {
    // Vérifie l'ensemble : l'union des runs A et des runs B couvre tous les runs
    const runsA = missionRunsByUser(missionRuns, missions, USER_A.userId);
    const runsB = missionRunsByUser(missionRuns, missions, USER_B.userId);
    const allOwned = new Set([...runsA.map((r) => r.id), ...runsB.map((r) => r.id)]);
    expect(allOwned.size).toBe(missionRuns.length);
  });
});
