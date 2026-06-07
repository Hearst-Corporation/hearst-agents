/**
 * LLM Candidate List — Stream B robustness.
 *
 * Builds an ordered list of LLM provider configs to try for the AI pipeline.
 * The PRIMARY candidate mirrors the current hard-coded logic exactly so the
 * happy-path is byte-identical. Fallbacks are only attempted when the primary
 * fails to create/start the stream.
 *
 * Each candidate carries everything needed to call createOpenAI():
 *   - providerKey : circuit-breaker key (was hard-coded "kimi")
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
 *  1. Kimi direct  — if KIMI_API_KEY is set    (primary when Kimi configured)
 *  2. OpenAI       — if OPENAI_API_KEY is set  (primary when no Kimi, or 1st fallback)
 *  3. Anthropic    — if ANTHROPIC_API_KEY is set (last resort)
 *
 * When only one provider is configured, the list has length 1 and behaviour is
 * strictly identical to the current code (no regression).
 *
 * Accepts an optional env override so the function is unit-testable without
 * touching process.env.
 */
export function buildLlmCandidates(env: Partial<NodeJS.ProcessEnv> = process.env): LlmCandidate[] {
  const candidates: LlmCandidate[] = [];

  // ── 1. Kimi direct ────────────────────────────────────────────────────────
  const kimiApiKey = env.KIMI_API_KEY;
  const kimiBaseURL = env.KIMI_BASE_URL;
  if (kimiApiKey) {
    const baseURL = kimiBaseURL ?? (env.NODE_ENV === "test" ? "https://kimi.test/v1" : undefined);
    // Mirror resolveKimiRuntimeConfig: in non-test envs KIMI_BASE_URL is
    // required alongside KIMI_API_KEY. We silently skip the candidate if it's
    // absent in prod (resolveKimiRuntimeConfig would have thrown already at
    // module load time, so this guard is purely defensive here).
    if (baseURL || env.NODE_ENV === "test") {
      const resolvedBaseURL = baseURL ?? "https://kimi.test/v1";
      candidates.push({
        providerKey: "kimi",
        modelId: env.ORCHESTRATOR_MODEL_OAI ?? "kimi-k2.6",
        apiKey: kimiApiKey,
        baseURL: resolvedBaseURL,
      });
    }
  }

  // ── 2. OpenAI ─────────────────────────────────────────────────────────────
  // When Kimi is the PRIMARY (candidates.length > 0), OpenAI is a FALLBACK:
  //   → use OPENAI_FALLBACK_MODEL (or gpt-4.1) so ORCHESTRATOR_MODEL_OAI
  //     (which holds the Kimi model id) is never mistakenly passed to OpenAI.
  // When OpenAI is the PRIMARY (no Kimi), ORCHESTRATOR_MODEL_OAI is the
  //   operator override (e.g. gpt-4o) and MUST be respected here.
  const openaiApiKey = env.OPENAI_API_KEY;
  if (openaiApiKey) {
    const isOpenAIPrimary = candidates.length === 0;
    const openaiModelId = isOpenAIPrimary
      ? (env.ORCHESTRATOR_MODEL_OAI ?? "gpt-4.1")
      : (env.OPENAI_FALLBACK_MODEL ?? "gpt-4.1");
    candidates.push({
      providerKey: "openai",
      modelId: openaiModelId,
      apiKey: openaiApiKey,
      baseURL: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    });
  }

  // ── 3. Anthropic (OpenAI-compat shim) ─────────────────────────────────────
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

  // ── Fallback to the current static behaviour if nothing is configured ──────
  // This path is hit in environments where only OPENAI_API_KEY is set and no
  // Kimi key exists — matches the existing `gpt-4.1` default exactly.
  if (candidates.length === 0) {
    candidates.push({
      providerKey: "openai",
      modelId: env.ORCHESTRATOR_MODEL_OAI ?? "gpt-4.1",
      apiKey: env.OPENAI_API_KEY ?? "",
      baseURL: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    });
  }

  // Order is guaranteed by the construction above:
  //   - Kimi first (primary) when KIMI_API_KEY is set.
  //   - OpenAI first (primary) when no Kimi; ORCHESTRATOR_MODEL_OAI is then
  //     the operator override for the primary model (e.g. gpt-4o).
  //   - OpenAI as a FALLBACK (after Kimi) uses OPENAI_FALLBACK_MODEL instead
  //     of ORCHESTRATOR_MODEL_OAI, which would otherwise carry a Kimi model id.
  return candidates;
}
