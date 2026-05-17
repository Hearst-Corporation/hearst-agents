-- Migration 0088 : Sécuriser la FK tenants.owner_user_id
--
-- Avant : ON DELETE CASCADE — suppression d'un user auth détruisait tout le tenant
--         et en cascade toutes ses données (runs, assets, reports, agents, etc.).
-- Après : ON DELETE RESTRICT — impossible de supprimer un user qui est owner d'un tenant.
--
-- Pour supprimer un compte owner :
--   1. Réassigner owner_user_id à un autre membre, OU
--   2. Supprimer le tenant en premier (et toutes ses données en cascade), PUIS supprimer le user.
--
-- Note : lib/database.types.ts n'a pas besoin d'être modifié — la structure de la table
-- est identique, seul le comportement de suppression change. La FK reste nommée
-- tenants_owner_user_id_fkey (confirmé dans database.types.ts ligne ~3576).

BEGIN;

-- Supprimer l'ancienne contrainte CASCADE
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_owner_user_id_fkey;

-- Recréer avec RESTRICT — bloque toute suppression d'un user owner
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_owner_user_id_fkey
  FOREIGN KEY (owner_user_id)
  REFERENCES public.users(id)
  ON DELETE RESTRICT;

COMMIT;
