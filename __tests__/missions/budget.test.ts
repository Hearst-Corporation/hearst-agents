/**
 * Tests unitaires — Mission budget cap (S3-D).
 *
 * Couverture :
 *  - getMonthlyMissionCost : agrège costUsd des runs sur fenêtre UTC du mois
 *  - Cache 5 min : un 2e call dans la fenêtre ne re-fetche pas la DB
 *  - _resetBudgetCache invalide le cache
 *  - getMissionBudgetState : utilization + exceeded selon budget configuré
 *  - Filtre yearMonth : seuls les runs de la fenêtre comptent
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Setup env vars AVANT l'import du module ────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-for-tests";

// ── Mock Supabase fluent client ────────────────────────────────────────────
//
// Le module budget appelle :
//   sb.from("runs").select("cost_usd")
//     .filter("metadata->>missionId", "eq", missionId)
//     .gte("created_at", startIso)
//     .lt("created_at", endIso)
// Le résultat doit être awaitable et retourner { data, error }.

interface RunRow {
  cost_usd: number;
  created_at: string; // ISO
  missionId: string;
}

const dbState = {
  runs: [] as RunRow[],
  selectCallCount: 0,
  forcedError: null as { message: string } | null,
};

class RunsBuilder {
  private filterMissionId: string | null = null;
  private startIso: string | null = null;
  private endIso: string | null = null;

  select(_fields: string) {
    dbState.selectCallCount++;
    return this;
  }

  filter(col: string, op: string, val: string) {
    if (col === "metadata->>missionId" && op === "eq") {
      this.filterMissionId = val;
    }
    return this;
  }

  gte(col: string, val: string) {
    if (col === "created_at") this.startIso = val;
    return this;
  }

  lt(col: string, val: string) {
    if (col === "created_at") this.endIso = val;
    return this;
  }

  then<T1, T2>(
    onfulfilled?: (val: {
      data: { cost_usd: number }[] | null;
      error: unknown;
    }) => T1 | PromiseLike<T1>,
    onrejected?: (reason: unknown) => T2 | PromiseLike<T2>,
  ): Promise<T1 | T2> {
    if (dbState.forcedError) {
      return Promise.resolve({ data: null, error: dbState.forcedError }).then(
        onfulfilled,
        onrejected,
      );
    }
    const filtered = dbState.runs.filter((r) => {
      if (this.filterMissionId && r.missionId !== this.filterMissionId) return false;
      if (this.startIso && r.created_at < this.startIso) return false;
      if (this.endIso && r.created_at >= this.endIso) return false;
      return true;
    });
    return Promise.resolve({
      data: filtered.map((r) => ({ cost_usd: r.cost_usd })),
      error: null,
    }).then(onfulfilled, onrejected);
  }
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (_table: string) => new RunsBuilder(),
  })),
}));

// ── Imports du module testé (après mock) ───────────────────────────────────

import {
  _resetBudgetCache,
  currentYearMonth,
  getMissionBudgetState,
  getMonthlyMissionCost,
} from "@/lib/engine/runtime/missions/budget";

// ── Helpers ────────────────────────────────────────────────────────────────

function resetState(): void {
  dbState.runs = [];
  dbState.selectCallCount = 0;
  dbState.forcedError = null;
  _resetBudgetCache();
}

beforeEach(() => {
  resetState();
});

// ── Tests : getMonthlyMissionCost ──────────────────────────────────────────

describe("getMonthlyMissionCost", () => {
  it("agrège cost_usd sur 3 runs du mois courant → total 18", async () => {
    const ym = currentYearMonth();
    const [y, m] = ym.split("-").map((s) => parseInt(s, 10));
    const inMonth = new Date(Date.UTC(y, m - 1, 10)).toISOString();
    dbState.runs = [
      { cost_usd: 5, created_at: inMonth, missionId: "m-1" },
      { cost_usd: 10, created_at: inMonth, missionId: "m-1" },
      { cost_usd: 3, created_at: inMonth, missionId: "m-1" },
    ];
    const total = await getMonthlyMissionCost("m-1", ym);
    expect(total).toBe(18);
  });

  it("filtre par yearMonth — un run du mois précédent est exclu", async () => {
    const ym = "2026-05";
    dbState.runs = [
      { cost_usd: 100, created_at: "2026-05-15T10:00:00Z", missionId: "m-1" },
      { cost_usd: 50, created_at: "2026-04-30T23:59:59Z", missionId: "m-1" },
      { cost_usd: 25, created_at: "2026-06-01T00:00:00Z", missionId: "m-1" },
    ];
    const total = await getMonthlyMissionCost("m-1", ym);
    expect(total).toBe(100);
  });

  it("filtre par missionId — runs d'autres missions ignorés", async () => {
    const ym = "2026-05";
    dbState.runs = [
      { cost_usd: 5, created_at: "2026-05-10T00:00:00Z", missionId: "m-1" },
      { cost_usd: 99, created_at: "2026-05-10T00:00:00Z", missionId: "m-2" },
    ];
    const total = await getMonthlyMissionCost("m-1", ym);
    expect(total).toBe(5);
  });

  it("retourne 0 si la requête DB renvoie une erreur", async () => {
    dbState.forcedError = { message: "connection lost" };
    const total = await getMonthlyMissionCost("m-1", "2026-05");
    expect(total).toBe(0);
  });

  it("retourne 0 si aucun run trouvé", async () => {
    const total = await getMonthlyMissionCost("m-vide", "2026-05");
    expect(total).toBe(0);
  });
});

// ── Tests : cache 5 min ────────────────────────────────────────────────────

describe("cache 5 min", () => {
  it("un 2e call dans la fenêtre ne re-fetche pas la DB", async () => {
    const ym = "2026-05";
    dbState.runs = [{ cost_usd: 7, created_at: "2026-05-10T00:00:00Z", missionId: "m-1" }];
    const t1 = await getMonthlyMissionCost("m-1", ym);
    const callsAfter1 = dbState.selectCallCount;
    const t2 = await getMonthlyMissionCost("m-1", ym);
    const callsAfter2 = dbState.selectCallCount;
    expect(t1).toBe(7);
    expect(t2).toBe(7);
    expect(callsAfter2).toBe(callsAfter1);
  });

  it("_resetBudgetCache() invalide le cache → re-fetch", async () => {
    const ym = "2026-05";
    dbState.runs = [{ cost_usd: 7, created_at: "2026-05-10T00:00:00Z", missionId: "m-1" }];
    await getMonthlyMissionCost("m-1", ym);
    const callsAfter1 = dbState.selectCallCount;
    _resetBudgetCache();
    await getMonthlyMissionCost("m-1", ym);
    expect(dbState.selectCallCount).toBe(callsAfter1 + 1);
  });

  it("clé cache distincte par (missionId, yearMonth)", async () => {
    dbState.runs = [
      { cost_usd: 1, created_at: "2026-05-10T00:00:00Z", missionId: "m-1" },
      { cost_usd: 2, created_at: "2026-04-10T00:00:00Z", missionId: "m-1" },
    ];
    await getMonthlyMissionCost("m-1", "2026-05");
    const callsAfter1 = dbState.selectCallCount;
    await getMonthlyMissionCost("m-1", "2026-04");
    expect(dbState.selectCallCount).toBe(callsAfter1 + 1);
  });
});

// ── Tests : getMissionBudgetState ──────────────────────────────────────────

describe("getMissionBudgetState", () => {
  it("18/25 → utilization ≈ 0.72, exceeded=false", async () => {
    const ym = "2026-05";
    dbState.runs = [{ cost_usd: 18, created_at: "2026-05-10T00:00:00Z", missionId: "m-1" }];
    const state = await getMissionBudgetState("m-1", 25, ym);
    expect(state).not.toBeNull();
    expect(state?.budgetUsd).toBe(25);
    expect(state?.currentUsd).toBe(18);
    expect(state?.utilization).toBeCloseTo(0.72, 2);
    expect(state?.exceeded).toBe(false);
    expect(state?.remainingUsd).toBe(7);
  });

  it("30/25 → utilization 1.2, exceeded=true, remaining=0", async () => {
    const ym = "2026-05";
    dbState.runs = [{ cost_usd: 30, created_at: "2026-05-10T00:00:00Z", missionId: "m-1" }];
    const state = await getMissionBudgetState("m-1", 25, ym);
    expect(state?.utilization).toBeCloseTo(1.2, 2);
    expect(state?.exceeded).toBe(true);
    expect(state?.remainingUsd).toBe(0);
  });

  it("budget undefined → retourne null (pas de budget configuré)", async () => {
    const state = await getMissionBudgetState("m-1", undefined, "2026-05");
    expect(state).toBeNull();
  });

  it("budget = 0 → retourne null (équivalent désactivé)", async () => {
    const state = await getMissionBudgetState("m-1", 0, "2026-05");
    expect(state).toBeNull();
  });

  it("budget négatif → retourne null", async () => {
    const state = await getMissionBudgetState("m-1", -5, "2026-05");
    expect(state).toBeNull();
  });

  it("currentUsd >= budgetUsd (égalité) → exceeded=true", async () => {
    const ym = "2026-05";
    dbState.runs = [{ cost_usd: 25, created_at: "2026-05-10T00:00:00Z", missionId: "m-1" }];
    const state = await getMissionBudgetState("m-1", 25, ym);
    expect(state?.exceeded).toBe(true);
    expect(state?.utilization).toBe(1);
  });
});

// ── Tests : currentYearMonth ───────────────────────────────────────────────

describe("currentYearMonth", () => {
  it("retourne YYYY-MM pour une date donnée (UTC)", () => {
    expect(currentYearMonth(new Date("2026-05-09T22:00:00Z"))).toBe("2026-05");
    expect(currentYearMonth(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
    expect(currentYearMonth(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });
});
