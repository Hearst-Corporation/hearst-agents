/**
 * LLM Candidate List — Stream B robustness.
 *
 * Builds an ordered list of LLM provider configs to try for the AI pipeline.
 * OpenAI is the sole primary provider. Anthropic (via an OpenAI-compat shim)
 * is an optional last-resort fallback.
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
 * Order:
 *  1. OpenAI  — primary (OPENAI_API_KEY, model = ORCHESTRATOR_MODEL_OAI ?? "gpt-4.1")
 *  2. Anthropic (OpenAI-compat shim) — only if ANTHROPIC_OPENAI_COMPAT_BASE_URL is set
 *
 * Accepts an optional env override so the function is unit-testable without
 * touching process.env.
 */
export function buildLlmCandidates(env: Partial<NodeJS.ProcessEnv> = process.env): LlmCandidate[] {
  const candidates: LlmCandidate[] = [];

  // ── 1. OpenAI (primary) ───────────────────────────────────────────────────
  const openaiApiKey = env.OPENAI_API_KEY;
  if (openaiApiKey) {
    candidates.push({
      providerKey: "openai",
      modelId: env.ORCHESTRATOR_MODEL_OAI ?? "gpt-4.1",
      apiKey: openaiApiKey,
      baseURL: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    });
  }

  // ── 2. Anthropic (OpenAI-compat shim, last resort) ────────────────────────
  // Only included when an explicit Anthropic-compat base URL is configured;
  // the native Anthropic API is NOT OpenAI-compatible so we cannot use
  // createOpenAI() against it without a shim layer.
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  const anthropicBaseURL = env.ANTHROPIC_OPENAI_COMPAT_BASE_URL; // opt-in only
  if (anthropicApiKey && anthropicBaseURL) {
    candidates.push({
      providerKey: "anthropic",
      modelId: env.ANTHROPIC_ORCHESTRATOR_MODEL ?? "claude-sonnet-4-6",
      apiKey: anthropicApiKey,
      baseURL: anthropicBaseURL,
    });
  }

  // ── Static fallback when nothing is configured ────────────────────────────
  if (candidates.length === 0) {
    candidates.push({
      providerKey: "openai",
      modelId: env.ORCHESTRATOR_MODEL_OAI ?? "gpt-4.1",
      apiKey: env.OPENAI_API_KEY ?? "",
      baseURL: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    });
  }

  return candidates;
}
