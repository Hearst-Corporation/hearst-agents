-- Migration 0070 — Per-user tenant resolution (B1.1, F-095/F-096 SHOWSTOPPER)
--
-- Création de la table public.tenants + colonnes users.primary_tenant_id /
-- primary_workspace_id NOT NULL pour remplacer le fallback env HEARST_TENANT_ID.
--
-- Backfill : pour chaque user existant, réutilise tenant_ids[1] si valide UUID,
-- sinon génère un nouveau tenant_id. Tenant primaire = workspace primaire à la
-- création (peut diverger plus tard via tenant_memberships).
--
-- À appliquer APRÈS le DRYRUN (0070_per_user_tenant_DRYRUN.sql) pour vérifier
-- le delta. Voir docs/audits/2026-05-10-security/findings/B1.1-design.md §8.

BEGIN;

-- 1. Table tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Personal Workspace',
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON public.tenants(owner_user_id);

-- 2. Colonnes users (nullable temp pour backfill)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS primary_tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS primary_workspace_id uuid;

-- 3. Backfill : 1 tenant par user existant
DO $$
DECLARE
  u record;
  new_tenant_id uuid;
BEGIN
  FOR u IN SELECT id, email, tenant_ids FROM public.users WHERE primary_tenant_id IS NULL LOOP
    IF u.tenant_ids IS NOT NULL
       AND array_length(u.tenant_ids, 1) >= 1
       AND u.tenant_ids[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
      new_tenant_id := u.tenant_ids[1]::uuid;
    ELSE
      new_tenant_id := gen_random_uuid();
    END IF;

    INSERT INTO public.tenants (id, owner_user_id, name)
      VALUES (new_tenant_id, u.id, COALESCE(u.email, 'Personal Workspace'))
      ON CONFLICT (id) DO NOTHING;

    UPDATE public.users
       SET primary_tenant_id = new_tenant_id,
           primary_workspace_id = new_tenant_id,
           tenant_ids = ARRAY[new_tenant_id::text]
     WHERE id = u.id;
  END LOOP;
END $$;

-- 4. Garde-fou : aucun user sans tenant après backfill
DO $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM public.users WHERE primary_tenant_id IS NULL;
  IF c > 0 THEN
    RAISE EXCEPTION 'Migration 0070: % user(s) sans primary_tenant_id après backfill', c;
  END IF;
END $$;

-- 5. NOT NULL strict (backfill validé, on peut contraindre)
ALTER TABLE public.users
  ALTER COLUMN primary_tenant_id SET NOT NULL,
  ALTER COLUMN primary_workspace_id SET NOT NULL;

-- 6. Index pour lookups depuis JWT callback
CREATE INDEX IF NOT EXISTS idx_users_primary_tenant ON public.users(primary_tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users(lower(email));

COMMIT;
