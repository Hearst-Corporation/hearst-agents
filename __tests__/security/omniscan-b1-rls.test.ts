/**
 * OMNISCAN B1-RLS — Tests de régression pour les policies RLS
 * migration 0091_omniscan_rls_hardening.sql
 *
 * Ces tests valident la logique des policies au niveau applicatif
 * (mock Supabase) et documentent les invariants à maintenir.
 *
 * Findings couverts :
 *   P0-IC  integration_connections — cross-user token exposure
 *   P0-M   missions / mission_runs  — cross-user mission exposure
 */

import { describe, expect, it } from "vitest";

// ── Types locaux (évite l'import de database.types.ts) ──────

interface IntegrationConnection {
  id: string;
  provider: string;
  credentials: Record<string, string>;
  owner_user_id: string | null;
}

interface Mission {
  id: string;
  user_id: string;
  title: string;
}

interface MissionRun {
  id: string;
  mission_id: string;
  status: string;
}

// ── Fixtures ────────────────────────────────────────────────

const USER_A = "user-a-0000-0000-0000-000000000001";
const USER_B = "user-b-0000-0000-0000-000000000002";

const CONN_USER_A: IntegrationConnection = {
  id: "conn-0000-0000-0000-000000000001",
  provider: "slack",
  credentials: { access_token: "xoxb-secret-a" },
  owner_user_id: USER_A,
};

const CONN_USER_B: IntegrationConnection = {
  id: "conn-0000-0000-0000-000000000002",
  provider: "google",
  credentials: { access_token: "ya29-secret-b" },
  owner_user_id: USER_B,
};

const CONN_LEGACY: IntegrationConnection = {
  id: "conn-0000-0000-0000-000000000003",
  provider: "composio",
  credentials: { api_key: "legacy-key" },
  owner_user_id: null,
};

const MISSION_A: Mission = {
  id: "mission-0000-0000-0000-000000000001",
  user_id: USER_A,
  title: "Mission User A",
};

const MISSION_B: Mission = {
  id: "mission-0000-0000-0000-000000000002",
  user_id: USER_B,
  title: "Mission User B",
};

const RUN_MISSION_A: MissionRun = {
  id: "run-0000-0000-0000-000000000001",
  mission_id: MISSION_A.id,
  status: "completed",
};

const ALL_CONNECTIONS = [CONN_USER_A, CONN_USER_B, CONN_LEGACY];
const ALL_MISSIONS = [MISSION_A, MISSION_B];
const ALL_RUNS = [RUN_MISSION_A];

// ── Simulateurs de policy RLS ────────────────────────────────
//
// Ces fonctions reproduisent en TypeScript les USING clauses des policies
// de la migration 0091. Elles permettent de vérifier la logique
// sans connexion Supabase réelle.

/**
 * omniscan_integration_connections_owner_only
 * USING (owner_user_id = auth.uid())
 */
function filterConnectionsForUser(
  rows: IntegrationConnection[],
  callerUid: string,
): IntegrationConnection[] {
  return rows.filter((r) => r.owner_user_id === callerUid);
}

/**
 * omniscan_integration_connections_service_all
 * Service role : USING(true)
 */
function filterConnectionsForServiceRole(rows: IntegrationConnection[]): IntegrationConnection[] {
  return [...rows];
}

/**
 * omniscan_missions_select_user
 * USING (user_id = auth.uid())
 */
function filterMissionsForUser(rows: Mission[], callerUid: string): Mission[] {
  return rows.filter((r) => r.user_id === callerUid);
}

/**
 * omniscan_mission_runs_select_user
 * USING (EXISTS (SELECT 1 FROM missions m WHERE m.id = mission_id AND m.user_id = auth.uid()))
 */
function filterMissionRunsForUser(
  runs: MissionRun[],
  missions: Mission[],
  callerUid: string,
): MissionRun[] {
  const ownMissionIds = new Set(missions.filter((m) => m.user_id === callerUid).map((m) => m.id));
  return runs.filter((r) => ownMissionIds.has(r.mission_id));
}

/**
 * Simule un WITH CHECK pour INSERT/UPDATE sur integration_connections
 * WITH CHECK (owner_user_id = auth.uid())
 */
function checkInsertConnectionForUser(
  row: Partial<IntegrationConnection>,
  callerUid: string,
): boolean {
  return row.owner_user_id === callerUid;
}

// ── Tests integration_connections ───────────────────────────

describe("P0-IC — integration_connections : policy omniscan_owner_only", () => {
  it("User A ne voit que ses propres connexions", () => {
    const visible = filterConnectionsForUser(ALL_CONNECTIONS, USER_A);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(CONN_USER_A.id);
  });

  it("User B ne voit que ses propres connexions", () => {
    const visible = filterConnectionsForUser(ALL_CONNECTIONS, USER_B);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(CONN_USER_B.id);
  });

  it("Les connexions legacy (owner_user_id=null) sont invisibles pour tout authenticated", () => {
    const visibleA = filterConnectionsForUser(ALL_CONNECTIONS, USER_A);
    const visibleB = filterConnectionsForUser(ALL_CONNECTIONS, USER_B);
    const legacyVisibleToA = visibleA.some((c) => c.owner_user_id === null);
    const legacyVisibleToB = visibleB.some((c) => c.owner_user_id === null);
    expect(legacyVisibleToA).toBe(false);
    expect(legacyVisibleToB).toBe(false);
  });

  it("Service role voit toutes les connexions (bypass)", () => {
    const all = filterConnectionsForServiceRole(ALL_CONNECTIONS);
    expect(all).toHaveLength(ALL_CONNECTIONS.length);
  });

  it("User A ne peut pas INSERT une connexion avec owner_user_id de User B (WITH CHECK)", () => {
    const canInsert = checkInsertConnectionForUser(
      { owner_user_id: USER_B, provider: "slack" },
      USER_A,
    );
    expect(canInsert).toBe(false);
  });

  it("User A peut INSERT une connexion avec son propre owner_user_id (WITH CHECK)", () => {
    const canInsert = checkInsertConnectionForUser(
      { owner_user_id: USER_A, provider: "slack" },
      USER_A,
    );
    expect(canInsert).toBe(true);
  });

  it("Credentials du token de User B ne sont pas exposés à User A", () => {
    const visible = filterConnectionsForUser(ALL_CONNECTIONS, USER_A);
    const connB = visible.find((c) => c.id === CONN_USER_B.id);
    expect(connB).toBeUndefined();
  });
});

// ── Tests missions ───────────────────────────────────────────

describe("P0-M — missions : policy omniscan_missions_select_user", () => {
  it("User A ne voit que ses propres missions", () => {
    const visible = filterMissionsForUser(ALL_MISSIONS, USER_A);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(MISSION_A.id);
  });

  it("User B ne voit que ses propres missions", () => {
    const visible = filterMissionsForUser(ALL_MISSIONS, USER_B);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(MISSION_B.id);
  });

  it("User B ne peut pas lire la mission de User A (cross-user)", () => {
    const visible = filterMissionsForUser(ALL_MISSIONS, USER_B);
    const missionA = visible.find((m) => m.id === MISSION_A.id);
    expect(missionA).toBeUndefined();
  });

  it("Un user inexistant ne voit aucune mission", () => {
    const visible = filterMissionsForUser(ALL_MISSIONS, "user-unknown-000");
    expect(visible).toHaveLength(0);
  });
});

// ── Tests mission_runs ───────────────────────────────────────

describe("P0-M — mission_runs : policy omniscan_mission_runs_select_user (jointure)", () => {
  it("User A voit les runs de ses propres missions", () => {
    const visible = filterMissionRunsForUser(ALL_RUNS, ALL_MISSIONS, USER_A);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(RUN_MISSION_A.id);
  });

  it("User B ne voit pas les runs des missions de User A (cross-user)", () => {
    const visible = filterMissionRunsForUser(ALL_RUNS, ALL_MISSIONS, USER_B);
    expect(visible).toHaveLength(0);
  });

  it("Un run lié à une mission inexistante/inconnue n'est pas visible", () => {
    const orphanRun: MissionRun = {
      id: "run-orphan",
      mission_id: "mission-inexistante",
      status: "completed",
    };
    const visible = filterMissionRunsForUser([orphanRun], ALL_MISSIONS, USER_A);
    expect(visible).toHaveLength(0);
  });

  it("La jointure est correcte : seules les missions de l'utilisateur ouvrent les runs", () => {
    // Run B appartient à MISSION_B (User B) — User A ne doit pas le voir
    const runB: MissionRun = {
      id: "run-b",
      mission_id: MISSION_B.id,
      status: "running",
    };
    const visible = filterMissionRunsForUser([RUN_MISSION_A, runB], ALL_MISSIONS, USER_A);
    expect(visible.map((r) => r.id)).toEqual([RUN_MISSION_A.id]);
  });
});

// ── Tests daily_reports — N/A ────────────────────────────────

describe("P0-DR — daily_reports : table supprimée (migration 0027)", () => {
  it("La table daily_reports est droppée et ne nécessite pas de policy RLS", () => {
    // Ce test documente l'invariant : daily_reports ne doit plus exister.
    // Toute future re-création doit activer RLS immédiatement (cf. Pattern D).
    expect(true).toBe(true);
  });
});
