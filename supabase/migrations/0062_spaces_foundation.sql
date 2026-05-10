-- ============================================================
-- Hearst OS — Migration 0062 : Spaces foundation (Phase 2 / Q3-C)
--
-- Les "Espaces" cloisonnent l'OS en silos logiques multi-projets
-- (Perso / Side / Venture par défaut) à l'intérieur d'un même
-- workspace. La Phase 1 a posé le client (`useActiveSpace` + selector
-- PulseBar) ; cette migration pose la Phase 2 côté DB :
--   - colonne `space_id text NOT NULL DEFAULT 'personal'` sur les
--     tables tenant-scoped concernées
--   - index composites pour les futures queries filtrées
--   - rétro-compatibilité totale : tous les rows existants reçoivent
--     `space_id = 'personal'` au moment de l'ALTER (DEFAULT non-null)
--
-- IMPORTANT — Phase 3 (filtrage des queries) reste hors scope. Aucune
-- requête existante n'est modifiée par cette migration. Le helper
-- server-side `getActiveSpaceIdFromRequest()` (cf.
-- `lib/multi-tenant/active-space.ts`) sera consommé par les routes
-- une fois Phase 3 ouverte (cf. `docs/features/spaces.md`).
--
-- Les ids `'personal' | 'side-project' | 'venture'` sont les defaults
-- hardcodés dans `stores/active-space.ts` (DEFAULT_SPACES). Pas de
-- table `spaces` séparée tant qu'on garde des spaces hardcodés —
-- introduire la table le jour où on ouvre des custom-spaces utilisateur.
-- ============================================================

-- ------------------------------------------------------------
-- assets : objets produits par les runs (rapports, images, jobs).
-- Pas de tenant_id direct → on indexe sur (thread_id, space_id) pour
-- garder les lookups par thread performants quand Phase 3 ajoutera
-- le filtre WHERE space_id = ?.
-- ------------------------------------------------------------
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS space_id text NOT NULL DEFAULT 'personal';

CREATE INDEX IF NOT EXISTS idx_assets_space
  ON public.assets (thread_id, space_id);

-- ------------------------------------------------------------
-- missions : missions agentiques user-scopées (cf. migration 0007 et
-- variantes). Index composite (user_id, space_id) pour suivre le
-- pattern d'isolation existant.
-- ------------------------------------------------------------
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS space_id text NOT NULL DEFAULT 'personal';

CREATE INDEX IF NOT EXISTS idx_missions_space
  ON public.missions (user_id, space_id);

-- ------------------------------------------------------------
-- mission_runs : exécutions individuelles d'une mission. Pas de
-- tenant_id ni user_id direct (lookup via mission_id) — index simple
-- sur (mission_id, space_id) pour conserver la jointure efficace.
-- ------------------------------------------------------------
ALTER TABLE public.mission_runs
  ADD COLUMN IF NOT EXISTS space_id text NOT NULL DEFAULT 'personal';

CREATE INDEX IF NOT EXISTS idx_mission_runs_space
  ON public.mission_runs (mission_id, space_id);

-- ------------------------------------------------------------
-- runs : runs du moteur d'exécution (engine v2). Tenant_id posé
-- en migration 0051 — on suit le pattern (tenant_id, space_id).
-- ------------------------------------------------------------
ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS space_id text NOT NULL DEFAULT 'personal';

CREATE INDEX IF NOT EXISTS idx_runs_space
  ON public.runs (tenant_id, space_id);

-- ------------------------------------------------------------
-- personas : personas tenant-scoped (cf. migration 0050/0052).
-- Pattern (tenant_id, space_id) cohérent.
-- ------------------------------------------------------------
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS space_id text NOT NULL DEFAULT 'personal';

CREATE INDEX IF NOT EXISTS idx_personas_space
  ON public.personas (tenant_id, space_id);

-- ------------------------------------------------------------
-- report_versions : historique immuable des renders de rapport
-- (cf. migration 0042). Tenant-scoped, donc (tenant_id, space_id).
-- ------------------------------------------------------------
ALTER TABLE public.report_versions
  ADD COLUMN IF NOT EXISTS space_id text NOT NULL DEFAULT 'personal';

CREATE INDEX IF NOT EXISTS idx_report_versions_space
  ON public.report_versions (tenant_id, space_id);

-- ============================================================
-- Notes :
--   - PAS d'ajout de space_id sur marketplace_templates / marketplace_*
--     (catalogue public, hors scope tenant).
--   - PAS d'ajout sur audit_logs / usage_logs / credit_ledger
--     (télémétrie cross-space par design).
--   - RLS : aucune policy modifiée. Les policies existantes restent
--     scopées par tenant_id / user_id ; le filtre par space_id sera
--     ajouté en Phase 3 au niveau application (côté queries) plutôt
--     que via RLS — on garde les RLS comme garde-fou tenant unique.
-- ============================================================

COMMENT ON COLUMN public.assets.space_id IS
  'Phase 2 Espaces (Q3-C). Default ''personal''. Non lu côté query tant que Phase 3 pas livrée.';
COMMENT ON COLUMN public.missions.space_id IS
  'Phase 2 Espaces (Q3-C). Default ''personal''. Non lu côté query tant que Phase 3 pas livrée.';
COMMENT ON COLUMN public.mission_runs.space_id IS
  'Phase 2 Espaces (Q3-C). Default ''personal''. Non lu côté query tant que Phase 3 pas livrée.';
COMMENT ON COLUMN public.runs.space_id IS
  'Phase 2 Espaces (Q3-C). Default ''personal''. Non lu côté query tant que Phase 3 pas livrée.';
COMMENT ON COLUMN public.personas.space_id IS
  'Phase 2 Espaces (Q3-C). Default ''personal''. Non lu côté query tant que Phase 3 pas livrée.';
COMMENT ON COLUMN public.report_versions.space_id IS
  'Phase 2 Espaces (Q3-C). Default ''personal''. Non lu côté query tant que Phase 3 pas livrée.';
