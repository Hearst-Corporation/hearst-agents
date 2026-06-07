/**
 * Tests for lib/engine/orchestrator/llm-candidates.ts
 *
 * Verifies:
 *  - Primary candidate = Kimi when KIMI_API_KEY is set (happy-path invariant)
 *  - Primary candidate = OpenAI with ORCHESTRATOR_MODEL_OAI when no Kimi (P1 fix)
 *  - Fallback candidates are appended when both keys present
 *  - Single-provider env → list length 1 (no regression)
 *  - Anthropic shim candidate only when ANTHROPIC_OPENAI_COMPAT_BASE_URL is set
 *  - Empty env → default OpenAI candidate (no crash)
 *  - Kimi primary + OpenAI fallback: fallback uses gpt-4.1 NOT ORCHESTRATOR_MODEL_OAI
 */

import { describe, expect, it } from "vitest";
import { buildLlmCandidates } from "@/lib/engine/orchestrator/llm-candidates";

describe("buildLlmCandidates", () => {
  it("primary = kimi when KIMI_API_KEY is set", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      KIMI_API_KEY: "sk-kimi",
      KIMI_BASE_URL: "https://kimi.example.com/v1",
    });
    expect(candidates[0].providerKey).toBe("kimi");
    expect(candidates[0].modelId).toBe("kimi-k2.6");
    expect(candidates[0].apiKey).toBe("sk-kimi");
    expect(candidates[0].baseURL).toBe("https://kimi.example.com/v1");
  });

  it("primary = openai default (gpt-4.1) when no Kimi key and no ORCHESTRATOR_MODEL_OAI", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
    });
    expect(candidates[0].providerKey).toBe("openai");
    expect(candidates[0].modelId).toBe("gpt-4.1");
    expect(candidates[0].apiKey).toBe("sk-openai");
  });

  // P1 regression fix: ORCHESTRATOR_MODEL_OAI must be respected when OpenAI is primary.
  it("OpenAI primary (Kimi off) respects ORCHESTRATOR_MODEL_OAI=gpt-4o", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
      ORCHESTRATOR_MODEL_OAI: "gpt-4o",
    });
    expect(candidates[0].providerKey).toBe("openai");
    expect(candidates[0].modelId).toBe("gpt-4o");
  });

  it("single provider env → list length 1 (no regression)", () => {
    const candidatesKimiOnly = buildLlmCandidates({
      NODE_ENV: "test",
      KIMI_API_KEY: "sk-kimi",
      KIMI_BASE_URL: "https://kimi.example.com/v1",
    });
    expect(candidatesKimiOnly).toHaveLength(1);

    const candidatesOpenAIOnly = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
    });
    expect(candidatesOpenAIOnly).toHaveLength(1);
  });

  it("kimi + openai → 2 candidates, kimi first", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      KIMI_API_KEY: "sk-kimi",
      KIMI_BASE_URL: "https://kimi.example.com/v1",
      OPENAI_API_KEY: "sk-openai",
    });
    expect(candidates).toHaveLength(2);
    expect(candidates[0].providerKey).toBe("kimi");
    expect(candidates[1].providerKey).toBe("openai");
  });

  // P1 regression fix: when Kimi is primary, the OpenAI fallback modelId must be
  // an actual OpenAI model id, NOT ORCHESTRATOR_MODEL_OAI (which carries the Kimi id).
  it("Kimi primary + OpenAI fallback → fallback modelId = gpt-4.1 (not kimi-k2.6)", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      KIMI_API_KEY: "sk-kimi",
      KIMI_BASE_URL: "https://kimi.example.com/v1",
      OPENAI_API_KEY: "sk-openai",
      // ORCHESTRATOR_MODEL_OAI is intentionally absent — it defaults to the Kimi
      // model id and must NOT bleed into the OpenAI fallback candidate.
    });
    expect(candidates[0].providerKey).toBe("kimi");
    expect(candidates[1].providerKey).toBe("openai");
    expect(candidates[1].modelId).toBe("gpt-4.1");
    // Sanity: modelId must not be a Kimi id.
    expect(candidates[1].modelId).not.toMatch(/kimi/i);
  });

  it("kimi + openai + anthropic shim → 3 candidates", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      KIMI_API_KEY: "sk-kimi",
      KIMI_BASE_URL: "https://kimi.example.com/v1",
      OPENAI_API_KEY: "sk-openai",
      ANTHROPIC_API_KEY: "sk-anthropic",
      ANTHROPIC_OPENAI_COMPAT_BASE_URL: "https://anthropic-compat.example.com/v1",
    });
    expect(candidates).toHaveLength(3);
    expect(candidates[2].providerKey).toBe("anthropic");
  });

  it("anthropic without ANTHROPIC_OPENAI_COMPAT_BASE_URL → not included", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      KIMI_API_KEY: "sk-kimi",
      KIMI_BASE_URL: "https://kimi.example.com/v1",
      ANTHROPIC_API_KEY: "sk-anthropic",
      // ANTHROPIC_OPENAI_COMPAT_BASE_URL not set
    });
    expect(candidates.find((c) => c.providerKey === "anthropic")).toBeUndefined();
  });

  it("ORCHESTRATOR_MODEL_OAI overrides the primary modelId when Kimi is primary", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      KIMI_API_KEY: "sk-kimi",
      KIMI_BASE_URL: "https://kimi.example.com/v1",
      ORCHESTRATOR_MODEL_OAI: "kimi-k2.7",
    });
    expect(candidates[0].modelId).toBe("kimi-k2.7");
  });

  it("empty env → single default openai candidate (no crash)", () => {
    const candidates = buildLlmCandidates({ NODE_ENV: "test" });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].providerKey).toBe("openai");
    expect(candidates[0].modelId).toBe("gpt-4.1");
  });

  it("kimi fallback baseURL in test env when KIMI_BASE_URL absent", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      KIMI_API_KEY: "sk-kimi",
      // KIMI_BASE_URL absent → should use test placeholder
    });
    expect(candidates[0].providerKey).toBe("kimi");
    expect(candidates[0].baseURL).toBe("https://kimi.test/v1");
  });
});
