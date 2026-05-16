# Audit 4 — Deps inutilisées + scripts + docs/HTML orphelins

**Date** : 2026-05-16
**Auditeur** : Sub-agent AUDIT-4 (Claude Opus 4.7) — READ-ONLY strict
**Verrou ADD** : déverrouillé
**Scope** : `package.json` (deps + devDeps), `scripts/**`, `docs/**`, `supabase/migrations/`, `__tests__/`, `lib/database.types.ts`

---

## Stats

- **Dependencies inutilisées** : 4 (réellement) + 2 (orphelines hors-`spatial-safe`)
- **Dev dependencies inutilisées** : 0 (toutes utilisées via config/CLI, hors faux-positifs knip)
- **Scripts orphelins** : 4 candidats
- **Docs orphelines** : 11 candidates (rapports datés, jamais référencés)
- **HTML orphelins** : 11 candidats (rapports d'audit/visual datés)
- **Migrations Supabase obsolètes candidates** : 1 (à valider Adrien)
- **Tests sur fichiers supprimés** : 0
- **Database types à régénérer** : OUI (`llm_runs` créée par `0087_llm_runs.sql` absente)

---

## Section 1 — Dependencies à retirer du `package.json`

Cross-check `package.json:dependencies` × imports `from "<pkg>"` × knip output (`docs/audits/2026-05-16-cleanup/reports/knip-full-report.txt`).

| Package | Type | Last seen (réel) | Action |
|---------|------|------------------|--------|
| `@react-three/postprocessing` | dependency | uniquement dans `docs/spatial/_BACKUP_SPATIAL_WORKING_2026-05-12/**` et `docs/spatial/_BACKUP_SPATIAL_RND_BUGGY_2026-05-12/**` (archives hors-git) | **À RETIRER** (aucun usage prod, knip confirme) |
| `gsap` | dependency | uniquement dans `docs/spatial/_BACKUP_*` (archives hors-git) | **À RETIRER** (knip confirme, aucun import prod) |
| `leva` | dependency | uniquement dans `docs/spatial/_BACKUP_*` (archives hors-git) | **À RETIRER** (knip confirme, devtools panel R3F en archive) |
| `@splinetool/react-spline` | dependency | uniquement dans `nexbot_robot_character_concept_copy (1) 2/app/page.tsx` (dossier hors-projet, non versionné dans la build prod) + `components/spatial-safe/core/SpatialLogoCore.tsx` (dynamic import) | **GARDER** — `spatial-safe` est invariant en lecture seule (CLAUDE.md), donc dépendance encore consommée. Mais à investiguer si `spatial-safe` est vraiment activé en prod. |
| `@react-three/drei` | dependency | `components/spatial/materials/GlassMaterial.tsx`, `components/spatial/orbital/OrbitalRing.tsx`, `components/spatial-safe/materials/GlassMaterial.tsx`, `components/spatial-safe/orbital/OrbitalRing.tsx` | **GARDER** — utilisé prod hors backup. (knip marque inutilisée mais c'est un faux positif knip sur module CSS-Three.) |
| `@react-three/fiber` | dependency | mêmes fichiers + `hooks/spatial/useSpatialR3F.ts`, `hooks/spatial-safe/useSpatialR3F.ts` | **GARDER** — utilisé prod. |
| `three` | dependency | utilisé indirectement via @react-three/* dans `components/spatial/**` (24 fichiers, dont ~20 dans backup mais aussi dans `components/spatial/`) | **GARDER** — peer-dep de @react-three. |

### Dépendances unlisted (à AJOUTER au `package.json`)

| Package | Importé dans | Action |
|---------|--------------|--------|
| `@splinetool/runtime` | `components/spatial/core/SpatialLogoCore.tsx`, `components/spatial-safe/core/SpatialLogoCore.tsx`, `hooks/spatial/useSplineApp.ts`, `hooks/spatial-safe/useSplineApp.ts` | **À AJOUTER** dans `dependencies` (knip "Unlisted") |
| `vite/client` | `lab/cli-os/vite-env.d.ts` | OK, présent dans `lab/cli-os/package.json` (sandbox isolée, hors monorepo) |

### Dépendances utilisées mais en couplage faible (FYI, pas d'action)

- `@composio/core` : utilisé uniquement par `scripts/composio-bulk-enable.mjs` (script ponctuel d'admin). OK runtime mais surface dépendance prod ; à terme bouger en devDep.
- `cytoscape` + `react-cytoscapejs` : utilisés via `next/dynamic` (faux négatif sur regex `from`). KEEP.
- `pino-pretty` : chargé dynamiquement par `lib/observability/logger.ts` (`require()` runtime). KEEP.
- `@anthropic-ai/sdk` : KEEP (vague provider Anthropic obsolète d'après commit `feb6e442` mais encore importé dans `lib/llm/anthropic.ts` + `lib/browser/agent-loop.ts`).

### Dev dependencies

Toutes utilisées (via config CLI, plugins ou builds) — pas de finding actionnable :
- `@biomejs/biome` → CLI lint/format
- `@tailwindcss/postcss` → build CSS Tailwind v4
- `@types/*` → types-only
- `babel-plugin-react-compiler` → next config (react compiler)
- `concurrently` → script `dev:electron`
- `dotenv` → utilisé par `scripts/ping-providers.mjs`, `scripts/purge-malformed-tokens.mjs`
- `electron`, `electron-builder` → build scripts
- `esbuild` → `scripts/build-electron.mjs`
- `jsdom` → test env Vitest (config)
- `knip` → `npm run deadcode`
- `lint-staged` → pre-commit hook
- `madge` → `npm run circular`
- `pixelmatch`, `pngjs` → `scripts/spatial/audit-visual.mjs`
- `playwright`, `@playwright/test` → e2e tests
- `simple-git-hooks` → hooks
- `tailwindcss` → CSS framework
- `typescript` → core
- `vitest` → 329 fichiers tests
- `wait-on` → script `dev:electron`

**Verdict deps** : 3 retraits sûrs (`@react-three/postprocessing`, `gsap`, `leva`) + 1 ajout (`@splinetool/runtime`).

---

## Section 2 — Scripts à supprimer (`scripts/`)

| Script | Référencé ? | Statut | Action proposée |
|--------|-------------|--------|-----------------|
| `scripts/audit-broken-tokens.ts` | Aucune réf hors lui-même (utilisable en CLI ponctuel) | Outil one-shot (token audit/apply) | **GARDER** (outil dev utile, documenté en header) ou **ARCHIVER** dans `scripts/_archive/` si plus jamais utilisé |
| `scripts/purge-malformed-tokens.mjs` | Aucune réf hors lui-même | Outil one-shot tokens | **GARDER** ou **ARCHIVER** — même catégorie |
| `scripts/heist-scrape.mjs` | Aucune réf code/CI/scripts package.json | Probable obsolète (heist déjà ingéré) | **CANDIDAT SUPPRESSION** — confirmer avec Adrien |
| `scripts/heist-assets.mjs` | Aucune réf hors lui-même (juste sa propre doc) | Probable obsolète | **CANDIDAT SUPPRESSION** — confirmer avec Adrien |
| `scripts/ping-providers.mjs` | Aucune réf code/CI/scripts package.json | Doublon possible de `scripts/health-check.ts` (qui est utilisé par `npm run health`) | **CANDIDAT SUPPRESSION** — confirmer overlap |
| `scripts/launch-hearst.sh` | Aucune réf (ni par `launch.sh` root ni `package.json`) | Doublon possible de `launch.sh` racine | **CANDIDAT SUPPRESSION** — confirmer avec Adrien (le `launch.sh` racine est référencé par `npm run launch`) |
| `scripts/db-cleanup.sql` | Aucune réf code/CI | Probablement one-shot SQL manuel déjà appliqué | **CANDIDAT ARCHIVAGE** dans `supabase/sql-snippets/` ou `_archive/` |

**Scripts utilisés (KEEP)** :
- `audit-pipeline.ts` → `npm run audit`
- `backfill-kg-embeddings.ts` → documenté `docs/features/memory-kg.md` (CLI manuel ponctuel)
- `battle-mark.mjs`, `battle-next.mjs`, `battle-status.mjs` → npm scripts
- `build-electron.mjs` → `electron:compile`
- `build-features-manifest.mjs` → `features:manifest` (pre-commit hook)
- `check-agent-lock-bash.mjs`, `check-agent-lock.mjs` → hooks `.claude/settings.json`
- `claude-session-start.mjs` → hook `.claude/settings.json`
- `composio-bulk-enable.mjs` → `composio:enable-all`
- `dev-stack.sh` → `dev:stack`
- `features-test.mjs` → `features:test`
- `health-check.ts` → `health`
- `hom-run.ts` → `hom:run`
- `kill-node-zombies.sh` → `kill:zombies`
- `lint-visual.mjs` → `lint:visual`
- `list-api-routes.mjs` → `routes:list`
- `list-stores.mjs` → `stores:list`
- `next-worker-helper.sh` → `workers:audit`, `workers:kill-orphans`
- `render-report.mjs` → `.claude/commands/{audit,map,qa}.md`
- `spatial/lint.mjs` → `spatial:lint`
- `spatial/audit-visual.mjs` → `spatial:audit`
- `scripts/lib/load-env.ts` → utilitaire partagé

---

## Section 3 — Docs à archiver/supprimer

### 3.1 Docs orphelines (jamais référencées par CLAUDE.md, AGENT-DRIVEN-DEV.md, ARCHITECTURE.md, README.md, RUNBOOK.md, AGENTS.md, ni par `docs/features/_manifest.json`, ni par aucun autre `.md` du repo)

| Doc | Date | Statut | Recommandation |
|-----|------|--------|----------------|
| `docs/specs/spatial-cinema-impl.md` | non daté | Spec spatial impl, jamais cité | **ARCHIVER** dans `docs/_archive/2026/spec/` (la couche spatial est en R&D) |
| `docs/spatial/interaction-language.md` | non daté | Doc spatial cinéma | **ARCHIVER** sauf si Adrien y travaille (cité dans MEMORY.md user-memory) |
| `docs/audits/audit-live-2026-05-08.md` | 2026-05-08 (>1 sem) | Vieil audit jamais référencé | **ARCHIVER** dans `docs/_archive/2026-05-08/` |
| `docs/audits/coeur-agentique.md` | non daté | Audit jamais référencé | **ARCHIVER** |
| `docs/audits/system-flow-audit.md` | non daté | Audit jamais référencé | **ARCHIVER** |
| `docs/audits/2026-05-15_flow-minimaliste.md` | 2026-05-15 | Audit qa daté, jamais cité | **ARCHIVER** dans `docs/_archive/2026-05-15/` |
| `docs/audits/2026-05-15_ui-minimaliste.md` | 2026-05-15 | idem | **ARCHIVER** |
| `docs/audits/2026-05-15_ux-minimaliste.md` | 2026-05-15 | idem | **ARCHIVER** |
| `docs/qa/backlog-add-2026-05-15.md` | 2026-05-15 | Backlog QA daté | **ARCHIVER** |
| `docs/qa/fixes-p0-batch-2026-05-15.md` | 2026-05-15 | Rapport batch fixes | **ARCHIVER** |
| `docs/qa/investigation-nav-parasite-2026-05-15.md` | 2026-05-15 | Investigation ponctuelle | **ARCHIVER** |
| `docs/visual/audit-cockpit-2026-05-15.md` | 2026-05-15 | Audit visuel daté | **ARCHIVER** |
| `docs/visual/PLAN-MIGRATION-COCKPIT.md` | non daté | Plan migration, jamais cité | **ARCHIVER** sauf si plan actif (à valider) |
| `docs/visual/PROMPT-NAVIGATION-IMPLEMENTATION.md` | non daté | Brief prompt jamais cité ailleurs | **ARCHIVER** |
| `docs/visual/inventaire-vues-2026-05-15.md` | 2026-05-15 | Inventaire daté | **ARCHIVER** |
| `docs/architecture/ARCHITECTURE-COMPLETE.md` | non daté | Pas référencé par root `ARCHITECTURE.md` | **À VALIDER** Adrien — soit fusionner soit archiver |
| `docs/architecture/PRESENTATION-2PAGES.md` | non daté | Pitch/présentation, jamais cité | **GARDER** (artefact pitch, low cost) ou **ARCHIVER** |

### 3.2 Docs référencées et KEEP

- `docs/audit-2026-05-10.md` → cité par `README.md`
- `docs/RUNBOOK-LLM.md` → cité par `ARCHITECTURE.md`, `RUNBOOK.md`
- `docs/AGENT-DRIVEN-DEV.md` → cité par `CLAUDE.md`
- `docs/api-routes.md`, `docs/stores.md` → générés par scripts `npm run routes:list`/`stores:list`, doc dans `CONTRIBUTING.md`
- `docs/screens/right-panel-dashboard.md` → 2 refs internes
- `docs/rules/locked-zones.md` → cité par AGENT-DRIVEN-DEV.md
- `docs/audits/BATTLE-WORKFLOW.md` → 1 ref
- `docs/audits/2026-05-15_*` (3 fichiers) — note : section 3.1 indique "0 refs". Ils sont mentionnés en cross-ref interne (1 ref par fichier dans `audit-zone*-2026-05-15.md`) donc à laisser tels quels si la suite QA s'en sert.
- `docs/fixes/2026-05-11-*.md` → cités par `NODE_PROCESS_MANAGEMENT.md`
- Tous les `docs/features/*.md` → catalogués dans `_manifest.json`

### 3.3 Docs flag mais à conserver pour traçabilité

- `docs/ORCHESTRATION.md`, `docs/GO-LIVE-USER-GUIDE.md`, `docs/GO-LIVE-MONITORING.md`, `docs/NODE_PROCESS_MANAGEMENT.md`, `docs/pipeline-audit-2026-05-03.md` — 0 ref code mais artefacts opérationnels go-live ; **GARDER** (faible cost stockage, valeur historique haute).

---

## Section 4 — Fichiers HTML (recommandation KEEP / ARCHIVE / DELETE)

| Fichier | Date | Refs | Recommandation | Justification |
|---------|------|------|----------------|---------------|
| `docs/visual/dashboard-template.html.bak` | (présent dans `git status` `??`) | 0 | **DELETE** | `.bak` explicitement listé scope de l'audit. Doublon non-tracké. |
| `docs/visual/dashboard-template.html` | (présent `??`) | 0 | **À VALIDER** Adrien | Template référence ? Statut WIP (untracked dans git status). |
| `docs/visual/flow-demo.html` | non daté | 0 | **ARCHIVE** vers `docs/_archive/visual/` | Aucune référence dans le code/docs |
| `docs/visual/flow-demo-v2.html` | non daté | 3 refs (cockpit/timeline-rail/context-rail features) | **KEEP** | Référencé par specs features |
| `docs/visual/flow-demo-v3.html` | non daté | 0 | **ARCHIVE** | Probable itération obsolète (v5 existe) |
| `docs/visual/flow-demo-v5.html` | non daté | 0 | **À VALIDER** | Latest version, peut-être l'active sandbox |
| `docs/visual/cockpit-2026-05.html` | 2026-05 | 3 refs (mockup canonique pivot 2026-05) | **KEEP** | Cité dans MEMORY user-memory + features |
| `docs/visual/journal-2026-05-10.html` | 2026-05-10 | 0 | **ARCHIVE** vers `docs/_archive/visual/2026-05-10/` | Journal ponctuel, daté |
| `docs/visual/surfaces-proposal-2026-05.html` | 2026-05 | 0 | **ARCHIVE** | Proposition jamais référencée |
| `docs/visual/services-actions-generation-2026-05-15.html` | 2026-05-15 | 0 | **ARCHIVE** | Sortie audit datée |
| `docs/design/sandbox-2026-05-15.html` | 2026-05-15 | 0 | **ARCHIVE** dans `docs/_archive/design/2026-05-15/` | Sandbox sortie skill `/design` ponctuelle |
| `docs/qa/rapport-consolide-2026-05-15.html` | 2026-05-15 | 0 | **ARCHIVE** | Sortie skill `/qa` ponctuelle |
| `docs/audit/horizon-2026-05-14.html` | 2026-05-14 | 0 | **ARCHIVE** | Sortie skill `/horizon` |
| `docs/audit/audit-2026-05-15.html` | 2026-05-15 | 0 | **ARCHIVE** | Sortie skill `/audit` |
| `docs/audit/nettoyage-2026-05-15.html` | 2026-05-15 | 0 | **ARCHIVE** | Sortie skill `/nettoyage` |
| `docs/audits/2026-05-10-security/AUDIT-MASTER.html` | 2026-05-10 | 3 refs | **KEEP** | Rapport sécurité maître Battle Plan actif |
| `docs/audits/2026-05-10-security/BATTLE-PLAN.html` | 2026-05-10 | 3 refs | **KEEP** | Rapport Battle Plan actif |

**Résumé HTML** :
- DELETE direct : 1 (`dashboard-template.html.bak`)
- ARCHIVE candidats : 10 (`flow-demo.html`, `flow-demo-v3.html`, `journal-2026-05-10.html`, `surfaces-proposal-2026-05.html`, `services-actions-generation-2026-05-15.html`, `sandbox-2026-05-15.html`, `rapport-consolide-2026-05-15.html`, `horizon-2026-05-14.html`, `audit-2026-05-15.html`, `nettoyage-2026-05-15.html`)
- À VALIDER Adrien : 2 (`dashboard-template.html`, `flow-demo-v5.html`)
- KEEP : 4 (`flow-demo-v2.html`, `cockpit-2026-05.html`, `AUDIT-MASTER.html`, `BATTLE-PLAN.html`)

---

## Section 5 — Migrations Supabase candidates (NE PAS supprimer sans validation manuelle)

**79 fichiers** dans `supabase/migrations/`, de `0001` à `0087`.

### Migrations potentiellement consolidées/dryrun (à valider Adrien)

| Migration | Date | Statut suggéré | Note |
|-----------|------|----------------|------|
| `0070_per_user_tenant_DRYRUN.sql` | non daté | **CANDIDATE SUPPRESSION** après validation manuelle Adrien | Le suffixe `DRYRUN` suggère un dry-run jamais appliqué prod. La migration `0070_per_user_tenant.sql` (sans suffixe) coexiste. À confirmer si le DRYRUN est juste un brouillon historique ou s'il porte de la logique consolidée. |

### Migrations anciennes (> 6 mois) à investiguer

L'audit ne dispose pas de timestamps git pour chaque fichier sans exécution coûteuse. Recommandation :
- Exécuter `git log --reverse --format="%ai %f" -- supabase/migrations/000{1..3}*.sql` pour dater les premières migrations.
- Si la baseline `0001_agents.sql` + `0002_full_schema.sql` couvre déjà le schema initial appliqué prod, les migrations 0001-0030 pourraient être candidates à un **squash** (consolidation en une `0000_baseline.sql` archivée + une `0001_post_baseline.sql`).

**⚠ NE RIEN SUPPRIMER SANS VALIDATION** : si une instance dev local n'a pas la migration appliquée, la supprimer casserait son rebuild. Risque DB prod : nul (les migrations ne sont jamais re-jouées sur prod existante) **mais** risque sur les environnements dev/staging fraîchement provisionnés.

**Action recommandée** : laisser tel quel, juste flag pour Adrien à la prochaine grande consolidation DB.

---

## Section 6 — Tests sur fichiers supprimés

Audit effectué sur 325 fichiers de test dans `__tests__/` (extensions `.test.ts`, `.test.tsx`).

Pour chaque test, résolution de tous les imports `from "@/..."` et `from "./..."` vers les fichiers de prod. Vérification d'existence avec extensions `.ts`, `.tsx`, `.js`, `.mjs` + résolution `index.*`.

**Résultat** : **0 imports cassés**.

Tous les fichiers de prod testés existent. Aucun test orphelin détecté.

(Note : ne couvre pas les imports faits dynamiquement via `import()` ou les imports de fixtures qui ont été exclus.)

---

## Section 7 — Database types à régénérer ?

**Fichier** : `lib/database.types.ts` (134 799 octets, 4 651 lignes, généré le 2026-05-15 22:22)

### Tables migrations récentes vs `database.types.ts`

| Migration | Table | Présent dans `lib/database.types.ts` ? |
|-----------|-------|----------------------------------------|
| `0087_llm_runs.sql` (Vague 4 observability) | `llm_runs` | **NON** — table manquante |
| `0086_grant_credits_and_stripe_events.sql` | `stripe_events` ? | à vérifier manuellement |
| `0085_settle_credits_idempotency.sql` | `credits_idempotency` ? | à vérifier manuellement |
| `0084_rls_run_steps_tightening.sql` | RLS only (no new table) | n/a |
| `0083_extend_run_kind_media.sql` | `runs.kind` ENUM ext | à vérifier |
| `0082_theme_assets.sql` | `theme_assets` | à vérifier |
| `0081_user_theme_preferences.sql` | `user_theme_preferences` | à vérifier |

### Action recommandée

**Régénérer `lib/database.types.ts`** via :
```bash
npx supabase gen types typescript --project-id <PROJECT_ID> --schema public > lib/database.types.ts
```
ou via le MCP Supabase (`mcp__supabase__generate_typescript_types`).

Cible : table `llm_runs` (run_cost enrichi provider+model dans le commit `76f73db6` — utilisation typed Supabase = sans typage actuel = `any` partout sur cette surface observability).

---

## Récapitulatif actionnable (priorité)

### P0 — Régression risk
1. **Régénérer `lib/database.types.ts`** : `llm_runs` (commit `76f73db6` Vague 4 observability) absente.
2. **Ajouter `@splinetool/runtime` dans `dependencies`** : 4 imports prod actuels sans entrée package.json (risque CI fragile).

### P1 — Bloat package
3. Retirer `@react-three/postprocessing`, `gsap`, `leva` de `dependencies` (3 deps, ~MB ; confirmées knip + grep no usage hors `_BACKUP_`).
4. Supprimer `docs/visual/dashboard-template.html.bak` (untracked, suffixe `.bak`).

### P2 — Nettoyage
5. Décider sort de 4 scripts orphelins (`heist-scrape.mjs`, `heist-assets.mjs`, `ping-providers.mjs`, `launch-hearst.sh`, `db-cleanup.sql`) — suppression ou archivage.
6. Archiver 10 fichiers HTML datés/orphelins dans `docs/_archive/<categorie>/<date>/`.
7. Archiver 13 docs `.md` orphelines (audits/qa/visual 2026-05-15) dans `docs/_archive/2026-05-15/`.

### P3 — À valider Adrien
8. Statut `docs/visual/dashboard-template.html` (untracked, peut-être template référence active).
9. Statut `docs/visual/flow-demo-v5.html` (dernière itération, jamais référencée — orpheline ou active ?).
10. Statut `supabase/migrations/0070_per_user_tenant_DRYRUN.sql` (DRYRUN à supprimer ?).
11. Statut `docs/architecture/ARCHITECTURE-COMPLETE.md` vs `ARCHITECTURE.md` racine (doublon ou complément ?).

---

## Limites de l'audit

- Imports dynamiques (`import("...")`, `require()` runtime) peuvent créer des faux positifs sur la détection de deps inutilisées. Les cas connus (`pino-pretty`, `react-cytoscapejs`, `cytoscape`, `@splinetool/react-spline`) ont été vérifiés manuellement.
- `nexbot_robot_character_concept_copy (1) 2/` est un dossier hors-projet (a son propre `package.json`) — exclu du périmètre.
- `lab/cli-os/` est une sandbox isolée (CLAUDE.md confirme) — non auditée.
- Migrations Supabase : aucune suppression proposée par principe — gel à la prochaine consolidation manuelle Adrien.
- `spatial-safe/**` : zone read-only invariant CLAUDE.md — non touchée, juste citée pour expliquer pourquoi certaines deps R3F restent nécessaires.
