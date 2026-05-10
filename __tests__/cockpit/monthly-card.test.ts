/**
 * Tests Vitest — `lib/cockpit/monthly-card.ts`
 *
 * Couvre :
 *  - `buildMonthlyCardData` : nominal, fenêtre temporelle, fail-soft, cache 1h.
 *  - `previousYearMonth` : décalage standard + bascule année.
 *  - `buildMonthlyWindow` : format invalide → throw.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PersistedRunRecord } from "@/lib/engine/runtime/state/types";
import type { Asset } from "@/lib/assets/types";

// ── Mocks hoistés ─────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getRuns: vi.fn(),
  loadAssetsForScope: vi.fn(),
}));

vi.mock("@/lib/engine/runtime/state/adapter", () => ({
  getRuns: mocks.getRuns,
}));

vi.mock("@/lib/assets/types", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/assets/types");
  return {
    ...actual,
    loadAssetsForScope: mocks.loadAssetsForScope,
  };
});

import {
  buildMonthlyCardData,
  buildMonthlyWindow,
  previousYearMonth,
  _resetMonthlyCardCache,
} from "@/lib/cockpit/monthly-card";

const SCOPE = {
  userId: "user-1",
  tenantId: "tenant-1",
  workspaceId: "ws-1",
};

const NOW = new Date("2026-05-09T12:00:00Z");

/** Helper : timestamp avril 2026 (mois fermé), peu importe l'heure locale. */
const APRIL_15 = new Date("2026-04-15T12:00:00Z").getTime();
const APRIL_20 = new Date("2026-04-20T12:00:00Z").getTime();
const MARCH_15 = new Date("2026-03-15T12:00:00Z").getTime();
const MAY_05 = new Date("2026-05-05T12:00:00Z").getTime();

function makeRun(over: Partial<PersistedRunRecord>): PersistedRunRecord {
  return {
    id: over.id ?? "run-1",
    tenantId: SCOPE.tenantId,
    workspaceId: SCOPE.workspaceId,
    userId: SCOPE.userId,
    input: "test input",
    status: "completed",
    createdAt: APRIL_15,
    completedAt: APRIL_15,
    assets: [],
    ...over,
  };
}

function makeAsset(over: Partial<Asset>): Asset {
  return {
    id: over.id ?? "asset-1",
    threadId: "thread-1",
    kind: over.kind ?? "report",
    title: over.title ?? "Asset",
    provenance: { providerId: "system" },
    createdAt: over.createdAt ?? APRIL_15,
    ...over,
  };
}

describe("buildMonthlyCardData", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.getRuns.mockResolvedValue([]);
    mocks.loadAssetsForScope.mockResolvedValue([]);
    _resetMonthlyCardCache();
  });

  it("cas nominal : agrège missions completed + assets + KPIs", async () => {
    mocks.getRuns.mockResolvedValue([
      makeRun({
        id: "run-1",
        missionId: "mission-a",
        status: "completed",
        completedAt: APRIL_15,
        metrics: { costUsd: 1.5 },
        metadata: { missionName: "Daily KPI" },
      }),
      makeRun({
        id: "run-2",
        missionId: "mission-a",
        status: "completed",
        completedAt: APRIL_20,
        metrics: { costUsd: 0.5 },
        metadata: { missionName: "Daily KPI" },
      }),
      makeRun({
        id: "run-3",
        missionId: "mission-b",
        status: "failed",
        completedAt: APRIL_20,
        metrics: { costUsd: 0.25 },
        metadata: { missionName: "Weekly Brief" },
      }),
    ]);
    mocks.loadAssetsForScope.mockResolvedValue([
      makeAsset({ id: "asset-1", kind: "report", createdAt: APRIL_15 }),
      makeAsset({ id: "asset-2", kind: "brief", createdAt: APRIL_20 }),
    ]);

    const data = await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });

    expect(data.missionsRun).toBe(3);
    expect(data.anomaliesCount).toBe(1);
    expect(data.topMissions).toHaveLength(2);
    expect(data.topMissions[0].missionId).toBe("mission-a");
    expect(data.topMissions[0].successes).toBe(2);
    expect(data.reportsGenerated).toBe(2);
    expect(data.kpis).toHaveLength(3);
    expect(data.kpis[0].label).toBe("Assets créés");
    expect(data.kpis[1].value).toBe("$2.25");
    expect(data.kpis[2].value).toBe("67%"); // 2 sur 3
    expect(data.bestMoment?.kind).toBe("mission");
    expect(data.bestMoment?.title).toBe("Daily KPI");
    expect(data.window.yearMonth).toBe("2026-04");
    expect(data.window.inProgress).toBe(false);
  });

  it("fenêtre temporelle : exclut les items hors mois", async () => {
    mocks.getRuns.mockResolvedValue([
      makeRun({ id: "in", missionId: "m1", completedAt: APRIL_15 }),
      makeRun({ id: "before", missionId: "m1", completedAt: MARCH_15 }),
      makeRun({ id: "after", missionId: "m1", completedAt: MAY_05 }),
    ]);
    mocks.loadAssetsForScope.mockResolvedValue([
      makeAsset({ id: "a-in", kind: "report", createdAt: APRIL_15 }),
      makeAsset({ id: "a-before", kind: "report", createdAt: MARCH_15 }),
      makeAsset({ id: "a-after", kind: "report", createdAt: MAY_05 }),
    ]);

    const data = await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });

    expect(data.missionsRun).toBe(1);
    expect(data.reportsGenerated).toBe(1);
  });

  it("fail-soft : runs en erreur → array vide, pipeline reste valide", async () => {
    mocks.getRuns.mockRejectedValue(new Error("DB down"));
    mocks.loadAssetsForScope.mockResolvedValue([
      makeAsset({ id: "a-1", kind: "report", createdAt: APRIL_15 }),
    ]);

    const data = await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });

    expect(data.missionsRun).toBe(0);
    expect(data.anomaliesCount).toBe(0);
    expect(data.reportsGenerated).toBe(1);
    expect(data.kpis).toHaveLength(3);
  });

  it("fail-soft : assets en erreur → array vide, pipeline reste valide", async () => {
    mocks.getRuns.mockResolvedValue([
      makeRun({ id: "run-1", missionId: "m", completedAt: APRIL_15 }),
    ]);
    mocks.loadAssetsForScope.mockRejectedValue(new Error("Supabase 500"));

    const data = await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });

    expect(data.missionsRun).toBe(1);
    expect(data.reportsGenerated).toBe(0);
  });

  it("cache 1h : 2 calls consécutifs → 1 seul fetch", async () => {
    mocks.getRuns.mockResolvedValue([]);
    mocks.loadAssetsForScope.mockResolvedValue([]);

    await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });
    await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });

    expect(mocks.getRuns).toHaveBeenCalledTimes(1);
    expect(mocks.loadAssetsForScope).toHaveBeenCalledTimes(1);
  });

  it("cache : bypassCache=true force le refetch", async () => {
    await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });
    await buildMonthlyCardData(SCOPE, "2026-04", {
      now: NOW,
      bypassCache: true,
    });

    expect(mocks.getRuns).toHaveBeenCalledTimes(2);
  });

  it("cache : reset purge bien le cache", async () => {
    await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });
    _resetMonthlyCardCache();
    await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });

    expect(mocks.getRuns).toHaveBeenCalledTimes(2);
  });

  it("mois en cours : window.inProgress = true et toMs ≤ now", async () => {
    const data = await buildMonthlyCardData(SCOPE, "2026-05", { now: NOW });
    expect(data.window.inProgress).toBe(true);
    expect(data.window.toMs).toBeLessThanOrEqual(NOW.getTime());
  });

  it("bestMoment null si aucune mission ni rapport", async () => {
    const data = await buildMonthlyCardData(SCOPE, "2026-04", { now: NOW });
    expect(data.bestMoment).toBeNull();
  });
});

describe("buildMonthlyWindow", () => {
  it("throw sur format invalide", () => {
    expect(() => buildMonthlyWindow("2026/04")).toThrow(/Invalid yearMonth/);
    expect(() => buildMonthlyWindow("2026-13")).toThrow();
    expect(() => buildMonthlyWindow("26-04")).toThrow();
  });

  it("label FR capitalisé", () => {
    const w = buildMonthlyWindow("2026-04", NOW);
    expect(w.label.charAt(0)).toBe(w.label.charAt(0).toUpperCase());
    expect(w.label).toContain("2026");
  });
});

describe("previousYearMonth", () => {
  it("avril → mars", () => {
    const ref = new Date("2026-04-09T12:00:00");
    expect(previousYearMonth(ref)).toBe("2026-03");
  });

  it("janvier → décembre année précédente", () => {
    const ref = new Date("2026-01-15T12:00:00");
    expect(previousYearMonth(ref)).toBe("2025-12");
  });

  it("mai → avril", () => {
    const ref = new Date("2026-05-09T12:00:00");
    expect(previousYearMonth(ref)).toBe("2026-04");
  });
});
