-- ============================================================
-- Hearst OS — Migration 0061 : Mission collaborative approvals (Q3-D)
--
-- Permet à une mission scheduled de définir une liste d'approbateurs
-- externes (par email) qui doivent voter "approve" ou "reject" avant
-- l'exécution. Une session d'approbation = N rows (1 par approver) avec
-- un token HMAC unique.
--
-- Une fois tous les votes positifs reçus (selon `approval_mode`), le
-- scheduler exécute la mission au prochain tick. Un seul "reject"
-- bloque définitivement la session.
--
-- Convention tenant_id = text (cohérent migrations 0036, 0051, 0053).
-- token_hash = sha256(token_raw) — pattern report_shares.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mission_approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id      uuid NOT NULL,
  -- run_id pointe vers le run mission qui sera lancé une fois la session
  -- complète. Nullable car la session peut précéder la création du run
  -- (le run est déclenché via runMissionNow APRÈS validation des votes).
  run_id          text,
  tenant_id       text NOT NULL,
  approver_email  text NOT NULL,
  vote            text NOT NULL DEFAULT 'pending'
                  CHECK (vote IN ('pending', 'approved', 'rejected')),
  comment         text,
  -- Hash SHA-256 hex du token raw — jamais le token raw en DB.
  token_hash      text NOT NULL UNIQUE,
  -- Mode d'agrégation pour cette session : "all" (unanimité), "any"
  -- (n'importe lequel suffit), "majority" (> 50%).
  approval_mode   text NOT NULL DEFAULT 'all'
                  CHECK (approval_mode IN ('all', 'any', 'majority')),
  -- Identifiant de session : groupe les N rows d'une même demande
  -- d'approbation. UUID généré côté code dans requestApprovals().
  session_id      uuid NOT NULL,
  expires_at      timestamptz NOT NULL,
  voted_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_approvals_mission
  ON public.mission_approvals (mission_id);

CREATE INDEX IF NOT EXISTS idx_mission_approvals_session
  ON public.mission_approvals (session_id);

CREATE INDEX IF NOT EXISTS idx_mission_approvals_run
  ON public.mission_approvals (run_id);

CREATE INDEX IF NOT EXISTS idx_mission_approvals_token_hash
  ON public.mission_approvals (token_hash);

CREATE INDEX IF NOT EXISTS idx_mission_approvals_tenant
  ON public.mission_approvals (tenant_id);

-- RLS : isolation par tenant côté authenticated, bypass service_role
-- pour le lookup par token_hash (vote public via lien signé HMAC).
ALTER TABLE public.mission_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_approvals_select_tenant ON public.mission_approvals;
CREATE POLICY mission_approvals_select_tenant ON public.mission_approvals
  FOR SELECT TO authenticated
  USING (
    tenant_id = COALESCE(
      current_setting('request.jwt.claims', true)::json->>'tenant_id',
      auth.uid()::text
    )
  );

DROP POLICY IF EXISTS mission_approvals_service_all ON public.mission_approvals;
CREATE POLICY mission_approvals_service_all ON public.mission_approvals
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.mission_approvals IS
  'Sessions d''approbation collaborative pour missions scheduled (Q3-D). '
  'Une session = N rows (1 par approver). Vote via lien HMAC signé envoyé '
  'par email. Le scheduler attend que les votes satisfont approval_mode '
  '(all/any/majority) avant d''exécuter le run.';
