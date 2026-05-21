-- 0090 — Ajoute 'swarm' à l'enum run_kind.
-- Permet de tracer les runs de swarm (hive-engine, swarms.hearst.app) dans la
-- table `runs` → visibles dans les dashboards (points de contrôle : /admin/runs,
-- RunRail, /api/v2/runs). Additif, aucune rupture sur les valeurs existantes.
-- Appliqué en prod (jnijwpqbanazuapznrzu) le 2026-05-21.
ALTER TYPE run_kind ADD VALUE IF NOT EXISTS 'swarm';
