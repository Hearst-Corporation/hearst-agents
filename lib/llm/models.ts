/**
 * Model identifiers — single source of truth for LLM provider model names.
 *
 * Replaces ~22 dispersed `"kimi-k2.5"` literals (see AUDIT-2 DUP3a).
 */

export const KIMI_MODELS = {
  /** Default fast & cheap reasoning model (Moonshot Kimi K2.5). */
  HAIKU: "kimi-k2.5",
  /** Larger/quality reasoning model (Moonshot Kimi K2.6). */
  SONNET: "kimi-k2.6",
} as const;

export type KimiModel = (typeof KIMI_MODELS)[keyof typeof KIMI_MODELS];
