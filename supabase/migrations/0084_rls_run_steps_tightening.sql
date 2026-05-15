-- ============================================================
-- 0084 — Tighten RLS on run_steps / run_logs / artifacts
--
-- Closes audit P0-13: les policies USING(true) laissées en place par la
-- migration 0015 (puis explicitement conservées par 0028 §4 en attendant
-- que runs.user_id soit systématiquement renseigné). Le backfill par
-- migration 0051 garantit désormais que toute ligne `runs` a un user_id.
--
-- Cette migration applique le user-scoping via jointure sur runs.user_id
-- (pour run_steps et run_logs qui n'ont pas de user_id propre) et via la
-- colonne user_id directe (pour artifacts).
--
-- Service-role conserve son bypass via la policy *_service_all existante.
-- ============================================================

-- ── run_steps ──────────────────────────────────────────────────
DROP POLICY IF EXISTS run_steps_auth_all ON public.run_steps;
DROP POLICY IF EXISTS run_steps_select_user ON public.run_steps;
DROP POLICY IF EXISTS run_steps_insert_user ON public.run_steps;
DROP POLICY IF EXISTS run_steps_update_user ON public.run_steps;
DROP POLICY IF EXISTS run_steps_delete_user ON public.run_steps;

CREATE POLICY run_steps_select_user ON public.run_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_steps.run_id
        AND r.user_id = auth.uid()::text
    )
  );

CREATE POLICY run_steps_insert_user ON public.run_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_steps.run_id
        AND r.user_id = auth.uid()::text
    )
  );

CREATE POLICY run_steps_update_user ON public.run_steps
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_steps.run_id
        AND r.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_steps.run_id
        AND r.user_id = auth.uid()::text
    )
  );

CREATE POLICY run_steps_delete_user ON public.run_steps
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_steps.run_id
        AND r.user_id = auth.uid()::text
    )
  );

-- Service-role bypass (idempotent: noop si la policy existe déjà)
DROP POLICY IF EXISTS run_steps_service_all ON public.run_steps;
CREATE POLICY run_steps_service_all ON public.run_steps
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ── run_logs ───────────────────────────────────────────────────
DROP POLICY IF EXISTS run_logs_auth_all ON public.run_logs;
DROP POLICY IF EXISTS run_logs_select_user ON public.run_logs;
DROP POLICY IF EXISTS run_logs_insert_user ON public.run_logs;

CREATE POLICY run_logs_select_user ON public.run_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_logs.run_id
        AND r.user_id = auth.uid()::text
    )
  );

CREATE POLICY run_logs_insert_user ON public.run_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_logs.run_id
        AND r.user_id = auth.uid()::text
    )
  );

-- run_logs est append-only (no UPDATE/DELETE policies pour authenticated).

DROP POLICY IF EXISTS run_logs_service_all ON public.run_logs;
CREATE POLICY run_logs_service_all ON public.run_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ── artifacts ──────────────────────────────────────────────────
-- artifacts.user_id est directement renseigné (NOT NULL dans 0015).
DROP POLICY IF EXISTS artifacts_auth_all ON public.artifacts;
DROP POLICY IF EXISTS artifacts_select_user ON public.artifacts;
DROP POLICY IF EXISTS artifacts_insert_user ON public.artifacts;
DROP POLICY IF EXISTS artifacts_update_user ON public.artifacts;
DROP POLICY IF EXISTS artifacts_delete_user ON public.artifacts;

CREATE POLICY artifacts_select_user ON public.artifacts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY artifacts_insert_user ON public.artifacts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY artifacts_update_user ON public.artifacts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY artifacts_delete_user ON public.artifacts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS artifacts_service_all ON public.artifacts;
CREATE POLICY artifacts_service_all ON public.artifacts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
