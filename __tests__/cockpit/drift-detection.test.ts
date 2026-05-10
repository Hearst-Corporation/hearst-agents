/**
 * Tests unitaires — Drift Alert (S3-E).
 *
 * Couverture :
 *  - analyzeMissionDrift : flatten outputs JSON, compare paire à paire
 *  - 3 runs identiques → consecutiveStaleRuns = 3
 *  - Petites variations < threshold → drift confirmé
 *  - Grosse variation → consecutiveStaleRuns = 0 (la séquence est cassée)
 *  - 1 seul run → 0
 *  - Outputs incompatibles → 0 (fail-soft)
 *  - generateDriftNarration : output ≤140ch FR + cache + fallback sans API key
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Supabase via getServerSupabase ────────────────────────────────────

interface RunRow {
  id: string;
  output: unknown;
  status: string;
  finished_at: string | null;
  created_at: string;
}

const dbState = {
  runs: [] as RunRow[],
  forcedError: null as { message: string } | null,
};

class RunsBuilder {
  private filterMissionId: string | null = null;
  private filterStatus: string | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;

  select(_fields: string) {
    return this;
  }

  filter(col: string, op: string, val: string) {
    if (col === "metadata->>missionId" && op === "eq") {
      this.filterMissionId = val;
    }
    return this;
  }

  eq(col: string, val: string) {
    if (col === "status") this.filterStatus = val;
    return this;
  }

  order(col: string, opts?: { ascending: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  then<T1, T2>(
    onfulfilled?: (val: { data: RunRow[] | null; error: unknown }) => T1 | PromiseLike<T1>,
    onrejected?: (reason: unknown) => T2 | PromiseLike<T2>,
  ): Promise<T1 | T2> {
    if (dbState.forcedError) {
      return Promise.resolve({ data: null, error: dbState.forcedError }).then(
        onfulfilled,
        onrejected,
      );
    }
    let res = dbState.runs.filter((r) => {
      if (this.filterMissionId && (r as RunRow & { missionId?: string }).missionId !== this.filterMissionId)
        return false;
      if (this.filterStatus && r.status !== this.filterStatus) return false;
      return true;
    });
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      res = [...res].sort((a, b) => {
        const va = String((a as unknown as Record<string, unknown>)[col] ?? "");
        const vb = String((b as unknown as Record<string, unknown>)[col] ?? "");
        if (va === vb) return 0;
        return (va < vb ? -1 : 1) * (asc ? 1 : -1);
      });
    }
    if (this.limitN !== null) res = res.slice(0, this.limitN);
    return Promise.resolve({ data: res, error: null }).then(onfulfilled, onrejected);
  }
}

const supabaseMocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: supabaseMocks.getServerSupabase,
}));

// ── Mock Anthropic SDK ─────────────────────────────────────────────────────

const anthropicMocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => {
  // Le module utilise `new Anthropic(...)` — il faut une vraie classe pour
  // que `new` fonctionne (vi.fn() simple n'est pas constructible).
  class MockAnthropic {
    messages = { create: anthropicMocks.messagesCreate };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

// ── Imports du module testé (après mocks) ──────────────────────────────────

import {
  analyzeMissionDrift,
  generateDriftNarration,
} from "@/lib/cockpit/drift-detection";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRun(id: string, output: unknown, missionId = "m-1"): RunRow & { missionId: string } {
  return {
    id,
    output,
    status: "completed",
    finished_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    missionId,
  };
}

function setRuns(runs: Array<RunRow & { missionId?: string }>): void {
  dbState.runs = runs as RunRow[];
}

beforeEach(() => {
  dbState.runs = [];
  dbState.forcedError = null;
  // Mock supabase factory : retourne un client avec from() qui sait répondre
  supabaseMocks.getServerSupabase.mockReturnValue({
    from: () => new RunsBuilder(),
  });
  anthropicMocks.messagesCreate.mockReset();
});

// ── Tests : analyzeMissionDrift — séquences stables ────────────────────────

describe("analyzeMissionDrift — runs identiques", () => {
  it("3 runs identiques (séquence de 4 outputs strictement égaux) → consecutiveStaleRuns >= 3", async () => {
    // Pour avoir 3 paires consécutives stales, il faut 4 runs identiques.
    const sameOutput = { kpi: { revenue: 100, growth: 0.05 }, label: "stable" };
    setRuns([
      makeRun("r1", sameOutput),
      makeRun("r2", sameOutput),
      makeRun("r3", sameOutput),
      makeRun("r4", sameOutput),
    ]);

    const analysis = await analyzeMissionDrift("m-1");
    expect(analysis.consecutiveStaleRuns).toBeGreaterThanOrEqual(3);
    expect(analysis.suggestion.length).toBeGreaterThan(0);
    expect(analysis.suggestion.length).toBeLessThanOrEqual(140);
  });

  it("4 runs avec petites variations < 5% (threshold défaut) → drift détecté", async () => {
    setRuns([
      makeRun("r1", { revenue: 100, label: "ok" }),
      makeRun("r2", { revenue: 101, label: "ok" }),
      makeRun("r3", { revenue: 102, label: "ok" }),
      makeRun("r4", { revenue: 103, label: "ok" }),
    ]);
    const analysis = await analyzeMissionDrift("m-1");
    // Strings égales (delta 0), numbers ~1% de delta. Moyenne < 0.05.
    expect(analysis.consecutiveStaleRuns).toBeGreaterThanOrEqual(3);
  });
});

// ── Tests : analyzeMissionDrift — séquences avec rupture ──────────────────

describe("analyzeMissionDrift — rupture détectée", () => {
  it("4 runs avec grosse variation entre paires → 0 stale", async () => {
    setRuns([
      makeRun("r1", { revenue: 1000 }),
      makeRun("r2", { revenue: 100 }),
      makeRun("r3", { revenue: 10 }),
      makeRun("r4", { revenue: 1 }),
    ]);
    const analysis = await analyzeMissionDrift("m-1");
    expect(analysis.consecutiveStaleRuns).toBe(0);
    expect(analysis.suggestion).toBe("");
  });

  it("2 runs identiques + 1 différent (le plus récent) → séquence cassée à 0", async () => {
    // Ordre DB : par created_at desc → le plus récent en premier.
    // Si le run le plus récent diffère du suivant, la 1ʳᵉ paire est franche → stale = 0.
    setRuns([
      makeRun("r-newest", { revenue: 999 }), // changé
      makeRun("r2", { revenue: 100 }),
      makeRun("r3", { revenue: 100 }),
    ]);
    const analysis = await analyzeMissionDrift("m-1");
    expect(analysis.consecutiveStaleRuns).toBe(0);
  });
});

// ── Tests : analyzeMissionDrift — fail-soft ────────────────────────────────

describe("analyzeMissionDrift — fail-soft", () => {
  it("1 seul run → consecutiveStaleRuns = 0 (pas assez d'historique)", async () => {
    setRuns([makeRun("r1", { revenue: 100 })]);
    const analysis = await analyzeMissionDrift("m-1");
    expect(analysis.consecutiveStaleRuns).toBe(0);
  });

  it("aucun run → consecutiveStaleRuns = 0", async () => {
    setRuns([]);
    const analysis = await analyzeMissionDrift("m-1");
    expect(analysis.consecutiveStaleRuns).toBe(0);
    expect(analysis.suggestion).toBe("");
  });

  it("outputs structurellement incompatibles (clés disjointes) → 0", async () => {
    setRuns([
      makeRun("r1", { alpha: 1, beta: 2 }),
      makeRun("r2", { gamma: 3, delta: 4 }),
      makeRun("r3", { epsilon: 5, zeta: 6 }),
    ]);
    const analysis = await analyzeMissionDrift("m-1");
    // Pas d'overlap → computeDelta retourne null → break → stale = 0.
    expect(analysis.consecutiveStaleRuns).toBe(0);
  });

  it("Supabase indispo → analysis vide", async () => {
    supabaseMocks.getServerSupabase.mockReturnValue(null);
    const analysis = await analyzeMissionDrift("m-1");
    expect(analysis.consecutiveStaleRuns).toBe(0);
    expect(analysis.lastChangeAt).toBeNull();
    expect(analysis.suggestion).toBe("");
  });

  it("erreur DB → analysis vide", async () => {
    dbState.forcedError = { message: "kaboom" };
    const analysis = await analyzeMissionDrift("m-1");
    expect(analysis.consecutiveStaleRuns).toBe(0);
  });
});

// ── Tests : generateDriftNarration ─────────────────────────────────────────

describe("generateDriftNarration", () => {
  it("retourne fallback FR ≤140ch quand ANTHROPIC_API_KEY absente", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    // Titre unique pour éviter un cache hit d'un test précédent.
    const text = await generateDriftNarration("Mission unique fallback A", 4);
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(140);
    expect(text).toContain("Mission unique fallback A");
    expect(text).toContain("4");
  });

  it("appelle Claude Haiku quand ANTHROPIC_API_KEY présente, output trimé ≤140ch FR", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    anthropicMocks.messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "Veille concurrence semble figée depuis 5 runs — peut-être à re-évaluer ou à enrichir avec un nouveau signal pertinent.",
        },
      ],
    });
    const text = await generateDriftNarration("Veille concurrence", 5);
    expect(anthropicMocks.messagesCreate).toHaveBeenCalledTimes(1);
    expect(text.length).toBeLessThanOrEqual(140);
    expect(text).not.toContain("\""); // pas de guillemets
    expect(text).not.toContain("!"); // pas de point d'exclamation
  });

  it("clip à 140 chars si Haiku renvoie un texte trop long", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const longText = "A".repeat(300);
    anthropicMocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: longText }],
    });
    const text = await generateDriftNarration("Mission longue X", 3);
    expect(text.length).toBeLessThanOrEqual(140);
  });

  it("cache 1h : 2e call avec mêmes args ne re-call pas Haiku", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    anthropicMocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Mission cachée semble stagner." }],
    });
    const t1 = await generateDriftNarration("Mission cache key Z", 3);
    const t2 = await generateDriftNarration("Mission cache key Z", 3);
    expect(t1).toBe(t2);
    expect(anthropicMocks.messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("fallback si Haiku throw", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    anthropicMocks.messagesCreate.mockRejectedValue(new Error("rate limit"));
    const text = await generateDriftNarration("Mission rate-limit-test Y", 6);
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(140);
    expect(text).toContain("Mission rate-limit-test Y");
  });

  it("fallback si Haiku renvoie un block vide", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    anthropicMocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "   " }],
    });
    const text = await generateDriftNarration("Mission empty-block-test W", 3);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Mission empty-block-test W");
  });
});
