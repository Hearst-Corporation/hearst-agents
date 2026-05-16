import { beforeEach, describe, expect, it, vi } from "vitest";

const { chatMock, createPlanSpy } = vi.hoisted(() => ({
  chatMock: vi.fn(),
  createPlanSpy: vi.fn(),
}));

// F002 — planner.ts utilise désormais getProvider("kimi").chat() via le router.
vi.mock("@/lib/llm/router", () => ({
  getProvider: (_name: string) => ({ chat: chatMock, name: _name }),
}));

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: vi.fn().mockReturnValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

vi.mock("@/lib/llm/metrics", () => ({
  defaultMetrics: { recordCall: vi.fn(), recordError: vi.fn() },
}));

vi.mock("@/lib/engine/runtime/plans/store", () => ({
  PlanStore: class {
    createPlan = createPlanSpy;
  },
}));

import { planFromIntent } from "@/lib/engine/orchestrator/planner";

function fakeEngine() {
  return {
    id: "run-test",
    cost: { track: vi.fn().mockResolvedValue(undefined) },
    attachPlanId: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Simule une réponse "text_response" de Kimi via le LLMProvider.
 * content est du JSON structuré avec tool_calls (format produit par Kimi
 * quand guidé par le system prompt avec les schémas outils).
 */
function okResponse(text = "ok") {
  return {
    content: JSON.stringify({
      tool_calls: [
        {
          function: {
            name: "text_response",
            arguments: JSON.stringify({ text }),
          },
        },
      ],
    }),
    tokens_in: 1,
    tokens_out: 1,
    latency_ms: 10,
    model: "kimi-k2.5",
    provider: "kimi",
    cost_usd: 0,
  };
}

describe("planFromIntent — system prompt blocks", () => {
  beforeEach(() => {
    process.env.KIMI_API_KEY = "sk-test";
    chatMock.mockReset().mockResolvedValue(okResponse());
  });

  it("always emits the inline-connect guidance block, even with no discoveredActions", async () => {
    await planFromIntent({} as never, fakeEngine() as never, "hello", [], { surface: "home" });
    const req = chatMock.mock.calls[0][0];
    const systemMessages = req.messages.filter((m: { role: string }) => m.role === "system");
    expect(systemMessages).toHaveLength(2);
    expect(systemMessages[1].content).toMatch(/INLINE CONNECT/);
  });

  it("appends a SECOND uncached block listing per-user actions when provided", async () => {
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], {
      discoveredActions: ["GMAIL_SEND_EMAIL", "SLACKBOT_SEND_MESSAGE"],
    });
    const req = chatMock.mock.calls[0][0];
    const systemMessages = req.messages.filter((m: { role: string }) => m.role === "system");
    expect(systemMessages).toHaveLength(2);
    expect(systemMessages[1].content).toContain("GMAIL_SEND_EMAIL");
    expect(systemMessages[1].content).toContain("SLACKBOT_SEND_MESSAGE");
  });

  it("includes the draft-first write rule when discoveredActions contains a write op", async () => {
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], {
      discoveredActions: ["GMAIL_SEND_EMAIL"],
    });
    const req = chatMock.mock.calls[0][0];
    const systemMessages = req.messages.filter((m: { role: string }) => m.role === "system");
    const text = systemMessages[1].content as string;
    expect(text).toMatch(/WRITE ACTIONS DETECTED/);
    expect(text).toMatch(/Confirmer l'envoi/);
    expect(text).toMatch(/non-negotiable/);
  });

  it("omits the write rule when only read ops are connected", async () => {
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], {
      discoveredActions: ["GMAIL_FETCH_EMAILS", "GMAIL_LIST_THREADS"],
    });
    const req = chatMock.mock.calls[0][0];
    const systemMessages = req.messages.filter((m: { role: string }) => m.role === "system");
    const text = systemMessages[1].content as string;
    expect(text).not.toMatch(/WRITE ACTIONS DETECTED/);
  });

  it("truncates the action list at 80 names and reports the overflow count", async () => {
    const lots = Array.from({ length: 120 }, (_, i) => `APP_ACTION_${i}`);
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], {
      discoveredActions: lots,
    });
    const req = chatMock.mock.calls[0][0];
    const systemMessages = req.messages.filter((m: { role: string }) => m.role === "system");
    const text = systemMessages[1].content as string;
    expect(text).toContain("APP_ACTION_0");
    expect(text).toContain("APP_ACTION_79");
    expect(text).not.toContain("APP_ACTION_80");
    expect(text).toContain("+40 more");
  });

  it("still accepts the legacy positional (surface, capabilityDomain) signature", async () => {
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], "inbox", "communication");
    const req = chatMock.mock.calls[0][0];
    const systemMessages = req.messages.filter((m: { role: string }) => m.role === "system");
    expect(systemMessages).toHaveLength(2);
  });

  it("handles request_connection tool_use in the LLM response", async () => {
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        tool_calls: [
          {
            function: {
              name: "request_connection",
              arguments: JSON.stringify({ app: "Slack", reason: "Pour envoyer ce message." }),
            },
          },
        ],
      }),
      tokens_in: 1,
      tokens_out: 1,
      latency_ms: 10,
      model: "kimi-k2.5",
      provider: "kimi",
      cost_usd: 0,
    });
    const { planFromIntent: pf } = await import("@/lib/engine/orchestrator/planner");
    const r = await pf({} as never, fakeEngine() as never, "envoie un slack", [], {
      discoveredActions: [],
    });
    expect(r.kind).toBe("request_connection");
    if (r.kind === "request_connection") {
      expect(r.app).toBe("slack");
      expect(r.reason).toBe("Pour envoyer ce message.");
    }
  });
});
