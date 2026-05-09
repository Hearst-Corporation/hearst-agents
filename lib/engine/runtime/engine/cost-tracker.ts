/**
 * Cost Tracker — Atomic cost tracking for Runs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunCost, UsageMetrics } from "./types";

const EMPTY_COST: RunCost = {
  llm_input_tokens: 0,
  llm_output_tokens: 0,
  tool_calls: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

export class CostTracker {
  private accumulated: RunCost = { ...EMPTY_COST };
  /** Cache du tenant_id résolu depuis `runs` (lookup paresseux best-effort). */
  private _tenantIdCache: string | null | undefined = undefined;

  constructor(
    private db: SupabaseClient,
    private runId: string,
  ) {}

  async track(usage: UsageMetrics): Promise<void> {
    this.accumulated.llm_input_tokens += usage.input_tokens;
    this.accumulated.llm_output_tokens += usage.output_tokens;
    this.accumulated.tool_calls += usage.tool_calls;
    if (usage.cache_creation_input_tokens) {
      this.accumulated.cache_creation_input_tokens =
        (this.accumulated.cache_creation_input_tokens ?? 0) + usage.cache_creation_input_tokens;
    }
    if (usage.cache_read_input_tokens) {
      this.accumulated.cache_read_input_tokens =
        (this.accumulated.cache_read_input_tokens ?? 0) + usage.cache_read_input_tokens;
    }
    await this.flush();

    // Aggregation daily tenant usage (best-effort, ne bloque pas le flow).
    // Le lookup tenant_id est paresseux + caché ; un échec est silencieux.
    this.aggregateTenantUsage(usage).catch(() => {});
  }

  async trackToolCall(): Promise<void> {
    this.accumulated.tool_calls += 1;
    await this.flush();
  }

  getCurrent(): RunCost {
    return { ...this.accumulated };
  }

  private async flush(): Promise<void> {
    const { error } = await this.db
      .from("runs")
      .update({
        cost: this.accumulated as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.runId);

    if (error) {
      console.error("[CostTracker] flush error:", error.message);
    }
  }

  /**
   * Best-effort : alimente `tenant_usage_daily` via la RPC d'agrégation.
   * - Lookup paresseux du tenant_id depuis `runs` (caché après 1er appel).
   * - Skip silencieux si tenant_id absent ou client admin indispo.
   * - Ne propage jamais d'erreur (le flow LLM ne doit pas être bloqué).
   */
  private async aggregateTenantUsage(usage: UsageMetrics): Promise<void> {
    if (this._tenantIdCache === undefined) {
      try {
        const { data } = await this.db
          .from("runs")
          .select("tenant_id")
          .eq("id", this.runId)
          .single();
        const tid = (data as { tenant_id?: string | null } | null)?.tenant_id;
        this._tenantIdCache = tid ?? null;
      } catch {
        this._tenantIdCache = null;
      }
    }

    if (!this._tenantIdCache) return;

    // Import dynamique pour éviter de pré-charger le client admin Supabase
    // dans des contextes qui n'en ont pas besoin (tests, edge runtime).
    const tenantId = this._tenantIdCache;
    void import("../../../llm/usage-tracker")
      .then(({ incrementTenantUsage }) =>
        incrementTenantUsage({
          tenant_id: tenantId,
          provider: "unknown",
          model: "unknown",
          tokens_in: usage.input_tokens ?? 0,
          tokens_out: usage.output_tokens ?? 0,
          tokens_cached_read: usage.cache_read_input_tokens ?? 0,
          tokens_cached_create: usage.cache_creation_input_tokens ?? 0,
          cost_usd: 0,
          failed: false,
        }),
      )
      .catch(() => {});
  }
}
