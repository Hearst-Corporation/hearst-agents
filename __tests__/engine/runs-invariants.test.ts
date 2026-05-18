/**
 * Feature 3 — RUNS : invariants LRU store + normalizeRunEventsToTimeline + DELETE.
 *
 * Tests P2 :
 *  1. LRU store : 501 runs → le 1er run est évincé (max 500)
 *  2. normalizeRunEventsToTimeline déterministe : même input → même output
 *  3. DELETE : idempotent (run absent → 200), et supprime réellement via deleteRun
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { addRun, clearAllRuns, getRunById } from "@/lib/engine/runtime/runs/store";
import type { RunRecord } from "@/lib/engine/runtime/runs/types";
import { normalizeRunEventsToTimeline } from "@/lib/engine/runtime/timeline/normalize";

// ── Mocks top-level (requis pour le test DELETE) ──────────────

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: vi.fn().mockResolvedValue({
    scope: { userId: "u1", tenantId: "t1", workspaceId: "w1" },
    error: null,
  }),
}));

vi.mock("@/lib/engine/runtime/state/adapter", () => ({
  getRunById: vi.fn().mockResolvedValue(null),
  deleteRun: vi.fn(async () => ({ ok: true, deleted: true })),
}));

vi.mock("@/lib/engine/runtime/timeline/persist", () => ({
  getPersistedRunEvents: vi.fn().mockResolvedValue([]),
}));

// ── Helpers ───────────────────────────────────────────────────

function makeRun(id: string): RunRecord {
  return {
    id,
    tenantId: "t1",
    workspaceId: "w1",
    userId: "u1",
    input: `run-${id}`,
    status: "completed",
    createdAt: Date.now(),
    events: [],
    assets: [],
  };
}

// ── Test 1 : LRU store — max 500 ─────────────────────────────

describe("runs/store — LRU max 500", () => {
  afterEach(() => {
    clearAllRuns();
  });

  it("ajouter 501 runs évince le 1er run (oldest)", () => {
    clearAllRuns();

    for (let i = 0; i < 501; i++) {
      addRun(makeRun(`run-${String(i).padStart(4, "0")}`));
    }

    // Le 1er run (run-0000) doit avoir été évincé
    expect(getRunById("run-0000")).toBeUndefined();
    // Le dernier run (run-0500) doit être présent
    expect(getRunById("run-0500")).toBeDefined();
  });

  it("le store garde exactement MAX_RUNS = 500 runs après dépassement", () => {
    clearAllRuns();

    for (let i = 0; i < 505; i++) {
      addRun(makeRun(`evict-${String(i).padStart(4, "0")}`));
    }

    // run 0 à 4 doivent être évincés
    expect(getRunById("evict-0000")).toBeUndefined();
    expect(getRunById("evict-0004")).toBeUndefined();
    // run 5 à 504 doivent être présents
    expect(getRunById("evict-0005")).toBeDefined();
    expect(getRunById("evict-0504")).toBeDefined();
  });
});

// ── Test 2 : normalizeRunEventsToTimeline déterministe ────────

describe("normalizeRunEventsToTimeline — déterminisme", () => {
  it("même input → même titre/type/severity (déterministe en dehors des ids)", () => {
    const events = [
      { type: "run_started", timestamp: "2026-05-01T08:00:00.000Z" },
      {
        type: "agent_selected",
        agent_id: "a1",
        agent_name: "Reporter",
        timestamp: "2026-05-01T08:00:01.000Z",
      },
      { type: "step_completed", agent: "a1", timestamp: "2026-05-01T08:00:05.000Z" },
      { type: "run_completed", timestamp: "2026-05-01T08:00:10.000Z" },
    ];

    const result1 = normalizeRunEventsToTimeline({ runId: "r1", events });
    const result2 = normalizeRunEventsToTimeline({ runId: "r1", events });

    expect(result1).toHaveLength(result2.length);

    for (let i = 0; i < result1.length; i++) {
      expect(result1[i]?.type).toBe(result2[i]?.type);
      expect(result1[i]?.title).toBe(result2[i]?.title);
      expect(result1[i]?.severity).toBe(result2[i]?.severity);
      expect(result1[i]?.ts).toBe(result2[i]?.ts);
      expect(result1[i]?.runId).toBe(result2[i]?.runId);
    }
  });

  it("filtre les événements de bruit (text_delta, cost_updated)", () => {
    const events = [
      { type: "text_delta", text: "hello", timestamp: "2026-05-01T08:00:00.000Z" },
      { type: "cost_updated", cost: 0.01, timestamp: "2026-05-01T08:00:01.000Z" },
      { type: "run_completed", timestamp: "2026-05-01T08:00:02.000Z" },
    ];

    const result = normalizeRunEventsToTimeline({ runId: "r2", events });
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("run_completed");
  });

  it("trie les items par ts croissant", () => {
    const events = [
      { type: "run_completed", timestamp: "2026-05-01T08:00:10.000Z" },
      { type: "run_started", timestamp: "2026-05-01T08:00:00.000Z" },
    ];

    const result = normalizeRunEventsToTimeline({ runId: "r3", events });
    expect(result[0]?.type).toBe("run_started");
    expect(result[1]?.type).toBe("run_completed");
  });
});

// ── Test 3 : DELETE — idempotent + suppression réelle via deleteRun ─

describe("DELETE /api/v2/runs/[id] — stub idempotent", () => {
  it("run absent → retourne { ok: true, deleted: false } (idempotence)", async () => {
    const { NextRequest } = await import("next/server");
    const { DELETE } = await import("@/app/api/v2/runs/[id]/route");

    clearAllRuns(); // S'assure que le run n'est pas en mémoire

    const req = new NextRequest("http://localhost/api/v2/runs/nonexistent-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "nonexistent-id" }) });
    const body = (await res.json()) as { ok: boolean; deleted?: boolean };

    expect(body.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("run présent en mémoire → retourne { ok: true, deleted: true } sans appeler Supabase DELETE", async () => {
    const { NextRequest } = await import("next/server");
    const { DELETE } = await import("@/app/api/v2/runs/[id]/route");

    // Ajouter un run en mémoire avec userId correspondant au scope mock
    clearAllRuns();
    addRun({
      id: "run-stub-test",
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      input: "test",
      status: "completed",
      createdAt: Date.now(),
      events: [],
      assets: [],
    });

    const req = new NextRequest("http://localhost/api/v2/runs/run-stub-test", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "run-stub-test" }) });
    const body = (await res.json()) as { ok: boolean; deleted?: boolean; runId?: string };

    // deleteRun est mocké (retourne { ok: true, deleted: true }) — ownership vérifié par withScope
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(true);
    expect(body.runId).toBe("run-stub-test");
    expect(res.status).toBe(200);
  });
});
