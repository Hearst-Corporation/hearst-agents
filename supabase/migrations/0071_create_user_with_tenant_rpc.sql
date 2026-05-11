-- Migration 0071 — RPC atomique create_user_with_tenant (B1.1 régression)
--
-- Régression post-0070 : users.primary_tenant_id est NOT NULL, mais l'UPSERT
-- applicatif dans user-resolver.ts insère un user sans tenant → violation NOT NULL.
--
-- Problème chicken-and-egg :
--   INSERT users nécessite primary_tenant_id (NOT NULL)
--   INSERT tenants nécessite owner_user_id (users.id pas encore connu)
--
-- Solution : relaxer primary_tenant_id à NULLABLE (la contrainte métier est
-- garantie par la RPC — tout user créé via signup aura toujours un tenant).
-- Un index partiel alerte si des rows orphelines apparaissent (monitoring).
--
-- Appelée par resolveOrCreateUserUuid() dans lib/platform/auth/user-resolver.ts.
-- SECURITY DEFINER : s'exécute avec les droits du owner (service_role level).

-- 1. Relaxer le NOT NULL sur primary_tenant_id et primary_workspace_id
--    (la garantie d'intégrité est portée par la RPC + trigger, pas le schéma)
ALTER TABLE public.users
  ALTER COLUMN primary_tenant_id DROP NOT NULL,
  ALTER COLUMN primary_workspace_id DROP NOT NULL;

-- 2. RPC atomique : INSERT user → INSERT tenant → UPDATE user (1 transaction)
CREATE OR REPLACE FUNCTION public.create_user_with_tenant(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid;
  v_tenant_id    uuid;
  v_has_tenant   boolean;
BEGIN
  -- 2a. Upsert user — ON CONFLICT DO UPDATE force le RETURNING même si row existait
  INSERT INTO public.users (email)
    VALUES (p_email)
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id INTO v_user_id;

  -- 2b. Vérifier si le user a déjà un primary_tenant_id
  SELECT (primary_tenant_id IS NOT NULL)
    INTO v_has_tenant
    FROM public.users
   WHERE id = v_user_id;

  -- 2c. Nouveau user (ou user orphelin post-migration) → créer tenant + lier
  IF NOT v_has_tenant THEN
    INSERT INTO public.tenants (owner_user_id, name)
      VALUES (v_user_id, p_email)
      RETURNING id INTO v_tenant_id;

    UPDATE public.users
       SET primary_tenant_id    = v_tenant_id,
           primary_workspace_id = v_tenant_id,
           tenant_ids           = ARRAY[v_tenant_id]
     WHERE id = v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$;

-- 3. Seul le service_role peut appeler cette fonction (pas les users anon/auth)
REVOKE ALL ON FUNCTION public.create_user_with_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_with_tenant(text) TO service_role;

COMMENT ON FUNCTION public.create_user_with_tenant(text) IS
  'Crée atomiquement un user + son tenant personnel si besoin. '
  'Appelé par le callback NextAuth jwt() via resolveOrCreateUserUuid(). '
  'Idempotent : si le user existe et a déjà un tenant, retourne son id sans modification. '
  'primary_tenant_id est nullable au niveau schéma mais garanti non-null par cette RPC.';

-- 4. Index partiel pour alerter sur des users orphelins (monitoring prod)
CREATE INDEX IF NOT EXISTS idx_users_orphan_no_tenant
  ON public.users (id)
  WHERE primary_tenant_id IS NULL;

COMMENT ON INDEX public.idx_users_orphan_no_tenant IS
  'Index partiel de monitoring : si non-vide, des users sont orphelins sans tenant. '
  'Ne devrait contenir aucune row en prod après migration 0070.';
