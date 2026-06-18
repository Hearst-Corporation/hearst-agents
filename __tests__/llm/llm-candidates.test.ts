/**
 * Tests for lib/engine/orchestrator/llm-candidates.ts
 *
 * Verifies:
 *  - Primary candidate = OpenAI with ORCHESTRATOR_MODEL_OAI (or default gpt-4.1)
 *  - ORCHESTRATOR_MODEL_OAI override is respected
 *  - Anthropic shim candidate only when ANTHROPIC_OPENAI_COMPAT_BASE_URL is set
 *  - Empty env → default OpenAI candidate (no crash)
 */

import { describe, expect, it } from "vitest";
import { buildLlmCandidates } from "@/lib/engine/orchestrator/llm-candidates";

describe("buildLlmCandidates", () => {
  it("primary = openai default (gpt-4.1) when no ORCHESTRATOR_MODEL_OAI", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
    });
    expect(candidates[0].providerKey).toBe("openai");
    expect(candidates[0].modelId).toBe("gpt-4.1");
    expect(candidates[0].apiKey).toBe("sk-openai");
  });

  it("respects ORCHESTRATOR_MODEL_OAI=gpt-4o", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
      ORCHESTRATOR_MODEL_OAI: "gpt-4o",
    });
    expect(candidates[0].providerKey).toBe("openai");
    expect(candidates[0].modelId).toBe("gpt-4o");
  });

  it("single provider env → list length 1 (no regression)", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
    });
    expect(candidates).toHaveLength(1);
  });

  it("openai + anthropic shim → 2 candidates", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
      ANTHROPIC_API_KEY: "sk-anthropic",
      ANTHROPIC_OPENAI_COMPAT_BASE_URL: "https://anthropic-compat.example.com/v1",
    });
    expect(candidates).toHaveLength(2);
    expect(candidates[0].providerKey).toBe("openai");
    expect(candidates[1].providerKey).toBe("anthropic");
  });

  it("anthropic without ANTHROPIC_OPENAI_COMPAT_BASE_URL → not included", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
      ANTHROPIC_API_KEY: "sk-anthropic",
      // ANTHROPIC_OPENAI_COMPAT_BASE_URL not set
    });
    expect(candidates.find((c) => c.providerKey === "anthropic")).toBeUndefined();
  });

  it("empty env → single default openai candidate (no crash)", () => {
    const candidates = buildLlmCandidates({ NODE_ENV: "test" });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].providerKey).toBe("openai");
    expect(candidates[0].modelId).toBe("gpt-4.1");
  });
});
