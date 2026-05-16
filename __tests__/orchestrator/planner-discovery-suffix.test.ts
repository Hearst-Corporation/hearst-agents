import { beforeEach, describe, expect, it, vi } from "vitest";

const { messagesCreate, createPlanSpy } = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
  createPlanSpy: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: messagesCreate,
      },
    };
  },
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

function okResponse(text = "ok") {
  return {
    choices: [
      {
        message: {
          tool_calls: [
            {
              id: "t1",
              function: {
                name: "text_response",
                arguments: JSON.stringify({ text }),
              },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  };
}

describe("planFromIntent — system prompt blocks", () => {
  beforeEach(() => {
    process.env.KIMI_API_KEY = "sk-test";
    messagesCreate.mockReset();
  });

  it("always emits the inline-connect guidance block, even with no discoveredActions", async () => {
    messagesCreate.mockResolvedValueOnce(okResponse());
    await planFromIntent({} as never, fakeEngine() as never, "hello", [], { surface: "home" });
    const params = messagesCreate.mock.calls[0][0];
    const systemMessages = params.messages.filter((m: { role: string }) => m.role === "system");
    expect(systemMessages).toHaveLength(2);
    expect(systemMessages[1].content).toMatch(/INLINE CONNECT/);
  });

  it("appends a SECOND uncached block listing per-user actions when provided", async () => {
    messagesCreate.mockResolvedValueOnce(okResponse());
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], {
      discoveredActions: ["GMAIL_SEND_EMAIL", "SLACKBOT_SEND_MESSAGE"],
    });
    const params = messagesCreate.mock.calls[0][0];
    const systemMessages = params.messages.filter((m: { role: string }) => m.role === "system");
    expect(systemMessages).toHaveLength(2);
    expect(systemMessages[1].content).toContain("GMAIL_SEND_EMAIL");
    expect(systemMessages[1].content).toContain("SLACKBOT_SEND_MESSAGE");
  });

  it("includes the draft-first write rule when discoveredActions contains a write op", async () => {
    messagesCreate.mockResolvedValueOnce(okResponse());
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], {
      discoveredActions: ["GMAIL_SEND_EMAIL"],
    });
    const params = messagesCreate.mock.calls[0][0];
    const systemMessages = params.messages.filter((m: { role: string }) => m.role === "system");
    const text = systemMessages[1].content as string;
    expect(text).toMatch(/WRITE ACTIONS DETECTED/);
    expect(text).toMatch(/Confirmer l'envoi/);
    expect(text).toMatch(/non-negotiable/);
  });

  it("omits the write rule when only read ops are connected", async () => {
    messagesCreate.mockResolvedValueOnce(okResponse());
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], {
      discoveredActions: ["GMAIL_FETCH_EMAILS", "GMAIL_LIST_THREADS"],
    });
    const params = messagesCreate.mock.calls[0][0];
    const systemMessages = params.messages.filter((m: { role: string }) => m.role === "system");
    const text = systemMessages[1].content as string;
    expect(text).not.toMatch(/WRITE ACTIONS DETECTED/);
  });

  it("truncates the action list at 80 names and reports the overflow count", async () => {
    const lots = Array.from({ length: 120 }, (_, i) => `APP_ACTION_${i}`);
    messagesCreate.mockResolvedValueOnce(okResponse());
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], {
      discoveredActions: lots,
    });
    const params = messagesCreate.mock.calls[0][0];
    const systemMessages = params.messages.filter((m: { role: string }) => m.role === "system");
    const text = systemMessages[1].content as string;
    expect(text).toContain("APP_ACTION_0");
    expect(text).toContain("APP_ACTION_79");
    expect(text).not.toContain("APP_ACTION_80");
    expect(text).toContain("+40 more");
  });

  it("still accepts the legacy positional (surface, capabilityDomain) signature", async () => {
    messagesCreate.mockResolvedValueOnce(okResponse());
    await planFromIntent({} as never, fakeEngine() as never, "hi", [], "inbox", "communication");
    const params = messagesCreate.mock.calls[0][0];
    const systemMessages = params.messages.filter((m: { role: string }) => m.role === "system");
    expect(systemMessages).toHaveLength(2);
  });

  it("handles request_connection tool_use in the LLM response", async () => {
    messagesCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: "tc1",
                function: {
                  name: "request_connection",
                  arguments: JSON.stringify({ app: "Slack", reason: "Pour envoyer ce message." }),
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
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
