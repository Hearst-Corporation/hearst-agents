-- Migration 0079 — KG : index trigram pour searchNodes (B11.3)
--
-- F-114 : `searchNodes` exécute `kg_nodes.label ILIKE '%q%'` (leading
-- wildcard) → seq scan O(n) sur toute la table user. Au-delà de quelques
-- milliers de nodes c'est inacceptable (latence p95 > 200ms sur tenant
-- chargé). Solution Postgres standard : index GIN trigram qui supporte
-- `ILIKE '%pattern%'` en index scan.
--
-- Détails :
--   1. Extension `pg_trgm` activée (no-op si déjà présente).
--   2. Index GIN sur `lower(label)` via `gin_trgm_ops` (`lower` pour
--      matcher la sémantique case-insensitive de ILIKE et permettre au
--      planificateur d'utiliser l'index sur tous les patterns).
--   3. CONCURRENTLY pour ne pas locker la table en prod pendant la
--      construction (kg_nodes peut être grosse). Note : CONCURRENTLY ne
--      peut pas tourner dans une transaction implicite — la migration
--      Supabase doit être exécutée hors-tx (cf. note dans supabase/README
--      ou commenter / runner manuellement si bloquant).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kg_nodes_label_trgm
  ON public.kg_nodes
  USING gin (lower(label) gin_trgm_ops);

COMMENT ON INDEX public.idx_kg_nodes_label_trgm IS
  'Index trigram (gin_trgm_ops) sur lower(label) — accélère searchNodes ILIKE %q% (B11.3 / F-114).';
