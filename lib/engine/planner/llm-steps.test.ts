/**
 * Unit tests for generateStepsLLM.
 *
 * chatWithCircuitBreaker is mocked so no real LLM call is ever made.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock chatWithCircuitBreaker ────────────────────────────────

const mockChat = vi.fn();

vi.mock("@/lib/llm/safe-chat", () => ({
  chatWithCircuitBreaker: (...args: unknown[]) => mockChat(...args),
}));

// PLANNER_MODEL / PLANNER_PROVIDER come from system-prompt — stub them
vi.mock("@/lib/engine/orchestrator/system-prompt", () => ({
  PLANNER_MODEL: "gpt-4o",
  PLANNER_PROVIDER: "openai",
}));

import { generateStepsLLM } from "./llm-steps";

// ── Helpers ────────────────────────────────────────────────────

function mockOk(content: string) {
  mockChat.mockResolvedValue({ ok: true, content });
}

function mockFail() {
  mockChat.mockResolvedValue({ ok: false });
}

// ── Tests ──────────────────────────────────────────────────────

describe("generateStepsLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) valid JSON → returns parsed InferredStep[]", async () => {
    const payload = JSON.stringify({
      steps: [
        {
          kind: "read",
          title: "Fetch emails",
          capability: "messaging",
          tool: null,
          expectedOutput: "raw_messages",
        },
        {
          kind: "analyze",
          title: "Analyse content",
          capability: null,
          tool: null,
          expectedOutput: "analysis",
        },
      ],
    });
    mockOk(payload);

    const result = await generateStepsLLM("résume mes emails", "one_shot");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].kind).toBe("read");
    expect(result![1].kind).toBe("analyze");
  });

  it("(b) JSON wrapped in ```json fences → parsed correctly", async () => {
    const payload =
      "```json\n" +
      JSON.stringify({
        steps: [
          {
            kind: "synthesize",
            title: "Synthèse",
            capability: null,
            tool: null,
            expectedOutput: "summary",
          },
        ],
      }) +
      "\n```";
    mockOk(payload);

    const result = await generateStepsLLM("résume la semaine", "one_shot");
    expect(result).not.toBeNull();
    expect(result![0].kind).toBe("synthesize");
  });

  it("(c) invalid JSON → returns null", async () => {
    mockOk("NOT_JSON {{broken");

    const result = await generateStepsLLM("test", "one_shot");
    expect(result).toBeNull();
  });

  it("(d) ok:false → returns null", async () => {
    mockFail();

    const result = await generateStepsLLM("test", "one_shot");
    expect(result).toBeNull();
  });

  it("(e) step with unknown kind is dropped; valid steps retained", async () => {
    const payload = JSON.stringify({
      steps: [
        {
          kind: "INVALID_KIND",
          title: "Bad step",
          capability: null,
          tool: null,
          expectedOutput: "x",
        },
        {
          kind: "deliver",
          title: "Send email",
          capability: "messaging_send",
          tool: "send_message",
          expectedOutput: "delivery_confirmation",
        },
      ],
    });
    mockOk(payload);

    const result = await generateStepsLLM("envoie un email", "one_shot");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].kind).toBe("deliver");
  });

  it("(f) all steps have invalid kinds (0 valid) → returns null", async () => {
    const payload = JSON.stringify({
      steps: [
        { kind: "think", title: "Think hard", capability: null, tool: null, expectedOutput: "x" },
        { kind: "plan_it", title: "Plan it", capability: null, tool: null, expectedOutput: "y" },
      ],
    });
    mockOk(payload);

    const result = await generateStepsLLM("bad intent", "one_shot");
    expect(result).toBeNull();
  });

  it("title falls back to 'Étape' when missing or empty", async () => {
    const payload = JSON.stringify({
      steps: [
        { kind: "analyze", title: "", capability: null, tool: null, expectedOutput: "analysis" },
      ],
    });
    mockOk(payload);

    const result = await generateStepsLLM("analyse", "one_shot");
    expect(result).not.toBeNull();
    expect(result![0].title).toBe("Étape");
  });

  it("passes plan type in user message to chatWithCircuitBreaker", async () => {
    const payload = JSON.stringify({
      steps: [
        {
          kind: "monitor",
          title: "Surveillance",
          capability: null,
          tool: null,
          expectedOutput: "alerts",
        },
      ],
    });
    mockOk(payload);

    await generateStepsLLM("surveille les emails", "monitoring");

    const callArgs = mockChat.mock.calls[0][0];
    const userMsg = callArgs.chatRequest.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg.content).toContain("monitoring");
  });
});
