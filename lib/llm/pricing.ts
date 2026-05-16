/**
 * LLM Pricing — coût réel par modèle (USD / 1M tokens).
 *
 * Utilisé par cost-tracker.ts pour alimenter tenant_usage_daily.cost_usd
 * avec un montant réel au lieu de 0.
 *
 * Sources : pages pricing officielles (mai 2026).
 */

import { KIMI_MODELS } from "./models";

export const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  // Anthropic Claude
  "claude-opus-4-7": { input: 15.0, output: 75.0, cacheRead: 1.5 },
  "claude-opus-4": { input: 15.0, output: 75.0, cacheRead: 1.5 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheRead: 0.3 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0, cacheRead: 0.3 },
  "claude-sonnet-4": { input: 3.0, output: 15.0, cacheRead: 0.3 },
  "claude-3-7-sonnet-20250219": { input: 3.0, output: 15.0, cacheRead: 0.3 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0, cacheRead: 0.3 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0, cacheRead: 0.08 },
  "claude-haiku-4": { input: 0.8, output: 4.0, cacheRead: 0.08 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0, cacheRead: 0.08 },
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10.0, cacheRead: 1.25 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cacheRead: 0.075 },
  "gpt-4-turbo": { input: 10.0, output: 30.0, cacheRead: 5.0 },
  "gpt-4": { input: 30.0, output: 60.0, cacheRead: 15.0 },
  // Kimi (Moonshot AI via hypercli) — tarifs approximatifs
  [KIMI_MODELS.SONNET]: { input: 2.0, output: 8.0, cacheRead: 0 },
  [KIMI_MODELS.HAIKU]: { input: 2.0, output: 8.0, cacheRead: 0 },
  "kimi-k2": { input: 2.0, output: 8.0, cacheRead: 0 },
  // Google Gemini
  "gemini-2.0-flash": { input: 0.1, output: 0.4, cacheRead: 0.025 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3, cacheRead: 0.019 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0, cacheRead: 0.3125 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3, cacheRead: 0.019 },
};

/**
 * Calcule le coût USD réel d'un appel LLM.
 *
 * @param _provider - provider (non utilisé actuellement, réservé pour futures
 *   surcharges par provider)
 * @param model     - identifiant du modèle (doit correspondre à MODEL_PRICING)
 * @param usage     - tokens consommés (input, output, cache_read optionnel)
 * @returns coût en USD, 0 si modèle inconnu (avec warning)
 */
export function computeCostUsd(
  _provider: string,
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
  },
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    console.warn(`[pricing] Unknown model "${model}" — cost_usd defaulted to 0`);
    return 0;
  }
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const billableInput = usage.input_tokens - cacheRead;
  const inputCost = (billableInput * pricing.input) / 1_000_000;
  const outputCost = (usage.output_tokens * pricing.output) / 1_000_000;
  const cacheCost = (cacheRead * pricing.cacheRead) / 1_000_000;
  return inputCost + outputCost + cacheCost;
}
