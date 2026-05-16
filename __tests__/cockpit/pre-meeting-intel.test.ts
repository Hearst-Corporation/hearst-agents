/**
 * Tests Vitest — `lib/cockpit/pre-meeting-intel.ts`
 *
 * Couvre :
 *  - Cas nominal : event 2 participants → intel cohérent
 *  - KG empty pour un participant → kgSummary null sans crash
 *  - Cache 5min : 2 calls < 5min → 1 seul fetch
 *  - Reset cache via __clearPreMeetingIntelCache
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeComposioAction: vi.fn(),
  getUpcomingEvents: vi.fn(),
  requireServerSupabase: vi.fn(),
  anthropicCreate: vi.fn(),
}));

vi.mock("@/lib/connectors/composio/client", () => ({
  executeComposioAction: mocks.executeComposioAction,
}));

vi.mock("@/lib/connectors/google/calendar", () => ({
  getUpcomingEvents: mocks.getUpcomingEvents,
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  requireServerSupabase: mocks.requireServerSupabase,
  getServerSupabase: mocks.requireServerSupabase,
}));

vi.mock("@/lib/llm/router", () => ({
  getProvider: vi.fn(() => ({
    name: "kimi",
    chat: mocks.anthropicCreate,
    streamChat: vi.fn(),
  })),
  resetLlmProviderCache: vi.fn(),
}));

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: vi.fn(() => false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    getState: vi.fn(() => "CLOSED"),
  },
}));

import { __clearPreMeetingIntelCache, getPreMeetingIntel } from "@/lib/cockpit/pre-meeting-intel";

const SCOPE = { userId: "user-1", tenantId: "tenant-1" };
const FUTURE_TS = Date.now() + 30 * 60_000; // dans 30min
const FUTURE_ISO = new Date(FUTURE_TS).toISOString();

/**
 * Construit un fake Supabase chainable. Chaque appel à `.from(...)` retourne
 * une nouvelle instance autonome avec ses propres data/error scriptés.
 */
function buildFakeSupabase(opts: {
  /** Map nom-de-table → réponse pour maybeSingle/select */
  tables: Record<string, { data: unknown; error?: unknown }>;
}) {
  return {
    from: (table: string) => {
      const conf = opts.tables[table] ?? { data: null };
      const builder: Record<string, unknown> = {};
      const chain = ["select", "eq", "ilike", "contains", "in", "order", "limit", "gte"] as const;
      for (const fn of chain) {
        builder[fn] = vi.fn(() => builder);
      }
      builder.maybeSingle = vi.fn(async () => ({ data: conf.data, error: conf.error }));
      // Quand on n'appelle pas maybeSingle (cas .in/.select multiples), `await builder`
      // doit résoudre à { data, error }. On expose un thenable :
      builder.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: conf.data, error: conf.error });
      return builder;
    },
  };
}

describe("getPreMeetingIntel", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    process.env.KIMI_API_KEY = "fake-key";
    __clearPreMeetingIntelCache();
  });

  it("cas nominal : event avec 2 participants → 2 entrées participant", async () => {
    mocks.executeComposioAction.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "evt-1",
            summary: "Roadmap Q3",
            start: { dateTime: FUTURE_ISO },
            attendees: [
              { email: "alice@acme.com", displayName: "Alice" },
              { email: "bob@beta.io", displayName: "Bob" },
            ],
          },
        ],
      },
    });

    mocks.requireServerSupabase.mockReturnValue(
      buildFakeSupabase({
        tables: {
          kg_nodes: { data: null }, // KG vide pour les deux participants
          kg_edges: { data: [] },
        },
      }),
    );

    mocks.anthropicCreate.mockResolvedValue({
      content: "Valider roadmap · Aligner équipes · Décider next call",
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
    });

    const intel = await getPreMeetingIntel(SCOPE, "evt-1");

    expect(intel).not.toBeNull();
    expect(intel?.eventId).toBe("evt-1");
    expect(intel?.eventTitle).toBe("Roadmap Q3");
    expect(intel?.participants).toHaveLength(2);
    expect(intel?.participants[0].email).toBe("alice@acme.com");
    expect(intel?.participants[0].name).toBe("Alice");
    expect(intel?.suggestedAgenda).toContain("Valider roadmap");
  });

  it("KG empty pour un participant → kgSummary null, pas de crash", async () => {
    mocks.executeComposioAction.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "evt-2",
            summary: "Sync produit",
            start: { dateTime: FUTURE_ISO },
            attendees: [{ email: "ghost@nowhere.io", displayName: null }],
          },
        ],
      },
    });

    mocks.requireServerSupabase.mockReturnValue(
      buildFakeSupabase({
        tables: {
          kg_nodes: { data: null }, // pas de match
          kg_edges: { data: [] },
        },
      }),
    );

    mocks.anthropicCreate.mockResolvedValue({
      content: "Tour de table · Définir prochaines étapes",
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
    });

    const intel = await getPreMeetingIntel(SCOPE, "evt-2");

    expect(intel).not.toBeNull();
    expect(intel?.participants).toHaveLength(1);
    expect(intel?.participants[0].kgSummary).toBeNull();
    expect(intel?.participants[0].lastInteraction).toBeNull();
  });

  it("retourne null si aucun event ne matche l'eventId", async () => {
    mocks.executeComposioAction.mockResolvedValue({
      ok: true,
      data: { items: [] },
    });
    mocks.getUpcomingEvents.mockResolvedValue([]);

    const intel = await getPreMeetingIntel(SCOPE, "evt-inexistant");
    expect(intel).toBeNull();
  });

  it("cache 5min : 2 calls successifs → 1 seul fetch upstream", async () => {
    mocks.executeComposioAction.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "evt-cache",
            summary: "Cached",
            start: { dateTime: FUTURE_ISO },
            attendees: [],
          },
        ],
      },
    });
    mocks.requireServerSupabase.mockReturnValue(buildFakeSupabase({ tables: {} }));
    mocks.anthropicCreate.mockResolvedValue({
      content: "",
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
    });

    await getPreMeetingIntel(SCOPE, "evt-cache");
    await getPreMeetingIntel(SCOPE, "evt-cache");

    expect(mocks.executeComposioAction).toHaveBeenCalledTimes(1);
  });

  it("__clearPreMeetingIntelCache invalide le cache", async () => {
    mocks.executeComposioAction.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "evt-x",
            summary: "X",
            start: { dateTime: FUTURE_ISO },
            attendees: [],
          },
        ],
      },
    });
    mocks.requireServerSupabase.mockReturnValue(buildFakeSupabase({ tables: {} }));
    mocks.anthropicCreate.mockResolvedValue({
      content: "",
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
    });

    await getPreMeetingIntel(SCOPE, "evt-x");
    __clearPreMeetingIntelCache();
    await getPreMeetingIntel(SCOPE, "evt-x");

    expect(mocks.executeComposioAction).toHaveBeenCalledTimes(2);
  });

  it("fallback SSO Google natif si Composio échoue", async () => {
    mocks.executeComposioAction.mockResolvedValue({
      ok: false,
      error: "composio_down",
    });
    mocks.getUpcomingEvents.mockResolvedValue([
      {
        id: "evt-native",
        title: "Native event",
        startTime: FUTURE_ISO,
        endTime: new Date(FUTURE_TS + 30 * 60_000).toISOString(),
        attendees: ["Alice <alice@acme.com>"],
        isAllDay: false,
      },
    ]);
    mocks.requireServerSupabase.mockReturnValue(buildFakeSupabase({ tables: {} }));
    mocks.anthropicCreate.mockResolvedValue({
      content: "Sync rapide",
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
    });

    const intel = await getPreMeetingIntel(SCOPE, "evt-native");

    expect(intel).not.toBeNull();
    expect(intel?.eventTitle).toBe("Native event");
    expect(intel?.participants[0].email).toBe("alice@acme.com");
  });
});
