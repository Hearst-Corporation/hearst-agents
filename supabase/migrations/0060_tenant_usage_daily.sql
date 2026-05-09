-- ============================================================
-- Hearst OS — Migration 0060 : Tenant usage daily aggregation
--
-- Objectif : agréger l'usage LLM (tokens + cost) par tenant et par jour
-- pour reporting long-terme (7j/30j rolling) et quotas hebdomadaires.
-- Source : `runs` table (tokens_in, tokens_out, cost_usd) → daily rollup.
--
-- Alimentée par lib/llm/usage-tracker.ts via incrementTenantUsage(),
-- elle-même appelée best-effort depuis lib/engine/runtime/engine/cost-tracker.ts.
--
-- Convention tenant_id = text (cohérent avec migrations 0051, 0053, 0057).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_usage_daily (
  tenant_id            text NOT NULL,
  usage_date           date NOT NULL,
  provider             text NOT NULL DEFAULT 'all',          -- 'anthropic' | 'openai' | 'gemini' | 'all'
  model                text NOT NULL DEFAULT 'all',          -- model_used ou 'all'
  tokens_in            bigint NOT NULL DEFAULT 0,
  tokens_out           bigint NOT NULL DEFAULT 0,
  tokens_cached_read   bigint NOT NULL DEFAULT 0,            -- Anthropic prompt cache reads
  tokens_cached_create bigint NOT NULL DEFAULT 0,            -- Anthropic prompt cache writes
  cost_usd             numeric(12,6) NOT NULL DEFAULT 0,
  request_count        integer NOT NULL DEFAULT 0,
  failed_count         integer NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, usage_date, provider, model)
);

-- Index principal : lookup rolling window par tenant
CREATE INDEX IF NOT EXISTS idx_tenant_usage_daily_tenant_date
  ON public.tenant_usage_daily (tenant_id, usage_date DESC);

-- Index secondaire : reporting cross-tenant par date (admin)
CREATE INDEX IF NOT EXISTS idx_tenant_usage_daily_date
  ON public.tenant_usage_daily (usage_date DESC);

-- RLS : agrégation côté serveur (service_role). Pattern aligné sur
-- metric_snapshots / tenant_settings — pas de table user_tenants en place,
-- l'isolation tenant est assurée applicativement par lib/llm/usage-tracker.ts.
ALTER TABLE public.tenant_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_usage_daily_service_all ON public.tenant_usage_daily;
CREATE POLICY tenant_usage_daily_service_all ON public.tenant_usage_daily
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.tenant_usage_daily IS
  'Agrégation quotidienne LLM usage par tenant. Alimentée par lib/llm/usage-tracker.ts via incrementTenantUsage(). Lue par dashboard /admin/health et reporting tenant.';

-- ============================================================
-- RPC : increment_tenant_usage_daily
--
-- UPSERT atomique (composite PK tenant_id+date+provider+model) appelé
-- depuis lib/llm/usage-tracker.ts. SECURITY DEFINER pour bypass RLS
-- côté service_role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_tenant_usage_daily(
  p_tenant_id            text,
  p_date                 date,
  p_provider             text,
  p_model                text,
  p_tokens_in            bigint,
  p_tokens_out           bigint,
  p_tokens_cached_read   bigint,
  p_tokens_cached_create bigint,
  p_cost_usd             numeric,
  p_failed               boolean
) RETURNS void AS $$
BEGIN
  INSERT INTO public.tenant_usage_daily (
    tenant_id, usage_date, provider, model,
    tokens_in, tokens_out, tokens_cached_read, tokens_cached_create,
    cost_usd, request_count, failed_count, updated_at
  ) VALUES (
    p_tenant_id, p_date, p_provider, p_model,
    p_tokens_in, p_tokens_out, p_tokens_cached_read, p_tokens_cached_create,
    p_cost_usd, 1, CASE WHEN p_failed THEN 1 ELSE 0 END, now()
  )
  ON CONFLICT (tenant_id, usage_date, provider, model) DO UPDATE SET
    tokens_in            = public.tenant_usage_daily.tokens_in + p_tokens_in,
    tokens_out           = public.tenant_usage_daily.tokens_out + p_tokens_out,
    tokens_cached_read   = public.tenant_usage_daily.tokens_cached_read + p_tokens_cached_read,
    tokens_cached_create = public.tenant_usage_daily.tokens_cached_create + p_tokens_cached_create,
    cost_usd             = public.tenant_usage_daily.cost_usd + p_cost_usd,
    request_count        = public.tenant_usage_daily.request_count + 1,
    failed_count         = public.tenant_usage_daily.failed_count + CASE WHEN p_failed THEN 1 ELSE 0 END,
    updated_at           = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_tenant_usage_daily(
  text, date, text, text, bigint, bigint, bigint, bigint, numeric, boolean
) TO service_role;
