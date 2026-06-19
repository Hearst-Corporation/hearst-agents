/**
 * LLM Candidate List — Stream B robustness.
 *
 * OpenAI ONLY (décision 2026-06-19 : Kimi & Anthropic retirés de l'orchestrateur).
 * Chaîne de fallback même-provider : gpt-4.1 (primary) → gpt-4o (secours).
 *
 * Each candidate carries everything needed to call createOpenAI():
 *   - providerKey : circuit-breaker key
 *   - modelId     : passed to llmClient.chat() and computeCostUsd()
 *   - apiKey      : provider credential
 *   - baseURL     : OpenAI-compatible endpoint (undefined → SDK default)
 */

export interface LlmCandidate {
  /** Provider key used in circuit-breaker and log messages. */
  providerKey: string;
  /** Model id passed to llmClient.chat() and computeCostUsd(). */
  modelId: string;
  /** API key for createOpenAI(). */
  apiKey: string;
  /** Base URL for createOpenAI(). Absent → SDK default (api.openai.com). */
  baseURL?: string;
}

/**
 * Build the ordered fallback list from environment variables.
 *
 * Order (OpenAI only) :
 *  1. OpenAI primary  — OPENAI_API_KEY, model = ORCHESTRATOR_MODEL_OAI ?? "gpt-4.1"
 *  2. OpenAI fallback — même clé, model = ORCHESTRATOR_FALLBACK_MODEL_OAI ?? "gpt-4o"
 *
 * providerKey distinct ("openai" / "openai-fallback") pour que le circuit-breaker
 * traite les deux modèles séparément. Accepte un env override (testabilité).
 */
export function buildLlmCandidates(env: Partial<NodeJS.ProcessEnv> = process.env): LlmCandidate[] {
  const apiKey = env.OPENAI_API_KEY ?? "";
  const baseURL = env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  return [
    {
      providerKey: "openai",
      modelId: env.ORCHESTRATOR_MODEL_OAI ?? "gpt-4.1",
      apiKey,
      baseURL,
    },
    {
      providerKey: "openai-fallback",
      modelId: env.ORCHESTRATOR_FALLBACK_MODEL_OAI ?? "gpt-4o",
      apiKey,
      baseURL,
    },
  ];
}
