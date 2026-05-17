-- Rollback pour 0088_tenants_owner_restrict.sql
-- À exécuter si on doit revenir à ON DELETE CASCADE (non recommandé).
-- Nécessite qu'aucun user owner d'un tenant ne soit supprimé entre-temps.

BEGIN;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_owner_user_id_fkey;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_owner_user_id_fkey
  FOREIGN KEY (owner_user_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;

COMMIT;
