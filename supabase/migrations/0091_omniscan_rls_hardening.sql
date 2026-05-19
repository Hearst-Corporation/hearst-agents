-- ============================================================
-- OMNISCAN B1-RLS — Hardening des policies RLS trop permissives
-- Audit OMNISCAN Stage 3 — Batch B1
-- Date : 2026-05-19
--
-- Findings couverts :
--   P0-IC  integration_connections — USING(true) expose tous les tokens OAuth
--   P0-M   missions / mission_runs  — USING(true) expose les missions cross-user
--   P0-DR  daily_reports            — table droppée en migration 0027 (N/A)
--
-- Idempotence : DROP POLICY IF EXISTS + ADD COLUMN IF NOT EXISTS
-- Pas de backfill destructif : les lignes existantes sans owner_user_id
-- restent accessibles uniquement via service_role jusqu'au backfill applicatif.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. integration_connections — owner scoping
-- ============================================================
--
-- Contexte :
--   Migration 0007 crée 4 policies (select/insert/update/delete) avec
--   USING(true) / WITH CHECK(true) → tout utilisateur authentifié peut
--   lire et modifier tous les tokens OAuth/api_key de tous les tenants.
--
--   La table n'a pas de colonne user_id ou tenant_id. On ajoute
--   owner_user_id (UUID nullable pour compatibilité avec les lignes
--   existantes créées avant ce fix).
--
-- Stratégie :
--   - ADD COLUMN IF NOT EXISTS owner_user_id uuid (nullable, FK users)
--   - DROP les 4 policies USING(true) créées par 0007
--   - CREATE policies omniscan_* : authenticated voit/modifie uniquement
--     ses propres connexions (owner_user_id = auth.uid())
--   - service_role garde un bypass total pour les writes serveur
--   - Les lignes avec owner_user_id IS NULL (créées avant ce fix) ne
--     seront plus visibles aux authenticated → accès via service_role
--     jusqu'au backfill. Voir WARN-BACKFILL-IC ci-dessous.
--
-- WARN-BACKFILL-IC : après déploiement, backfiller les lignes orphelines
--   UPDATE public.integration_connections
--      SET owner_user_id = <admin_user_id>
--    WHERE owner_user_id IS NULL;
-- Sans ce backfill, les intégrations pré-existantes deviennent invisibles
-- pour les utilisateurs (mais restent accessibles via service_role → les
-- agents et le backend ne sont pas impactés).

ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS owner_user_id uuid
    REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_integration_connections_owner
  ON public.integration_connections (owner_user_id);

-- Drop les policies trop permissives de la migration 0007
-- (créées dynamiquement via format() avec les noms <table>_select_auth etc.)
DROP POLICY IF EXISTS integration_connections_select_auth ON public.integration_connections;
DROP POLICY IF EXISTS integration_connections_insert_auth ON public.integration_connections;
DROP POLICY IF EXISTS integration_connections_update_auth ON public.integration_connections;
DROP POLICY IF EXISTS integration_connections_delete_auth ON public.integration_connections;

-- Service role : bypass total pour les writes côté serveur/agents
DROP POLICY IF EXISTS omniscan_integration_connections_service_all ON public.integration_connections;
CREATE POLICY omniscan_integration_connections_service_all
  ON public.integration_connections
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated : uniquement ses propres connexions
DROP POLICY IF EXISTS omniscan_integration_connections_owner_only ON public.integration_connections;
CREATE POLICY omniscan_integration_connections_owner_only
  ON public.integration_connections
  FOR ALL TO authenticated
  USING  (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());


-- ============================================================
-- 2. missions — owner scoping via user_id (uuid depuis 0026)
-- ============================================================
--
-- Contexte :
--   Migration 0014 crée 4 policies USING(true) sur `missions`.
--   Migration 0026 a typé missions.user_id en uuid.
--   La colonne user_id est NOT NULL (définie ainsi en 0014).
--   → Fix direct sans backfill requis.
--
-- Stratégie :
--   - DROP les 4 policies USING(true) de 0014
--   - CREATE policies omniscan_* : user_id = auth.uid()
--   - service_role bypass maintenu

DROP POLICY IF EXISTS missions_select_auth ON public.missions;
DROP POLICY IF EXISTS missions_insert_auth ON public.missions;
DROP POLICY IF EXISTS missions_update_auth ON public.missions;
DROP POLICY IF EXISTS missions_delete_auth ON public.missions;

-- Noms alternatifs potentiels (idempotence défensive)
DROP POLICY IF EXISTS omniscan_missions_select_user ON public.missions;
DROP POLICY IF EXISTS omniscan_missions_insert_user ON public.missions;
DROP POLICY IF EXISTS omniscan_missions_update_user ON public.missions;
DROP POLICY IF EXISTS omniscan_missions_delete_user ON public.missions;
DROP POLICY IF EXISTS omniscan_missions_service_all ON public.missions;

CREATE POLICY omniscan_missions_service_all
  ON public.missions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY omniscan_missions_select_user
  ON public.missions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY omniscan_missions_insert_user
  ON public.missions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY omniscan_missions_update_user
  ON public.missions
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY omniscan_missions_delete_user
  ON public.missions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ============================================================
-- 3. mission_runs — owner scoping via jointure sur missions
-- ============================================================
--
-- Contexte :
--   Migration 0014 crée 3 policies USING(true) sur `mission_runs`
--   (pas de DELETE policy dans 0014 — on n'en crée pas non plus).
--   `mission_runs` n'a pas de user_id propre → scoping via FK mission_id
--   → missions.user_id = auth.uid().

DROP POLICY IF EXISTS mission_runs_select_auth ON public.mission_runs;
DROP POLICY IF EXISTS mission_runs_insert_auth ON public.mission_runs;
DROP POLICY IF EXISTS mission_runs_update_auth ON public.mission_runs;

-- Noms alternatifs (idempotence)
DROP POLICY IF EXISTS omniscan_mission_runs_select_user ON public.mission_runs;
DROP POLICY IF EXISTS omniscan_mission_runs_insert_user ON public.mission_runs;
DROP POLICY IF EXISTS omniscan_mission_runs_update_user ON public.mission_runs;
DROP POLICY IF EXISTS omniscan_mission_runs_service_all ON public.mission_runs;

CREATE POLICY omniscan_mission_runs_service_all
  ON public.mission_runs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY omniscan_mission_runs_select_user
  ON public.mission_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_runs.mission_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY omniscan_mission_runs_insert_user
  ON public.mission_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_runs.mission_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY omniscan_mission_runs_update_user
  ON public.mission_runs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_runs.mission_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_runs.mission_id
        AND m.user_id = auth.uid()
    )
  );


-- ============================================================
-- 4. daily_reports — N/A (table supprimée)
-- ============================================================
--
-- Migration 0027_drop_daily_reports.sql a exécuté DROP TABLE IF EXISTS
-- daily_reports sans activation RLS préalable. La table n'existe plus
-- en prod depuis le commit 32667f1 (2026-04-29).
-- Aucune action RLS requise.
--
-- Si la table est recréée dans une migration future, appliquer :
--   ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
-- et créer les policies appropriées (cf. Pattern D du playbook OMNISCAN).


COMMIT;
