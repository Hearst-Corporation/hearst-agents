-- ============================================================
-- Atomic Reserve Credits with Idempotency (P5 PHASE 2)
--
-- SECURITY DEFINER function pour garantir l'atomicité lors de
-- réservations concurrentes. Idempotence via `idempotency_key`.
--
-- Pattern :
-- 1. Check idempotency_key → retour rapide si déjà reservé
-- 2. SELECT FOR UPDATE sur credits_balances (row lock)
-- 3. Vérifier balance >= amount
-- 4. Décrémenter balance
-- 5. INSERT credits_reservations avec idempotency_key unique
-- ============================================================

-- Créer la table credits_reservations si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.credits_reservations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  tenant_id         text NOT NULL,
  amount            numeric(18,6) NOT NULL,
  idempotency_key   text NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'released')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  settled_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_credits_reservations_user
  ON public.credits_reservations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credits_reservations_idempotency
  ON public.credits_reservations(idempotency_key)
  WHERE status = 'reserved';

-- Fonction atomique de réservation
CREATE OR REPLACE FUNCTION public.reserve_credits_atomic(
  p_user_id uuid,
  p_tenant_id text,
  p_amount numeric,
  p_idempotency_key text
) RETURNS jsonb AS $$
DECLARE
  v_balance numeric;
  v_result jsonb;
  v_reservation_id uuid;
BEGIN
  -- 1. Idempotency check : si déjà réservé, retourner l'existing
  SELECT id
  INTO v_reservation_id
  FROM public.credits_reservations
  WHERE idempotency_key = p_idempotency_key
    AND status = 'reserved'
  LIMIT 1;

  IF v_reservation_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_reservation_id,
      'user_id', p_user_id,
      'tenant_id', p_tenant_id,
      'amount', p_amount,
      'idempotency_key', p_idempotency_key,
      'status', 'reserved',
      'is_retry', true
    );
  END IF;

  -- 2. Row lock + balance check
  SELECT balance_usd INTO v_balance
  FROM public.user_credits
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Décrémenter balance + updated_at
  UPDATE public.user_credits
  SET balance_usd = balance_usd - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

  -- 4. Insérer réservation
  INSERT INTO public.credits_reservations (
    user_id, tenant_id, amount, idempotency_key, status, created_at
  )
  VALUES (p_user_id, p_tenant_id, p_amount, p_idempotency_key, 'reserved', now())
  RETURNING id INTO v_reservation_id;

  -- 5. Retourner JSON
  RETURN jsonb_build_object(
    'id', v_reservation_id,
    'user_id', p_user_id,
    'tenant_id', p_tenant_id,
    'amount', p_amount,
    'idempotency_key', p_idempotency_key,
    'status', 'reserved',
    'is_retry', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS sur credits_reservations
ALTER TABLE public.credits_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY credits_reservations_select_user ON public.credits_reservations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY credits_reservations_service_all ON public.credits_reservations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
