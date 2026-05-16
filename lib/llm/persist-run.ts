import { logger } from "@/lib/observability/logger";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export interface PersistRunOptions {
  tenantId: string;
  userId?: string | null;
  conversationId?: string | null;
  runId?: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  latencyMs: number;
  status: "success" | "failed" | "timeout";
  errorCode?: string | null;
  providerRequestId?: string | null;
}

/** Row shape for the llm_runs table insert. */
interface LlmRunInsert {
  tenant_id: string;
  user_id: string | null;
  conversation_id: string | null;
  run_id: string | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  latency_ms: number;
  status: string;
  error_code: string | null;
  provider_request_id: string | null;
}

/**
 * Persiste les métadonnées d'un appel LLM en base.
 *
 * Fire-and-forget : ne throw JAMAIS. Les erreurs sont loguées en warn
 * pour ne pas bloquer le caller ni dégrader la dispo du router.
 *
 * Aucun PII n'est stocké : seulement provider, model, tokens, cost, latency, status.
 *
 * Utilise un client Supabase non-typé (table llm_runs pas encore dans database.types.ts
 * — elle sera régénérée après application de la migration 0087).
 */
export async function persistRun(opts: PersistRunOptions): Promise<void> {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      logger.warn({}, "[persistRun] missing Supabase env vars — skipping");
      return;
    }

    const row: LlmRunInsert = {
      tenant_id: opts.tenantId,
      user_id: opts.userId ?? null,
      conversation_id: opts.conversationId ?? null,
      run_id: opts.runId ?? null,
      provider: opts.provider,
      model: opts.model,
      input_tokens: opts.inputTokens,
      output_tokens: opts.outputTokens,
      cost_usd: opts.costUsd,
      latency_ms: opts.latencyMs,
      status: opts.status,
      error_code: opts.errorCode ?? null,
      provider_request_id: opts.providerRequestId ?? null,
    };

    const { error } = await sb.from("llm_runs").insert(row);
    if (error) {
      logger.warn({ error }, "[persistRun] insert failed");
    }
  } catch (err) {
    logger.warn({ err }, "[persistRun] threw");
    // Jamais de re-throw — fire-and-forget strict
  }
}
