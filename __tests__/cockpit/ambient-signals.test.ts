/**
 * Tests Vitest — `lib/cockpit/ambient-signals.ts`
 *
 * Couvre :
 *  - Détection mission_failed dans la fenêtre + filtre range
 *  - Tri chronologique decroissant
 *  - Cache 60s + reset
 *  - Fail-soft par source isolé
 *  - Format de sortie (id, kind, narration ≤140ch, detectedAt ISO, severity)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks hoistés ─────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getAllMissionOps: vi.fn(),
  getScheduledMissions: vi.fn(),
  getMemoryMissions: vi.fn(),
  getConnectionsByScope: vi.fn(),
  loadLatestInboxBrief: vi.fn(),
  getServerSupabase: vi.fn(),
}));

vi.mock("@/lib/engine/runtime/missions/ops-store", () => ({
  getAllMissionOps: mocks.getAllMissionOps,
}));

vi.mock("@/lib/engine/runtime/state/adapter", () => ({
  getScheduledMissions: mocks.getScheduledMissions,
}));

vi.mock("@/lib/engine/runtime/missions/store", () => ({
  getAllMissions: mocks.getMemoryMissions,
}));

vi.mock("@/lib/connectors/control-plane/store", () => ({
  getConnectionsByScope: mocks.getConnectionsByScope,
}));

vi.mock("@/lib/inbox/store", () => ({
  loadLatestInboxBrief: mocks.loadLatestInboxBrief,
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: mocks.getServerSupabase,
}));

import {
  getAmbientSignals,
  _resetAmbientSignalsCache,
} from "@/lib/cockpit/ambient-signals";

const USER_ID = "user-1";
const TENANT_ID = "tenant-1";
const WORKSPACE_ID = "ws-1";

const ONE_HOUR_MS = 60 * 60_000;
const TWO_HOURS_MS = 2 * ONE_HOUR_MS;

describe("getAmbientSignals", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.getAllMissionOps.mockReturnValue(new Map());
    mocks.getScheduledMissions.mockResolvedValue([]);
    mocks.getMemoryMissions.mockReturnValue([]);
    mocks.getConnectionsByScope.mockResolvedValue([]);
    mocks.loadLatestInboxBrief.mockResolvedValue(null);
    mocks.getServerSupabase.mockReturnValue(null);
    _resetAmbientSignalsCache();
  });

  it("cas nominal : 1 mission failed récente → 1 signal mission_failed", async () => {
    const now = Date.now();
    mocks.getScheduledMissions.mockResolvedValue([
      {
        id: "mission-a",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        name: "Daily KPI",
        input: "...",
        schedule: "0 9 * * *",
        enabled: true,
        createdAt: now - 86_400_000,
        lastRunAt: now - 60_000, // il y a 1min
        lastRunStatus: "failed",
      },
    ]);

    const signals = await getAmbientSignals(
      USER_ID,
      TENANT_ID,
      WORKSPACE_ID,
      "1h",
    );

    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe("mission_failed");
    expect(signals[0].id).toBe("mission_failed:mission-a");
    expect(signals[0].severity).toBe("warning");
    expect(signals[0].ctaHref).toBe("/missions/mission-a");
  });

  it("range : signal d'il y a 2h → exclu en '1h', inclu en '7d'", async () => {
    const now = Date.now();
    mocks.getScheduledMissions.mockResolvedValue([
      {
        id: "mission-old",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        name: "Old Mission",
        input: "...",
        schedule: "0 9 * * *",
        enabled: true,
        createdAt: now - 86_400_000,
        lastRunAt: now - TWO_HOURS_MS,
        lastRunStatus: "failed",
      },
    ]);

    const sig1h = await getAmbientSignals(USER_ID, TENANT_ID, WORKSPACE_ID, "1h");
    expect(sig1h).toHaveLength(0);

    _resetAmbientSignalsCache();
    const sig7d = await getAmbientSignals(USER_ID, TENANT_ID, WORKSPACE_ID, "7d");
    expect(sig7d).toHaveLength(1);
  });

  it("tri : signaux retournés par detectedAt desc", async () => {
    const now = Date.now();
    mocks.getScheduledMissions.mockResolvedValue([
      {
        id: "mission-old",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        name: "Mission ancienne",
        input: "...",
        schedule: "0 9 * * *",
        enabled: true,
        createdAt: now - 86_400_000,
        lastRunAt: now - 30 * 60_000, // -30min
        lastRunStatus: "failed",
      },
      {
        id: "mission-recent",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        name: "Mission récente",
        input: "...",
        schedule: "0 9 * * *",
        enabled: true,
        createdAt: now - 86_400_000,
        lastRunAt: now - 60_000, // -1min
        lastRunStatus: "failed",
      },
    ]);

    const signals = await getAmbientSignals(
      USER_ID,
      TENANT_ID,
      WORKSPACE_ID,
      "1h",
    );

    expect(signals.length).toBeGreaterThanOrEqual(2);
    const t0 = Date.parse(signals[0].detectedAt);
    const t1 = Date.parse(signals[1].detectedAt);
    expect(t0).toBeGreaterThanOrEqual(t1);
  });

  it("cache 60s : 2 calls successifs → 1 seul fetch sources", async () => {
    await getAmbientSignals(USER_ID, TENANT_ID, WORKSPACE_ID, "1h");
    const callsAfterFirst = {
      missions: mocks.getScheduledMissions.mock.calls.length,
      connections: mocks.getConnectionsByScope.mock.calls.length,
      brief: mocks.loadLatestInboxBrief.mock.calls.length,
    };
    await getAmbientSignals(USER_ID, TENANT_ID, WORKSPACE_ID, "1h");

    // Cache hit : aucun appel supplémentaire upstream.
    expect(mocks.getScheduledMissions).toHaveBeenCalledTimes(callsAfterFirst.missions);
    expect(mocks.getConnectionsByScope).toHaveBeenCalledTimes(callsAfterFirst.connections);
    expect(mocks.loadLatestInboxBrief).toHaveBeenCalledTimes(callsAfterFirst.brief);
  });

  it("_resetAmbientSignalsCache invalide le cache", async () => {
    await getAmbientSignals(USER_ID, TENANT_ID, WORKSPACE_ID, "1h");
    const before = mocks.getConnectionsByScope.mock.calls.length;
    _resetAmbientSignalsCache();
    await getAmbientSignals(USER_ID, TENANT_ID, WORKSPACE_ID, "1h");

    // Après reset, getConnectionsByScope est rappelé (1 appel par invocation).
    expect(mocks.getConnectionsByScope).toHaveBeenCalledTimes(before + 1);
  });

  it("fail-soft : connexions OAuth throw → autres sources continuent", async () => {
    const now = Date.now();
    mocks.getConnectionsByScope.mockRejectedValue(new Error("boom"));
    mocks.getScheduledMissions.mockResolvedValue([
      {
        id: "mission-a",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        name: "Daily KPI",
        input: "...",
        schedule: "0 9 * * *",
        enabled: true,
        createdAt: now - 86_400_000,
        lastRunAt: now - 60_000,
        lastRunStatus: "failed",
      },
    ]);

    const signals = await getAmbientSignals(
      USER_ID,
      TENANT_ID,
      WORKSPACE_ID,
      "1h",
    );
    expect(signals.some((s) => s.kind === "mission_failed")).toBe(true);
  });

  it("fail-soft : missions throw → autres sources continuent", async () => {
    mocks.getScheduledMissions.mockRejectedValue(new Error("crash"));
    mocks.getMemoryMissions.mockImplementation(() => {
      throw new Error("crash memory");
    });
    mocks.getConnectionsByScope.mockResolvedValue([
      {
        provider: "slack",
        status: "error",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
      },
    ]);

    const signals = await getAmbientSignals(
      USER_ID,
      TENANT_ID,
      WORKSPACE_ID,
      "1h",
    );
    // missions sources fail → ok ; oauth_expired doit remonter
    expect(signals.some((s) => s.kind === "oauth_expired")).toBe(true);
  });

  it("format : chaque signal a id, kind, narration ≤140ch, detectedAt ISO, severity", async () => {
    const now = Date.now();
    mocks.getScheduledMissions.mockResolvedValue([
      {
        id: "mission-a",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        name: "Daily KPI",
        input: "...",
        schedule: "0 9 * * *",
        enabled: true,
        createdAt: now - 86_400_000,
        lastRunAt: now - 60_000,
        lastRunStatus: "failed",
      },
    ]);
    mocks.getConnectionsByScope.mockResolvedValue([
      {
        provider: "google",
        status: "error",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
      },
    ]);

    const signals = await getAmbientSignals(
      USER_ID,
      TENANT_ID,
      WORKSPACE_ID,
      "1h",
    );

    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(typeof s.id).toBe("string");
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.kind).toBe("string");
      expect(typeof s.narration).toBe("string");
      expect(s.narration.length).toBeLessThanOrEqual(140);
      expect(() => new Date(s.detectedAt).toISOString()).not.toThrow();
      // ISO 8601 valide
      expect(s.detectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(["info", "warning"]).toContain(s.severity);
    }
  });

  it("brief stale > 6h → signal brief_stale", async () => {
    const now = Date.now();
    mocks.loadLatestInboxBrief.mockResolvedValue({
      generatedAt: now - 8 * 60 * 60_000, // 8h
    });

    const signals = await getAmbientSignals(
      USER_ID,
      TENANT_ID,
      WORKSPACE_ID,
      "all",
    );
    expect(signals.some((s) => s.kind === "brief_stale")).toBe(true);
  });

  it("mission silencieuse > 7j → signal mission_silent", async () => {
    const now = Date.now();
    mocks.getScheduledMissions.mockResolvedValue([
      {
        id: "mission-z",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        name: "Weekly Audit",
        input: "...",
        schedule: "0 9 * * 1",
        enabled: true,
        createdAt: now - 30 * 86_400_000,
        lastRunAt: now - 8 * 86_400_000, // 8j
        lastRunStatus: "success",
      },
    ]);

    const signals = await getAmbientSignals(
      USER_ID,
      TENANT_ID,
      WORKSPACE_ID,
      "all",
    );
    expect(signals.some((s) => s.kind === "mission_silent")).toBe(true);
  });
});
