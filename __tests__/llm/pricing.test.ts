import { describe, it, expect } from "vitest";
import { computeCostUsd, MODEL_PRICING } from "@/lib/llm/pricing";

describe("computeCostUsd", () => {
  it("Sonnet : 1M input + 1M output = $18", () => {
    const cost = computeCostUsd("anthropic", "claude-sonnet-4-6", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(18, 1);
  });

  it("GPT-4o : 1M input + 1M output = $12.5", () => {
    const cost = computeCostUsd("openai", "gpt-4o", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(12.5, 1);
  });

  it("Gemini Flash : 1M input + 1M output = $0.5", () => {
    const cost = computeCostUsd("gemini", "gemini-2.0-flash", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.5, 2);
  });

  it("cache_read déduit de l'input standard et facturé au tarif réduit", () => {
    // 1M input dont 500k lu depuis le cache
    const pricing = MODEL_PRICING["claude-sonnet-4-6"]!;
    const cost = computeCostUsd("anthropic", "claude-sonnet-4-6", {
      input_tokens: 1_000_000,
      output_tokens: 0,
      cache_read_input_tokens: 500_000,
    });
    const expected =
      (500_000 * pricing.input) / 1_000_000 + // 500k input non-cache
      (500_000 * pricing.cacheRead) / 1_000_000; // 500k cache read
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("modèle inconnu retourne 0", () => {
    const cost = computeCostUsd("unknown", "gpt-9000-ultra", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(cost).toBe(0);
  });

  it("Opus : 100k input + 10k output ≈ $2.25", () => {
    const cost = computeCostUsd("anthropic", "claude-opus-4-7", {
      input_tokens: 100_000,
      output_tokens: 10_000,
    });
    // input: 100k * 15 / 1M = 1.5, output: 10k * 75 / 1M = 0.75
    expect(cost).toBeCloseTo(2.25, 4);
  });
});
