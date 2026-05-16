-- Migration 0087 — Table llm_runs : persistance per-call LLM (F-MISSING-METRICS-PERSIST)
--
-- Chaque appel LLM routé via lib/llm/router.ts est désormais écrit en DB via
-- le hook fire-and-forget persistRun(). Aucun PII : seulement metadata + tokens + cost.
--
-- Table public.tenants créée en 0070. public.users existe depuis le bootstrap.

BEGIN;

CREATE TABLE IF NOT EXISTS public.llm_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  conversation_id UUID,
  run_id UUID,
  provider TEXT NOT NULL,
  -- "kimi" | "anthropic" | "openai" | "gemini" | "composer"
  model TEXT NOT NULL,
  -- ex. "kimi-k2.5", "claude-sonnet-4-6", "gpt-4o", etc.
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd NUMERIC(10, 6),
  latency_ms INT,
  status TEXT NOT NULL,
  -- "success" | "failed" | "timeout"
  error_code TEXT,
  provider_request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes essentiels pour les queries dashboard + monitoring failed
CREATE INDEX IF NOT EXISTS idx_llm_runs_tenant_created
  ON public.llm_runs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_runs_user_created
  ON public.llm_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_runs_status
  ON public.llm_runs(status) WHERE status != 'success';

CREATE INDEX IF NOT EXISTS idx_llm_runs_provider_model
  ON public.llm_runs(provider, model);

-- RLS : lecture tenant-scoped uniquement, INSERT réservé au service_role côté serveur
ALTER TABLE public.llm_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llm_runs_tenant_select"
  ON public.llm_runs
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Pas de policy INSERT public : le hook persistRun() utilise service_role key

COMMIT;
