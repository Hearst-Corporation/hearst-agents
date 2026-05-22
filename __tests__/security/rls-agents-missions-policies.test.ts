/**
 * Migration 0092 — Vérification des policies RLS sur agents / missions
 *
 * Ces tests documentent et valident la logique des policies RLS créées
 * par 0092_rls_agents_missions.sql. Ils ne touchent pas Postgres directement
 * mais simulent le comportement attendu de chaque policy USING/WITH CHECK
 * en émulant ce que Postgres évalue par row.
 *
 * Structure :
 *  - agents_select_tenant  : tenant_id IS NOT NULL AND tenant_id = jwt.tenant_id
 *  - agents_insert_owner   : owner_user_id = auth.uid AND tenant_id = jwt.tenant_id
 *  - agents_update_owner   : idem (USING + WITH CHECK)
 *  - agents_delete_owner   : owner_user_id = auth.uid AND tenant_id = jwt.tenant_id
 *  - missions_select_owner : user_id = auth.uid
 *  - missions_insert_owner : user_id = auth.uid (WITH CHECK)
 *  - mission_runs via jointure sur missions.user_id
 */

import { describe, expect, it } from "vitest";

// ── Types utilitaires ────────────────────────────────────────

interface AuthContext {
  uid: string;
  jwtTenantId: string;
}

interface AgentRow {
  id: string;
  owner_user_id: string | null;
  tenant_id: string | null;
}

interface MissionRow {
  id: string;
  user_id: string;
}

interface MissionRunRow {
  id: string;
  mission_id: string;
}

// ── Émulateurs de policies ───────────────────────────────────

/** agents_select_tenant */
function agentsSelectTenant(row: AgentRow, ctx: AuthContext): boolean {
  return row.tenant_id !== null && row.tenant_id === ctx.jwtTenantId;
}

/** agents_insert_owner / agents_update_owner (USING + WITH CHECK identiques) */
function agentsWriteOwner(row: AgentRow, ctx: AuthContext): boolean {
  return row.owner_user_id === ctx.uid && row.tenant_id === ctx.jwtTenantId;
}

/** missions_select_owner / missions_update_owner / missions_delete_owner */
function missionsOwner(row: MissionRow, ctx: AuthContext): boolean {
  return row.user_id === ctx.uid;
}

/** mission_runs_select_owner via jointure (simplifiée) */
function missionRunsOwner(run: MissionRunRow, missions: MissionRow[], ctx: AuthContext): boolean {
  return missions.some((m) => m.id === run.mission_id && m.user_id === ctx.uid);
}

// ── Fixtures ────────────────────────────────────────────────

const USER_A: AuthContext = {
  uid: "a0000000-0000-0000-0000-000000000001",
  jwtTenantId: "t0000000-0000-0000-0000-000000000001",
};

const USER_B: AuthContext = {
  uid: "b0000000-0000-0000-0000-000000000002",
  jwtTenantId: "t0000000-0000-0000-0000-000000000002",
};

// User C : même tenant que A, mais user différent (IDOR intra-tenant)
const USER_C: AuthContext = {
  uid: "c0000000-0000-0000-0000-000000000003",
  jwtTenantId: USER_A.jwtTenantId,
};

const AGENT_A: AgentRow = {
  id: "agent-a",
  owner_user_id: USER_A.uid,
  tenant_id: USER_A.jwtTenantId,
};

const AGENT_NO_OWNER: AgentRow = {
  id: "agent-system",
  owner_user_id: null,
  tenant_id: USER_A.jwtTenantId,
};

const AGENT_NO_TENANT: AgentRow = {
  id: "agent-orphan",
  owner_user_id: null,
  tenant_id: null,
};

const MISSION_A: MissionRow = {
  id: "mission-a",
  user_id: USER_A.uid,
};

const RUN_A: MissionRunRow = {
  id: "run-a",
  mission_id: MISSION_A.id,
};

// ── Tests agents ─────────────────────────────────────────────

describe("0092 RLS — agents_select_tenant", () => {
  it("User A lit son propre agent (même tenant)", () => {
    expect(agentsSelectTenant(AGENT_A, USER_A)).toBe(true);
  });

  it("User B (tenant différent) ne lit pas l'agent de User A", () => {
    expect(agentsSelectTenant(AGENT_A, USER_B)).toBe(false);
  });

  it("User C (même tenant que A) peut lire l'agent partagé du tenant", () => {
    // Les agents sans owner restent lisibles par tout le tenant
    expect(agentsSelectTenant(AGENT_NO_OWNER, USER_C)).toBe(true);
  });

  it("Agent sans tenant_id (orphelin) : invisible pour tout utilisateur", () => {
    expect(agentsSelectTenant(AGENT_NO_TENANT, USER_A)).toBe(false);
    expect(agentsSelectTenant(AGENT_NO_TENANT, USER_B)).toBe(false);
  });
});

describe("0092 RLS — agents_insert_owner / agents_update_owner / agents_delete_owner", () => {
  it("User A peut insérer/modifier/supprimer son propre agent", () => {
    expect(agentsWriteOwner(AGENT_A, USER_A)).toBe(true);
  });

  it("User B (tenant différent) ne peut pas modifier l'agent de User A", () => {
    expect(agentsWriteOwner(AGENT_A, USER_B)).toBe(false);
  });

  it("User C (même tenant) ne peut pas modifier l'agent d'un autre owner", () => {
    // owner_user_id est USER_A, pas USER_C
    expect(agentsWriteOwner(AGENT_A, USER_C)).toBe(false);
  });

  it("Injection de tenant_id erroné : WITH CHECK bloque si tenant_id ne correspond pas au JWT", () => {
    // Simule un attaquant qui tente d'insérer un agent avec tenant_id d'un autre tenant
    const injectedRow: AgentRow = {
      id: "injected",
      owner_user_id: USER_A.uid,
      tenant_id: USER_B.jwtTenantId, // tenant frauduleux
    };
    // USER_A ne peut pas injecter un agent dans le tenant B
    expect(agentsWriteOwner(injectedRow, USER_A)).toBe(false);
  });

  it("Injection d'owner_user_id erroné : WITH CHECK bloque", () => {
    const injectedRow: AgentRow = {
      id: "injected",
      owner_user_id: USER_B.uid, // owner frauduleux
      tenant_id: USER_A.jwtTenantId,
    };
    expect(agentsWriteOwner(injectedRow, USER_A)).toBe(false);
  });
});

// ── Tests missions ────────────────────────────────────────────

describe("0092 RLS — missions_select_owner / missions_update_owner / missions_delete_owner", () => {
  it("User A peut lire sa propre mission", () => {
    expect(missionsOwner(MISSION_A, USER_A)).toBe(true);
  });

  it("User B ne peut pas lire la mission de User A", () => {
    expect(missionsOwner(MISSION_A, USER_B)).toBe(false);
  });

  it("User C (même tenant que A) ne peut pas lire la mission d'un autre user", () => {
    // missions n'est pas scopé par tenant mais par user_id direct
    expect(missionsOwner(MISSION_A, USER_C)).toBe(false);
  });

  it("missions_insert_owner — WITH CHECK bloque l'injection d'user_id erroné", () => {
    // Un attaquant POST /api/missions avec user_id = victim dans le body
    const injectedRow: MissionRow = {
      id: "new-mission",
      user_id: USER_B.uid, // frauduleux : l'attaquant se fait passer pour B
    };
    // La policy WITH CHECK évalue user_id = auth.uid() avec ctx de USER_A
    expect(missionsOwner(injectedRow, USER_A)).toBe(false);
  });
});

// ── Tests mission_runs ────────────────────────────────────────

describe("0092 RLS — mission_runs_select_owner (via jointure)", () => {
  const missions: MissionRow[] = [MISSION_A];

  it("User A peut lire les runs de sa propre mission", () => {
    expect(missionRunsOwner(RUN_A, missions, USER_A)).toBe(true);
  });

  it("User B ne peut pas lire les runs de la mission de User A", () => {
    expect(missionRunsOwner(RUN_A, missions, USER_B)).toBe(false);
  });

  it("Run orphelin (mission_id inexistant) : fail closed", () => {
    const orphanRun: MissionRunRow = { id: "run-orphan", mission_id: "inexistant" };
    expect(missionRunsOwner(orphanRun, missions, USER_A)).toBe(false);
  });
});
