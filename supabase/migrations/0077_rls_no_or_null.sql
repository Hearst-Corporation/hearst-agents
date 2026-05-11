-- ============================================================
-- F-013 — RLS : supprimer les clauses `OR user_id IS NULL`
--
-- Migration 0028 a créé des policies avec USING(user_id = auth.uid() OR user_id IS NULL).
-- La clause `OR user_id IS NULL` crée une faille : tout row sans user_id
-- est lisible par n'importe quel utilisateur authentifié.
-- Fix : supprimer les clauses OR IS NULL sur runs et assets.
-- Les server writes passent par service_role (policy séparée, pas affectée).
-- ============================================================

-- ── 1. Runs — retirer OR user_id IS NULL ───────────────────

DROP POLICY IF EXISTS runs_select_user ON public.runs;
DROP POLICY IF EXISTS runs_insert_user ON public.runs;
DROP POLICY IF EXISTS runs_update_user ON public.runs;
DROP POLICY IF EXISTS runs_delete_user ON public.runs;

CREATE POLICY runs_select_user ON public.runs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY runs_insert_user ON public.runs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY runs_update_user ON public.runs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY runs_delete_user ON public.runs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 2. Assets — retirer OR provenance->>'userId' IS NULL ───

DROP POLICY IF EXISTS assets_select_user ON public.assets;
DROP POLICY IF EXISTS assets_insert_user ON public.assets;
DROP POLICY IF EXISTS assets_update_user ON public.assets;
DROP POLICY IF EXISTS assets_delete_user ON public.assets;

CREATE POLICY assets_select_user ON public.assets
  FOR SELECT TO authenticated
  USING ((provenance->>'userId') = auth.uid()::text);

CREATE POLICY assets_insert_user ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK ((provenance->>'userId') = auth.uid()::text);

CREATE POLICY assets_update_user ON public.assets
  FOR UPDATE TO authenticated
  USING ((provenance->>'userId') = auth.uid()::text)
  WITH CHECK ((provenance->>'userId') = auth.uid()::text);

CREATE POLICY assets_delete_user ON public.assets
  FOR DELETE TO authenticated
  USING ((provenance->>'userId') = auth.uid()::text);

-- ── 3. Actions — retirer OR asset_id IS NULL ───────────────
-- La policy actions_select_user avait USING(asset_id IS NULL OR ...)
-- ce qui permettait de lire toutes les actions sans asset_id.

DROP POLICY IF EXISTS actions_select_user ON public.actions;
DROP POLICY IF EXISTS actions_insert_user ON public.actions;

CREATE POLICY actions_select_user ON public.actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = public.actions.asset_id
        AND (a.provenance->>'userId') = auth.uid()::text
    )
  );

CREATE POLICY actions_insert_user ON public.actions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = public.actions.asset_id
        AND (a.provenance->>'userId') = auth.uid()::text
    )
  );

-- Note : les actions sans asset_id (system actions) passent uniquement
-- via service_role (policy actions_service_all existante, non modifiée).
