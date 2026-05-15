/**
 * Tenant usage tracker — agrégation quotidienne LLM (tokens + cost) en DB.
 *
 * Source : appelé par CostTracker.track() ou directement après chaque call LLM.
 * Cible : table `tenant_usage_daily` (UPSERT par tenant_id + date + provider + model)
 * via la RPC `increment_tenant_usage_daily` (SECURITY DEFINER, atomique).
 *
 * Utilisé pour :
 * - Reporting long-terme (7j/30j rolling) par tenant
 * - Hard quotas mensuels (à venir)
 * - Dashboard /admin/health (cost trend)
 *
 * Best-effort : un échec d'agrégation ne casse jamais le flow LLM.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type UsageEvent = {
  tenant_id: string;
  provider: string; // 'anthropic' | 'openai' | 'gemini' | etc.
  model: string; // 'claude-opus-4-7' etc.
  tokens_in: number;
  tokens_out: number;
  tokens_cached_read?: number;
  tokens_cached_create?: number;
  cost_usd: number;
  failed?: boolean;
};

let supabaseAdmin: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdmin;
}

/**
 * Incrémente l'usage daily pour un tenant. Best-effort : un échec ne casse
 * pas le flow LLM. UPSERT atomique côté DB via RPC `increment_tenant_usage_daily`
 * (PRIMARY KEY composite tenant_id+date+provider+model).
 */
export async function incrementTenantUsage(event: UsageEvent): Promise<void> {
  if (!event.tenant_id) return;
  const client = getAdminClient();
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[usage-tracker] no supabase admin client — usage event dropped");
    }
    return;
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  try {
    const { error } = await client.rpc("increment_tenant_usage_daily", {
      p_tenant_id: event.tenant_id,
      p_date: today,
      p_provider: event.provider,
      p_model: event.model,
      p_tokens_in: event.tokens_in,
      p_tokens_out: event.tokens_out,
      p_tokens_cached_read: event.tokens_cached_read ?? 0,
      p_tokens_cached_create: event.tokens_cached_create ?? 0,
      p_cost_usd: event.cost_usd,
      p_failed: event.failed ?? false,
    });
    if (error) throw error;
  } catch (err) {
    // Best-effort : log mais ne propage pas
    Sentry.captureException(err, {
      tags: { component: "usage-tracker" },
    });
    if (process.env.NODE_ENV !== "production") {
      console.warn("[usage-tracker] increment failed:", err);
    }
  }
}

/**
 * Lecture rolling window pour reporting (dashboard /admin/health,
 * page tenant settings, etc.).
 *
 * Retourne null si le client admin n'est pas dispo ou si la lecture échoue.
 */
export async function getTenantUsage(
  tenantId: string,
  daysBack: number = 7,
): Promise<{
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  by_day: Array<{ date: string; tokens: number; cost: number }>;
} | null> {
  const client = getAdminClient();
  if (!client) return null;

  const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

  const { data, error } = await client
    .from("tenant_usage_daily")
    .select("usage_date, tokens_in, tokens_out, cost_usd")
    .eq("tenant_id", tenantId)
    .gte("usage_date", since)
    .order("usage_date", { ascending: true });

  if (error || !data) return null;

  const rows = data as Array<{
    usage_date: string;
    tokens_in: number | string;
    tokens_out: number | string;
    cost_usd: number | string;
  }>;

  const total_tokens_in = rows.reduce((s, r) => s + Number(r.tokens_in), 0);
  const total_tokens_out = rows.reduce((s, r) => s + Number(r.tokens_out), 0);
  const total_cost_usd = rows.reduce((s, r) => s + Number(r.cost_usd), 0);

  const byDay = new Map<string, { tokens: number; cost: number }>();
  for (const row of rows) {
    const cur = byDay.get(row.usage_date) ?? { tokens: 0, cost: 0 };
    cur.tokens += Number(row.tokens_in) + Number(row.tokens_out);
    cur.cost += Number(row.cost_usd);
    byDay.set(row.usage_date, cur);
  }

  return {
    total_tokens_in,
    total_tokens_out,
    total_cost_usd,
    by_day: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
  };
}
