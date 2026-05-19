-- DRYRUN Migration 0070 — montre le delta sans muter
-- Lance ce fichier d'abord en staging pour valider, PUIS apply 0070_per_user_tenant.sql

-- 1. Combien d'users à migrer ?
SELECT count(*) AS users_to_migrate
FROM public.users
WHERE primary_tenant_id IS NULL;

-- 2. Échantillon : pour quelques users, quel sera le nouveau tenant_id ?
SELECT
  u.id AS user_id,
  u.email,
  u.tenant_ids,
  CASE
    WHEN u.tenant_ids IS NOT NULL
         AND array_length(u.tenant_ids, 1) >= 1
         AND u.tenant_ids[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN 'REUSE: ' || u.tenant_ids[1]
    ELSE 'GENERATE NEW UUID'
  END AS planned_tenant_id
FROM public.users u
WHERE u.primary_tenant_id IS NULL
LIMIT 20;

-- 3. Combien de tenants seront REUSE vs GENERATE ?
SELECT
  CASE
    WHEN u.tenant_ids IS NOT NULL
         AND array_length(u.tenant_ids, 1) >= 1
         AND u.tenant_ids[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN 'reuse'
    ELSE 'generate'
  END AS strategy,
  count(*) AS user_count
FROM public.users u
WHERE u.primary_tenant_id IS NULL
GROUP BY strategy;

-- 4. Detect anomalies : users sans email
SELECT count(*) AS users_without_email
FROM public.users
WHERE email IS NULL OR email = '';

-- 5. Detect : users avec tenant_ids text non-UUID (legacy)
SELECT id, email, tenant_ids
FROM public.users
WHERE tenant_ids IS NOT NULL
  AND array_length(tenant_ids, 1) >= 1
  AND tenant_ids[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
LIMIT 20;

-- 6. Vérifier que la table tenants n'existe pas encore (sinon migration déjà appliquée)
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'tenants'
) AS tenants_table_already_exists;
