-- Migration 0072 — F-094 : agent_memory ownership (user_id + tenant_id)
-- Ajoute user_id + tenant_id à agent_memory, backfill depuis agents.owner_user_id,
-- renforce la RLS pour isoler par utilisateur authentifié.

BEGIN;

-- 1. Ajouter les colonnes (nullable d'abord pour permettre le backfill)
ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2. Backfill : déduire user_id/tenant_id depuis l'agent owner (si disponible)
--    Dépend de 0074 qui ajoute agents.owner_user_id (peut être NULL si non encore backfillé).
UPDATE public.agent_memory am
SET
  user_id    = u.id,
  tenant_id  = u.primary_tenant_id
FROM public.agents a
INNER JOIN public.users u ON u.id = a.owner_user_id
WHERE am.agent_id = a.id
  AND a.owner_user_id IS NOT NULL
  AND am.user_id IS NULL;

-- 3. Supprimer les rows orphelines (agent sans owner ou agent supprimé)
DELETE FROM public.agent_memory WHERE user_id IS NULL;

-- 4. Passer NOT NULL maintenant que le backfill est fait
ALTER TABLE public.agent_memory
  ALTER COLUMN user_id  SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- 5. Index pour les lookups par user/tenant
CREATE INDEX IF NOT EXISTS idx_agent_memory_user   ON public.agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_tenant ON public.agent_memory(tenant_id);

-- 6. RLS : remplacer la policy using(true) par des policies granulaires
--    La policy générique "authenticated select" créée dans 0002 couvre using(true),
--    on la supprime et on crée deux policies spécifiques.
DROP POLICY IF EXISTS agent_memory_select_auth ON public.agent_memory;
DROP POLICY IF EXISTS agent_memory_insert_auth ON public.agent_memory;
DROP POLICY IF EXISTS agent_memory_update_auth ON public.agent_memory;
DROP POLICY IF EXISTS agent_memory_delete_auth ON public.agent_memory;

-- service_role : accès complet (workers, backend)
CREATE POLICY "agent_memory_service_role_all" ON public.agent_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- authenticated : lecture + écriture restreinte à l'owner
CREATE POLICY "agent_memory_self_select" ON public.agent_memory
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "agent_memory_self_insert" ON public.agent_memory
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_memory_self_update" ON public.agent_memory
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_memory_self_delete" ON public.agent_memory
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMIT;
