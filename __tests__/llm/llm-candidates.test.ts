/**
 * Tests for lib/engine/orchestrator/llm-candidates.ts
 *
 * OpenAI ONLY (Kimi & Anthropic retirés 2026-06-19). Verifies:
 *  - Primary candidate = OpenAI gpt-4.1 (ORCHESTRATOR_MODEL_OAI override respecté)
 *  - Fallback candidate = OpenAI gpt-4o (ORCHESTRATOR_FALLBACK_MODEL_OAI override respecté)
 *  - Aucun candidat Anthropic, même si ANTHROPIC_* est défini
 *  - Empty env → 2 candidats OpenAI par défaut (no crash)
 */

import { describe, expect, it } from "vitest";
import { buildLlmCandidates } from "@/lib/engine/orchestrator/llm-candidates";

describe("buildLlmCandidates", () => {
  it("primary = openai gpt-4.1, fallback = openai gpt-4o (défauts)", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
    });
    expect(candidates).toHaveLength(2);
    expect(candidates[0].providerKey).toBe("openai");
    expect(candidates[0].modelId).toBe("gpt-4.1");
    expect(candidates[0].apiKey).toBe("sk-openai");
    expect(candidates[1].providerKey).toBe("openai-fallback");
    expect(candidates[1].modelId).toBe("gpt-4o");
    expect(candidates[1].apiKey).toBe("sk-openai");
  });

  it("respecte ORCHESTRATOR_MODEL_OAI (primary)", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
      ORCHESTRATOR_MODEL_OAI: "gpt-4o",
    });
    expect(candidates[0].modelId).toBe("gpt-4o");
  });

  it("respecte ORCHESTRATOR_FALLBACK_MODEL_OAI (fallback)", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
      ORCHESTRATOR_FALLBACK_MODEL_OAI: "gpt-4.1-mini",
    });
    expect(candidates[1].modelId).toBe("gpt-4.1-mini");
  });

  it("aucun candidat Anthropic, même si ANTHROPIC_* est défini", () => {
    const candidates = buildLlmCandidates({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-openai",
      ANTHROPIC_API_KEY: "sk-anthropic",
      ANTHROPIC_OPENAI_COMPAT_BASE_URL: "https://anthropic-compat.example.com/v1",
    });
    expect(candidates.every((c) => c.providerKey.startsWith("openai"))).toBe(true);
    expect(candidates.find((c) => c.providerKey === "anthropic")).toBeUndefined();
  });

  it("empty env → 2 candidats OpenAI par défaut (no crash)", () => {
    const candidates = buildLlmCandidates({ NODE_ENV: "test" });
    expect(candidates).toHaveLength(2);
    expect(candidates[0].modelId).toBe("gpt-4.1");
    expect(candidates[1].modelId).toBe("gpt-4o");
    expect(candidates[0].apiKey).toBe("");
  });
});
