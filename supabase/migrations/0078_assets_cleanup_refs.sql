-- Migration 0078 — Asset cleanup: colonnes last_accessed_at + pinned
--
-- F-019 : le worker de cleanup ne doit pas supprimer un asset référencé
-- par une mission active. On ajoute :
--   - last_accessed_at : mis à jour à chaque lecture de l'asset, permet
--     d'exclure les assets récemment consultés même si créés avant la TTL.
--   - pinned : drapeau manuel pour protéger un asset de la suppression
--     automatique (ex: daily brief archivé, rapport livré).
--
-- Index : les requêtes de cleanup filtrent sur created_at < cutoff ET
-- (last_accessed_at IS NULL OR last_accessed_at < cutoff), donc un index
-- partiel sur last_accessed_at accélère le scan.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_assets_last_accessed
  ON assets (last_accessed_at)
  WHERE last_accessed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_pinned
  ON assets (pinned)
  WHERE pinned = TRUE;

COMMENT ON COLUMN assets.last_accessed_at IS
  'Dernière consultation de cet asset (mis à jour par le serveur à chaque lecture). Protège les assets récents de la suppression auto.';

COMMENT ON COLUMN assets.pinned IS
  'Si TRUE, cet asset est exclu de tout nettoyage automatique (cleanup cron).';
