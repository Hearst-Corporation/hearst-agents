import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.ANTHROPIC_API_KEY = "test-key";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn(() => ({
          withResponse: vi.fn(() =>
            Promise.resolve({
              data: {
                content: [{ type: "text", text: "Hello" }],
                stop_reason: "end_turn",
                usage: {
                  input_tokens: 100,
                  output_tokens: 50,
                  cache_creation_input_tokens: 0,
                  cache_read_input_tokens: 0,
                },
              },
              response: new Response(),
            })
          ),
        })),
        stream: vi.fn(),
      };
    },
  };
});

vi.mock("@/lib/observability/langfuse", () => ({
  startTrace: vi.fn(() => null),
}));

vi.mock("@/lib/observability/langfuse-redact", () => ({
  redactForLangfuse: vi.fn((x: unknown) => x),
}));

vi.mock("../rate-limiter", () => ({
  defaultRateLimiter: {},
}));

vi.mock("../timeout", () => ({
  makeAbortSignal: vi.fn(() => undefined),
  CHAT_TIMEOUT_MS: 30_000,
  STREAM_TIMEOUT_MS: 60_000,
}));

import { AnthropicProvider } from "../anthropic";

describe("AnthropicProvider.chat() — cost_usd réel", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  it("retourne cost_usd > 0 pour un modèle connu avec des tokens > 0", async () => {
    const response = await provider.chat({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(response.cost_usd).toBeGreaterThan(0);
  });

  it("cost_usd correspond au tarif pricing.ts (100 in + 50 out, sonnet-4-6)", async () => {
    const response = await provider.chat({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hello" }],
    });

    // claude-sonnet-4-6 : input=3.0/1M, output=15.0/1M
    // 100 tokens in  → 0.0003 USD
    // 50  tokens out → 0.00075 USD
    // total          = 0.00105 USD
    expect(response.cost_usd).toBeCloseTo(0.00105, 6);
    expect(response.tokens_in).toBe(100);
    expect(response.tokens_out).toBe(50);
  });

  it("cost_usd est 0 pour un modèle inconnu (avec warning)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await provider.chat({
      model: "unknown-model-xyz",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(response.cost_usd).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown model"));
    warnSpy.mockRestore();
  });
});
