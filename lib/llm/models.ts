/**
 * Model identifiers — single source of truth for OpenAI model names.
 *
 * Tier map:
 *   NANO     → cheap/volume: classifiers, KG, memory, fast-path conversational
 *   STANDARD → orchestrator/pipeline/planner (tool-calling)
 *   QUALITY  → synthesis/research, daily-brief, conversation-summary, briefing
 */

export const OPENAI_MODELS = {
  /** Cheap / high-volume: classifiers, KG, memory, action-item extraction, fast-path. */
  NANO: "gpt-4.1-nano",
  /** Orchestrator / pipeline / planner — tool-calling. */
  STANDARD: "gpt-4.1",
  /** Quality non-tool: synthesis, research, daily-brief, briefing. */
  QUALITY: "gpt-4o",
} as const;

export type OpenAIModel = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];
