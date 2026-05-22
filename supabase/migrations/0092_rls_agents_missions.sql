-- ============================================================
-- 0092 — RLS stricte sur public.agents et public.missions
--
-- Contexte :
--   Les migrations 0001/0002 ont activé RLS sur agents avec des policies
--   USING(true) (anon + authenticated sans scoping).
--   La migration 0014 a fait de même sur missions/mission_runs.
--   Ces policies ne protègent pas contre les accès cross-tenant/cross-user
--   via l'API REST Supabase (anon key ou authenticated sans filtre).
--
-- Ce que fait cette migration :
--   1. agents — remplace les policies permissives par un scoping strict
--      owner_user_id + tenant_id. Les agents sans owner (system agents)
--      restent lisibles par tous les utilisateurs authentifiés du même tenant.
--   2. missions — remplace les policies USING(true) par user_id = auth.uid().
--   3. mission_runs — scoping via jointure sur missions.user_id.
--
-- Service role bypasse RLS par défaut dans Supabase (pas de policy nécessaire).
-- Toutes les routes API utilisent service_role côté serveur → pas d'impact.
--
-- Colonnes de scoping :
--   agents.owner_user_id uuid (ajouté en 0074, nullable)
--   agents.tenant_id     uuid (ajouté en 0074, nullable)
--   missions.user_id     uuid (casté text→uuid en 0026, NOT NULL)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. public.agents
-- ============================================================

-- Supprimer toutes les policies permissives existantes
DROP POLICY IF EXISTS agents_select_anon      ON public.agents;
DROP POLICY IF EXISTS agents_select_auth      ON public.agents;
DROP POLICY IF EXISTS agents_insert_auth      ON public.agents;
DROP POLICY IF EXISTS agents_update_auth      ON public.agents;
DROP POLICY IF EXISTS agents_delete_auth      ON public.agents;
-- Noms alternatifs posés par 0001
DROP POLICY IF EXISTS "agents_select_anon"          ON public.agents;
DROP POLICY IF EXISTS "agents_select_authenticated" ON public.agents;

-- SELECT : owner direct OU même tenant (agents partagés dans le tenant)
-- Les agents sans owner_user_id (system agents) restent lisibles par
-- tous les membres du tenant. Un agent NULL tenant n'est jamais exposé.
CREATE POLICY agents_select_tenant
  ON public.agents
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- INSERT : l'utilisateur ne peut créer que des agents dans son propre tenant
-- et doit se désigner comme owner.
CREATE POLICY agents_insert_owner
  ON public.agents
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- UPDATE : seul l'owner peut modifier son agent (dans son tenant).
CREATE POLICY agents_update_owner
  ON public.agents
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- DELETE : seul l'owner peut supprimer son agent.
CREATE POLICY agents_delete_owner
  ON public.agents
  FOR DELETE TO authenticated
  USING (
    owner_user_id = auth.uid()
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Lecture publique (anon) intentionnellement supprimée.
-- Le marketplace public passe par service_role avec whitelist explicite.


-- ============================================================
-- 2. public.missions
-- ============================================================

-- Supprimer les policies USING(true) posées en 0014
DROP POLICY IF EXISTS missions_select_auth ON public.missions;
DROP POLICY IF EXISTS missions_insert_auth ON public.missions;
DROP POLICY IF EXISTS missions_update_auth ON public.missions;
DROP POLICY IF EXISTS missions_delete_auth ON public.missions;

CREATE POLICY missions_select_owner
  ON public.missions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY missions_insert_owner
  ON public.missions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY missions_update_owner
  ON public.missions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY missions_delete_owner
  ON public.missions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ============================================================
-- 3. public.mission_runs
-- ============================================================

-- Supprimer les policies permissives posées en 0014
DROP POLICY IF EXISTS mission_runs_select_auth ON public.mission_runs;
DROP POLICY IF EXISTS mission_runs_insert_auth ON public.mission_runs;
DROP POLICY IF EXISTS mission_runs_update_auth ON public.mission_runs;
DROP POLICY IF EXISTS mission_runs_delete_auth ON public.mission_runs;

-- mission_runs n'a pas de user_id direct — jointure via missions
CREATE POLICY mission_runs_select_owner
  ON public.mission_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_runs.mission_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY mission_runs_insert_owner
  ON public.mission_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_runs.mission_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY mission_runs_update_owner
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

CREATE POLICY mission_runs_delete_owner
  ON public.mission_runs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_runs.mission_id
        AND m.user_id = auth.uid()
    )
  );

COMMIT;
