-- ============================================================
-- F-014 — user_tokens RLS : ajouter policy service_role + self-read
--
-- La migration 0011 a créé une policy USING(true) sans rôle cible
-- → accessible à tout rôle authentifié, y compris anon.
-- Fix : drop l'ancienne policy, créer deux policies séparées :
--   1. service_role : accès total (server writes)
--   2. authenticated (self) : SELECT uniquement sur ses propres tokens
-- ============================================================

DROP POLICY IF EXISTS "Service role full access" ON public.user_tokens;

-- Service role : accès total (pas de restriction → server-side uniquement)
CREATE POLICY "user_tokens_service_role" ON public.user_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Utilisateur authentifié : lecture seule de ses propres tokens
-- user_id est uuid dans le live DB (migré depuis text)
CREATE POLICY "user_tokens_self_read" ON public.user_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
