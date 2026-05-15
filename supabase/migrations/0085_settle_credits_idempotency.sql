-- ============================================================
-- 0085 — Idempotency sur settle_credits()
--
-- Closes audit P0-1 "settle_credits non-idempotent".
--
-- Problème : worker-base.ts appelle settleCredits sur succès ET dans le
-- listener on("failed") de BullMQ. Sur retry transient, le même jobId
-- pouvait déclencher 2 settles → 2 lignes credit_ledger + double UPDATE
-- balance/reserved → audit pété + risque overcharge.
--
-- Fix :
--   1. UNIQUE partial index sur credit_ledger(job_id) WHERE op='job_settle'
--   2. settle_credits() catch unique_violation → no-op (retry-safe)
--   3. INSERT ledger en premier (fail-fast sur retry) puis UPDATE balance.
--      Si quelqu'un settle déjà commit, ledger INSERT throw → return
--      AVANT le UPDATE balance → pas de double-débit.
-- ============================================================

-- 1. Nettoyer les éventuels doublons existants avant de poser la contrainte
--    On garde la 1ère ligne par job_id (la plus ancienne).
DELETE FROM public.credit_ledger c1
USING public.credit_ledger c2
WHERE c1.operation = 'job_settle'
  AND c2.operation = 'job_settle'
  AND c1.job_id IS NOT NULL
  AND c1.job_id = c2.job_id
  AND c1.created_at > c2.created_at;

-- 2. UNIQUE partial index — garantit qu'un job_id ne peut être settle qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_ledger_settle_job_id
  ON public.credit_ledger(job_id)
  WHERE operation = 'job_settle' AND job_id IS NOT NULL;

-- 3. Refactor settle_credits() pour être retry-safe via INSERT-first + catch.
CREATE OR REPLACE FUNCTION public.settle_credits(
  p_user_id uuid,
  p_tenant_id text,
  p_reserved_usd numeric,
  p_actual_usd numeric,
  p_job_id text,
  p_job_kind text,
  p_description text
) RETURNS void AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  -- Tentative d'insertion ledger AVANT le UPDATE balance.
  -- Si une ligne settle existe déjà pour ce job_id, unique_violation
  -- → on RETURN sans toucher la balance (idempotent retry-safe).
  -- balance_after est mis à 0 temporairement et corrigé après le UPDATE.
  BEGIN
    INSERT INTO public.credit_ledger (
      user_id, tenant_id, operation, amount_usd, balance_after_usd,
      job_id, job_kind, description
    ) VALUES (
      p_user_id, p_tenant_id, 'job_settle', -p_actual_usd, 0,
      p_job_id, p_job_kind, p_description
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Ce job_id a déjà été settle (premier-wins). No-op.
      RETURN;
  END;

  -- L'INSERT a réussi : on est le 1er settle pour ce job_id.
  -- Appliquer le débit + release reservation.
  UPDATE public.user_credits
  SET balance_usd = balance_usd - p_actual_usd,
      reserved_usd = GREATEST(0, reserved_usd - p_reserved_usd),
      updated_at = now()
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  RETURNING balance_usd INTO v_new_balance;

  -- Corriger balance_after sur la ligne ledger qu'on vient d'insérer.
  UPDATE public.credit_ledger
  SET balance_after_usd = v_new_balance
  WHERE job_id = p_job_id AND operation = 'job_settle';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
