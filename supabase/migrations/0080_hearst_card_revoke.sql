-- F-112 : Hearst Card token revoke table
--
-- Les tokens HMAC de partage ont une TTL de 1 an mais n'avaient aucun mécanisme
-- de révocation anticipée. Cette table stocke le SHA-256 du token révoqué.
-- Au verify, si SHA256(token) se trouve ici → rejet immédiat.
-- Cleanup automatique : les lignes expirées (> 8j après revoked_at) peuvent
-- être purgées via le cron cleanup — la TTL naturelle est 7j, 8j laisse
-- une marge pour les replays tardifs.

CREATE TABLE IF NOT EXISTS hearst_card_revoked (
  token_hash  text         NOT NULL,
  revoked_at  timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT  hearst_card_revoked_pkey PRIMARY KEY (token_hash)
);

-- Index sur revoked_at pour le cleanup job
CREATE INDEX IF NOT EXISTS hearst_card_revoked_at_idx ON hearst_card_revoked (revoked_at);

-- RLS : service_role uniquement peut écrire/lire (la table est interne serveur)
ALTER TABLE hearst_card_revoked ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON hearst_card_revoked
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Les authenticated users ne peuvent pas voir les hashes (évite oracle de révocation)
-- Pas de policy SELECT pour authenticated → accès refusé par défaut RLS.

COMMENT ON TABLE hearst_card_revoked IS
  'F-112: Stocke les SHA-256 des Hearst Card tokens révoqués avant leur expiration naturelle.';
COMMENT ON COLUMN hearst_card_revoked.token_hash IS
  'SHA-256 hex du token HMAC brut. Jamais le token en clair.';
