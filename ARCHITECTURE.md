# Architecture — Hearst OS

Vue condensée de l'architecture. Pour les détails exhaustifs voir [README.md](README.md), pour le protocole agent voir [docs/AGENT-DRIVEN-DEV.md](docs/AGENT-DRIVEN-DEV.md), pour la cartographie complète voir [docs/architecture-map.json](docs/architecture-map.json).

## Stack

| Couche | Techno | Version |
| --- | --- | --- |
| Framework | Next.js (app router) | `16.2.4` |
| UI | React + React DOM | `19.2.4` |
| Style | Tailwind v4 + `@theme inline` | `^4` |
| Langage | TypeScript strict | `^5` |
| Auth | NextAuth (Google + Azure + Slack) | `^4.24.14` |
| DB | Supabase (Postgres + Storage) | `@supabase/supabase-js ^2.103.3` |
| Queue | BullMQ + Inngest | `^5.76.3` / `^4.2.6` |
| LLM | Anthropic + AI SDK + OpenAI | `^0.90` / `^6.0` / `^6.34` |
| Edge | Arcjet | `^1.4.0` |
| Observabilité | Sentry + Axiom + Langfuse | `^10.51` / `^1.6` / `^3.38` |
| State client | Zustand | `^5.0.12` |
| Validation | Zod | `^4.3.6` |
| Desktop | Electron | `^41.5.1` |
| Tests | Vitest + Playwright | `^4.1.4` / `^1.59.1` |
| Deploy | Vercel + Railway + Docker | — |

## Routes top-level (`app/`)

| Segment | Rôle |
| --- | --- |
| `app/(user)/` | Cockpit utilisateur — modèle **3 colonnes unique** : `LeftRail` (88px, menu + liens) / centre (`Shell.tsx`, Stage actif ou page ScreenShell) / `RightRailChat` (Kimi, 320px). Routes réelles : `/` (cockpit), `/copilote`, `/browser`, `/missions`, `/missions/builder`, `/run` (`/runs`→301→`/run`), `/connections` (`/apps`→301→`/connections`), `/reports`, `/reports/studio`, `/marketplace`, `/notifications`, `/archive`, `/hospitality`, `/settings`, `/settings/alerting`, `/cockpit-x` (test). Les pages "standalone" passent par `StandalonePageFrame` → `Shell`. Layout = `SessionProvider` + shell. |
| `app/admin/` | Console admin. Inclut `agent-driven-dev` (gouvernance + verrou ADD), `agents`, `analytics`, `audit`, `health`, `metrics`, `runs`, `settings`. |
| `app/api/` | Routes serveur (Next 16 route handlers). Domaines : `agents`, `auth`, `briefing`, `composio`, `connections`, `health`, `inngest`, `integrations`, `notifications`, `onboarding`, `orchestrate`, `prompts`, `reports`, `signals`, `tools`, `v2`, `webhooks`, `workflows`. |
| `app/login/` | Pages NextAuth (signin, callback, error). |
| `app/public/reports/` | Vues publiques de rapports (lecture seule, partageable par lien signé). |
| `app/assets/` | Pages internes assets (preview, manage). |
| `app/global-error.tsx` | Boundary Sentry global. |
| `app/globals.css` | Tokens Tailwind v4 + `@theme inline` (318+ tokens). |

## Cockpit — modèle 3 colonnes (Shell visionOS)

L'app est un **cockpit polymorphe** avec une seule navigation : rail gauche / centre / chat droite.

```
┌──────────────┬──────────────────────────────────┬────────────────┐
│              │                                  │                │
│  LeftRail    │     Stage central / Page         │  RightRailChat │
│  88px, glass │  (scrollable, overflow-y-auto)   │  320px, Kimi   │
│              │                                  │                │
│  • setMode() │  Stage actif (cockpit/chat/…)    │  Chat Kimi K2  │
│  • Links     │  OU page ScreenShell             │  toujours      │
│    /conn     │  (via StandalonePageFrame)        │  visible       │
│    /reports  │                                  │                │
│    …         │                                  │                │
│              │                                  │                │
└──────────────┴──────────────────────────────────┴────────────────┘
```

- Shell : `app/(user)/_shell/Shell.tsx` — orchestrateur unique.
- Stages (modes internes, via `useStageStore.setMode`) : `cockpit`, `chat`, `asset`, `asset_compare`, `mission`, `browser`, `meeting`, `kg`, `voice`, `simulation`, `artifact`, `signal`, `connections`.
- Pages-routes standalone : enveloppées dans `StandalonePageFrame` → rend `Shell` → héritent rail + chat automatiquement.
- Commutation stage : Cmd+K (Commandeur), hotkeys Cmd+1..9, ou l'agent orchestrateur via tool calls.

## Lib (`lib/` — 51 dossiers)

Regroupé par domaine :

| Domaine | Dossiers |
| --- | --- |
| LLM & prompts | `llm`, `prompts`, `embeddings` |
| Orchestration | `engine`, `core`, `agents`, `decisions`, `simulations`, `workflows`, `jobs` |
| Runtime | `engine/runtime/*` (storage, missions/scheduler, assets/cleanup, workers BullMQ) |
| Données utilisateur | `personas`, `meetings`, `inbox`, `editorial`, `reports`, `daily-brief`, `watchlist` |
| Architecture & doc | `architecture-map`, `domain`, `verticals`, `capabilities` |
| Sécurité & accès | `security` (Arcjet), `oauth`, `multi-tenant`, `agent-lock` |
| Connexions externes | `connections`, `connectors`, `integrations`, `providers`, `tools`, `webhooks` |
| Plateforme & infra | `platform`, `system`, `events`, `notifications`, `analytics`, `monitoring`, `observability` |
| Spécifiques produit | `cockpit`, `marketplace`, `credits`, `memory`, `voice`, `browser` |
| UI & utils | `ui`, `utils` |

`lib/database.types.ts` = types Supabase générés. `lib/env.server.ts` = validation Zod des env vars (importé par `proxy.ts`).

## Runtime (`instrumentation.ts`)

Bootstrap unique au boot serveur Next :

1. **Sentry** init (server + edge runtimes, gated `SENTRY_DSN`)
2. **Storage adapter** : Supabase Storage en priorité → R2 (S3-compatible) en fallback → local dev sinon. Hybrid local+R2 en dev avec clés.
3. **Mission scheduler** (`ensureSchedulerStarted`)
4. **Asset cleanup scheduler** (`ensureCleanupSchedulerStarted`)
5. **BullMQ workers** (`startAllWorkers`) — **gated off sur Vercel** (`process.env.VERCEL !== "1"`). Sur Vercel serverless les workers BullMQ ne peuvent pas tourner en arrière-plan : utiliser Inngest pour les jobs async côté prod.

`onRequestError = Sentry.captureRequestError` capture toutes les erreurs server requests automatiquement.

## Sécurité (`proxy.ts`)

Edge proxy global qui s'exécute avant chaque route handler :

1. **Arcjet** sur routes critiques (`/api/orchestrate`, `/api/v2/jobs`, `/api/v2/missions`, `/api/auth`) : rate limit + bot detection + shield. Règles strictes sur `/api/orchestrate` (coût LLM).
2. **Public paths** exemptés d'auth : `/login`, `/api/auth`, `/api/health`, `/api/webhooks`, `/api/inngest`, `/monitoring` + assets statiques (`_next`, favicon, images, fonts, modèles 3D).
3. **Auth API routes** : session NextAuth OU `HEARST_API_KEY` via header `x-api-key` ou `Authorization: Bearer …`.
4. **Auth pages** : redirige vers `/login?callbackUrl=…` si pas de session.
5. **Dev bypass** : `HEARST_DEV_AUTH_BYPASS=1` court-circuite l'auth — flag dev-only avec boot guard production.

Matcher : `/((?!_next/static|_next/image|favicon\\.ico).*)`.

## Ce qu'il ne faut PAS casser

- **`proxy.ts` PUBLIC_PATHS** : tout retrait casse l'auth (`/api/auth`, `/api/inngest`, `/api/webhooks` etc.). Vérifier auth flow avant de toucher.
- **Migration `--cykan` → `--accent-teal`** (pivot visuel 2026-05-09) : ne pas réintroduire `--cykan` dans des fichiers neufs. Mockup référence : `docs/visual/cockpit-2026-05.html`. Migration code en cours, voir [memory/project_pivot_visuel_2026_05.md](~/.claude/projects/-Users-adrienbeyondcrypto-Dev-hearst-os/memory/project_pivot_visuel_2026_05.md).
- **Verrou ADD cockpit v1.0** : features verrouillées dans `docs/AGENT-DRIVEN-DEV.md`. Avant tout edit, lancer `/feature <id>` et lire `docs/features/<id>.md`. Verrou global dans `docs/AGENT-LOCK.json`.
- **`instrumentation.ts` workers gating** : NE PAS retirer le check `process.env.VERCEL !== "1"`. Sur Vercel serverless, les workers BullMQ tournent dans le néant et empilent les jobs dans Redis sans les consommer.
- **`public/hearst-logo.svg`** : intouchable. Aucune modification, aucun rename, aucun fork. Référence visuelle canonique du brand.
- **`docs/AGENT-LOCK.json`** : ne pas écrire à la main hors `/admin/agent-driven-dev` ou demande explicite Adrien.
- **`docs/features/_manifest.json`** : régénéré par `npm run features:manifest`, jamais éditer à la main.

## Pointers

- [README.md](README.md) — vue exhaustive (1250 lignes)
- [CLAUDE.md](CLAUDE.md) — règles agent (autonomie + ADD)
- [AGENTS.md](AGENTS.md) — index des agents et hooks
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow contributeur
- [RUNBOOK.md](RUNBOOK.md) — procédures incident
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — erreurs récurrentes
- [SECURITY.md](SECURITY.md) — politique sécurité
- [docs/AGENT-DRIVEN-DEV.md](docs/AGENT-DRIVEN-DEV.md) — protocole ADD + features verrouillées
- [docs/RUNBOOK-LLM.md](docs/RUNBOOK-LLM.md) — pipeline LLM, retries, observabilité
- [docs/architecture-map.json](docs/architecture-map.json) — cartographie machine-readable
- [docs/features/](docs/features/) — specs par feature (manifest auto-généré)
- [docs/visual/cockpit-2026-05.html](docs/visual/cockpit-2026-05.html) — mockup pivot visuel silent luxury
- [HEARST-OS-DESIGN-SYSTEM.html](HEARST-OS-DESIGN-SYSTEM.html) — référence visuelle canonique
