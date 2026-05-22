-- Migration 0091 — Table api_keys : auth par clé API serveur-à-serveur (SDK fondation)
--
-- Permet aux produits Hearst (studio, merchant, trading) d'appeler l'API Helm
-- via une clé préfixée "hsk_" sans session NextAuth.
-- La clé brute n'est JAMAIS stockée — seul le SHA-256 hex (key_hash) est persisté.
-- key_prefix (8 premiers chars) permet l'affichage liste sans exposer la clé.
--
-- Tables de référence : public.tenants (depuis 0070), public.users (bootstrap).

BEGIN;

CREATE TABLE IF NOT EXISTS public.api_keys (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  -- Label lisible : "Production SDK", "Studio dev", etc.
  name        TEXT        NOT NULL,
  -- SHA-256 hex de la clé brute. Jamais la clé en clair.
  key_hash    TEXT        NOT NULL UNIQUE,
  -- 8 premiers caractères pour affichage : "hsk_a1b2". Pas de secret ici.
  key_prefix  TEXT        NOT NULL,
  -- Scopes OAuth-style : 'read', 'write', 'admin', etc.
  scopes      TEXT[]      NOT NULL DEFAULT '{read}',
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- index unique implicite via contrainte UNIQUE colonne (key_hash TEXT NOT NULL UNIQUE ci-dessus)
-- L'index idx_api_keys_key_hash explicite est supprimé — doublon de la contrainte UNIQUE.

-- Index pour lister les clés d'un tenant (dashboard)
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id
  ON public.api_keys(tenant_id);

-- Index pour filtrer les clés actives (non révoquées) d'un tenant
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_active
  ON public.api_keys(tenant_id)
  WHERE revoked_at IS NULL;

-- RLS : activer. Le serveur utilise service_role key → bypass RLS automatique.
-- Les clients authentifiés peuvent voir leurs propres clés (lecture seule).
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Service role : accès total (INSERT/SELECT/UPDATE pour generateApiKey + verifyApiKey)
-- Pas de policy explicite nécessaire : service_role bypasse RLS par défaut Supabase.

-- Lecture tenant-scoped pour les utilisateurs connectés (dashboard liste de clés)
CREATE POLICY "api_keys_tenant_select"
  ON public.api_keys
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Pas de policy INSERT/UPDATE/DELETE publique :
-- generateApiKey et revokeApiKey passent par service_role côté serveur.

COMMIT;
