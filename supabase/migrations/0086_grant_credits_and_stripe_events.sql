-- ============================================================
-- 0086 — Grant credits function + Stripe events idempotence
--
-- Ajoute :
--   1. RPC grant_credits() pour créditer un user (top-up, admin, trial)
--   2. Table stripe_events pour l'idempotence des webhooks Stripe
-- ============================================================

-- ── grant_credits — crédite le solde d'un user ──────────────

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id uuid,
  p_amount_usd numeric,
  p_source text,
  p_description text
) RETURNS void AS $$
DECLARE
  v_tenant_id text;
  v_new_balance numeric;
BEGIN
  -- Récupérer le tenant_id du user (premier trouvé)
  SELECT tenant_id INTO v_tenant_id
  FROM public.user_credits
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Si le user n'existe pas encore, on utilise un tenant par défaut
  -- (le webhook Stripe n'a pas le tenant_id, seulement le userId)
  IF v_tenant_id IS NULL THEN
    v_tenant_id := 'default';
  END IF;

  -- Upsert le solde (crée si absent, ajoute sinon)
  INSERT INTO public.user_credits (user_id, tenant_id, balance_usd, reserved_usd)
  VALUES (p_user_id, v_tenant_id, p_amount_usd, 0)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET balance_usd = public.user_credits.balance_usd + EXCLUDED.balance_usd,
        updated_at = now()
  RETURNING balance_usd INTO v_new_balance;

  -- Tracer dans le ledger
  INSERT INTO public.credit_ledger (
    user_id, tenant_id, operation, amount_usd, balance_after_usd, description
  ) VALUES (
    p_user_id, v_tenant_id, 'purchase', p_amount_usd, v_new_balance, p_description
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── stripe_events — idempotence webhook Stripe ──────────────

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  amount_usd      numeric(18,6),
  user_id         uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_stripe_id
  ON public.stripe_events(stripe_event_id);

-- RLS
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_events_service_all ON public.stripe_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
