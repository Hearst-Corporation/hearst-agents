-- Étend l'enum run_kind pour inclure les jobs media Inngest.
-- Permet à /admin/analytics d'agréger cost_usd de tous les types de jobs.
--
-- NOTE : ALTER TYPE ... ADD VALUE ne peut pas tourner dans une transaction.
-- Ne pas encapsuler dans BEGIN/COMMIT.
--
-- ⚠ Migration NON appliquée automatiquement — exécuter via :
--   supabase db push
-- ou via MCP supabase apply_migration.

ALTER TYPE run_kind ADD VALUE IF NOT EXISTS 'audio_gen';
ALTER TYPE run_kind ADD VALUE IF NOT EXISTS 'image_gen';
ALTER TYPE run_kind ADD VALUE IF NOT EXISTS 'video_gen';
ALTER TYPE run_kind ADD VALUE IF NOT EXISTS 'doc_parse';
ALTER TYPE run_kind ADD VALUE IF NOT EXISTS 'code_exec';
