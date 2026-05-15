# Audit QA — Zone 3 (Admin + Connections + Public)

- **Date** : 2026-05-15
- **Branche** : `feat/shell-visionos`
- **Serveur** : `http://localhost:4102`
- **Auth** : dev-bypass actif (`HEARST_DEV_AUTH_BYPASS=1`) — user simulé `Admin (dev)`
- **AGENT-LOCK** : `locked === false` (lecture du fichier en début de session).
- **Outils** : Playwright MCP (Chromium), curl, grep sur le code source.

## Executive summary

| Sévérité | Findings |
| --- | --- |
| P0 | 1 |
| P1 | 6 |
| P2 | 5 |
| P3 | 3 |
| **Total** | **15** |

- **Couverture** : 27 routes admin + 1 route `/connections` + 3 surfaces `/public/[token]` testées (token invalide uniquement — aucun token valide disponible côté Adrien).
- **Bug structurant** : redirection intermittente `/admin/*` → `/cockpit-x` observée plusieurs fois lorsque la navigation se fait juste après une autre navigation Playwright (timing). Difficile à reproduire fiablement mais reproductible (F-008, F-024 « auth »).
- **Sécurité UX** : tokens invalides sur `/public/*` → erreurs propres FR sans leak PII. Bonne base.
- **CSP** : `Content-Security-Policy` du `next.config.ts` bloque `https://fonts.googleapis.com/css2` chargé par le thème Robotflow → erreurs console sur **toutes** les pages.
- **PII** : `/api/admin/runs/recent` renvoie en clair `tenantId`, `userId`, `missionId`, `input` complet (incluant URLs visitées par l'agent). Pas un leak public mais discutable côté admin.
- **A11y** : `/connections` n'a **aucun heading** dans le DOM. P1 a11y.

## Matrice exhaustive routes

| Route | HTTP | URL stable | Verdict | Preuve |
| --- | --- | --- | --- | --- |
| `/admin` | 200 | ✓ | OK | F-001 |
| `/admin/pipeline` | 200 | ✓ (après stabilisation) | OK — canvas live + 10 stages + runs récents | F-002, F-034 |
| `/admin/agents` | 200 | ✓ | OK — 4 agents seedés affichés | F-003 |
| `/admin/agents/new` | 200 | ✓ | OK — form contrôlé, sliders/selects, submit conditionnel | F-004, F-032 |
| `/admin/agents/[id]` (fake) | 404 | ✓ | KO — 404 brut Next.js sans coquille admin | F-005 |
| `/admin/runs` | 200 | ✓ (intermittent) | OK — liste des runs, statut, date | F-007, F-033 |
| `/admin/runs/[id]` (réel) | 200 | ✓ | OK — détail tokens/cost/latence/traces | F-027 |
| `/admin/orchestrator` | redirect SSR → `/overview` | ✓ | OK | F-019 |
| `/admin/orchestrator/overview` | 200 | ✓ | OK — KPIs trust + dernier runs | F-019 |
| `/admin/orchestrator/command-center` | 200 | ✓ | OK — SSE live, heartbeat, agent grid, queue, retries, blockers | F-009 |
| `/admin/orchestrator/agents` | 200 | ✓ | OK — capability contracts | F-010 |
| `/admin/orchestrator/registry` | 200 | ✓ (intermittent) | OK — registry global (812 entrées) | F-011 |
| `/admin/orchestrator/runs` | 200 | ✓ | OK — table 79 runs | F-012 |
| `/admin/orchestrator/runs/[id]` | 200 | ✓ | OK — détail intake + replay snapshot + agents | F-013 |
| `/admin/orchestrator/runs/fake-id` | 404 | ✓ | KO — 404 brut sans coquille | (annexe) |
| `/admin/orchestrator/trust` | 200 | ✓ | OK — 7 dimensions + historique | F-016 |
| `/admin/orchestrator/drift` | 200 | ✓ | OK — 5 000 findings par type + top fichiers | F-014 |
| `/admin/orchestrator/telemetry` | 200 | ✓ | OK — logs JSONL par agent | F-017 |
| `/admin/orchestrator/quarantine` | 200 | ✓ | OK — empty state + anomaly score live | F-015 |
| `/admin/orchestrator/release` | 200 | ✓ | OK — 6 gates + signature humaine bloquée | F-018 |
| `/admin/analytics` | 200 | ✓ | OK — usage cross-tenant + chart placeholder | F-020 |
| `/admin/audit` | 200 | ✓ | OK — empty state propre | F-021 |
| `/admin/health` | 200 | ✓ | OK fonctionnel — voir P1-002 sur le label « Réussi » global | F-022 |
| `/admin/metrics` | 200 | ✓ | OK — métriques LLM globales + circuit breakers | F-023 |
| `/admin/agent-driven-dev` | 200 | ✓ | OK — dashboard verrou + 32/41 features | F-024 |
| `/admin/agent-driven-dev/[id]` (`auth`) | navigation client → `/cockpit-x` | ✗ | **KO** observable au moins 1 fois | F-024 (cockpit-x post-redirect) |
| `/admin/settings` | 200 | ✓ | OK — 8 entrées 5 catégories | F-025 |
| `/admin/themes` | 200 | ✓ | OK fonctionnel — voir P1-001 thème Robotflow + CSP | F-026 |
| `/connections` | 200 | ✓ | KO a11y — pas de heading, KO labels — voir P1-005 | F-028 |
| `/public/approvals/[token]` (invalide) | 200 | ✓ | OK — message FR clair, pas de leak | F-029 |
| `/public/reports/[token]` (invalide) | 200 | ✓ | OK — message + CTA marketing | F-030 |
| `/public/hearst-card/[token]` (invalide) | 200 | ✓ | OK — message + CTA | F-031 |

## Carte API zone 3 (vu pendant l'audit)

### Endpoints REST

| Endpoint | Statut | Note |
| --- | --- | --- |
| `GET /api/admin/health` | 200 JSON | `status: healthy` même si `/admin/health` UI montre Tavily HORS LIGNE et 10 dégradés (incohérence label). |
| `GET /api/admin/audit` | 200 JSON | `{logs:[],total:0}` |
| `GET /api/admin/agent-lock` | 200 JSON | `{locked:false,…}` cohérent avec `docs/AGENT-LOCK.json` |
| `GET /api/admin/settings` | 200 JSON | 8 entrées, `updatedBy:null` partout |
| `GET /api/admin/llm-metrics` | 200 JSON | `providers:[]` — pas encore de provider tracké |
| `GET /api/admin/webhooks-status` | 200 JSON | `{webhooks:[]}` |
| `GET /api/admin/features-manifest` | 200 **vide** | Body 0 byte. Voir P1-006. |
| `GET /api/admin/runs/recent` | 200 JSON | **PII en clair** — voir P1-004. |
| `GET /api/admin/metrics/live` | 200 JSON | `runsPerMin:2, p95LatencyMs:null` |
| `GET /api/composio/connections` | 200 JSON | 9 connexions Composio (Asana EXPIRED, autres ACTIVE) |
| `GET /api/composio/diagnose` | 200 JSON | `{ok:false, error:"missing app param"}` — endpoint nécessite param, message FR absent |
| `GET /api/connections/expiring` | 200 JSON | 1 connexion expirée Asana |
| `GET /api/connections/native` | 200 JSON | 3 connexions Google natives |
| `GET /api/orchestrator/cc/state` | 200 JSON | État mesh complet (run\_id, heartbeat, agents, blockers) |
| `POST /api/admin/seed/agents` (sans CSRF) | 403 JSON | `{error:"csrf_origin_mismatch"}` — bonne défense |
| `POST /api/v2/approvals/invalid/vote` (sans CSRF) | 403 JSON | `{error:"csrf_origin_mismatch"}` — idem |

### Streams SSE

| Endpoint | Statut | Note |
| --- | --- | --- |
| `GET /api/orchestrator/cc/stream` | 200 SSE `event: state` | Tick visible immédiatement, payload identique à `/cc/state` |
| `GET /api/admin/events-stream` | 200 headers, **0 byte body en 2s** | Voir P2-001 — pas d'événement émis spontanément, comportement à confirmer |

## Info display — Top 5

1. **`/admin/orchestrator/command-center`** : densité haute mais bien hiérarchisée (severity stack / queue / retries / escalations / blockers / agent grid). KO mineur : `phase: idle` et `heartbeat 19:30:46` sans timezone visible.
2. **`/admin/orchestrator/drift`** : 5 000 findings affichés, pagination invisible — l'œil ne sait pas où il en est. Top fichiers donné mais sans lien cliquable vers la ligne. P2-002.
3. **`/admin/orchestrator/release`** : `STATUS blocked` clair, gates listés avec statut binaire. ✓ check ASCII (`✓` / `✗`) mélange voix régulière FR et symboles — `Réussi` / `Échec` aligné DS serait mieux. P3-001.
4. **`/admin/pipeline`** : canvas SSE bien lisible. KO : aucun stage cliquable sans run actif (lampe « Active le live ↑ » mais le bouton « ACTIVER LE LIVE » n'a pas d'état visuel disabled vs idle). P2-003.
5. **`/admin/health`** : 28 services listés avec latence et statut. Label global « Santé système — Réussi » alors que Tavily est `Hors ligne` et 10 services `Dégradés`. P1-002.

## Findings

### P0 — Bloquants

#### P0-001 — Redirection intermittente `/admin/*` → `/cockpit-x`

- **Reproduction** :
  1. Login dev (`/api/auth/dev-login`).
  2. Naviguer vers une route admin tout de suite après (`/admin/agents/new`, `/admin/runs`, `/admin/agent-driven-dev/auth`, `/admin/orchestrator/registry`).
  3. Attendre 2-3 secondes.
- **Observable** : l'URL passe de `/admin/<route>` à `/cockpit-x`, `document.title` devient `Loading http://localhost:4102/cockpit-x` puis `Hearst`, le contenu rendu est le Cockpit normal.
- **Preuves** : F-008 (`/admin/runs` post-redirect), F-024 (`/admin/agent-driven-dev/auth` post-redirect), captures `Loading http://localhost:4102/cockpit-x` au title.
- **Network observé** : pendant `/admin/agents/new`, un `GET /api/v2/cockpit/today` part alors qu'aucun composant admin ne devrait appeler ce endpoint.
- **Hypothèse de cause** : un composant ou hook client global (suspect : `useGlobalHotkeys` n'est pas en cause car non monté en `/admin`, mais un prefetch RSC ou un store stage Zustand peut déclencher un navigation hors `(user)` layout). Aucun `router.push("/cockpit-x")` explicite dans le code (grep). À investiguer côté navigation latente Turbopack / React 19 transitions.
- **Impact** : Adrien peut se retrouver renvoyé sur le cockpit sans préavis quand il veut consulter une page admin. Verrouille la couverture QA des routes dynamiques (`/admin/agents/[id]`, `/admin/agent-driven-dev/[id]`).
- **Critère d'acceptation** : naviguer à `/admin/agents/new` puis attendre 10 secondes — l'URL doit rester `/admin/agents/new` et le titre `Hearst`. Reproduire 5× sans observation de redirection.

### P1 — Importants

#### P1-001 — CSP bloque `fonts.googleapis.com` (thème Robotflow inutilisable)

- **Reproduction** : ouvrir n'importe quelle page (ex. `/admin/themes`) → console DevTools.
- **Observable** :
  ```
  Loading the stylesheet 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap'
  violates the following Content Security Policy directive: "style-src 'self' 'unsafe-inline' https://api.fontshare.com"
  ```
- **Cause** : `next.config.ts` `style-src` n'inclut pas `https://fonts.googleapis.com` ; `font-src` n'inclut pas `https://fonts.gstatic.com`. Le thème `Robotflow` ([F-026](screenshots/zone3/F-026-admin-themes.png) carte « Robotflow ») demande `Inter Tight` depuis Google Fonts. Le thème est annoncé comme switchable instantanément mais sa font sera bloquée par CSP.
- **Impact** : 2 errors console persistantes sur **toutes** les pages (admin, user, public). Activer Robotflow donne un rendu en font fallback.
- **Critère d'acceptation** : soit (1) inliner la font Robotflow dans `public/`, soit (2) ajouter `https://fonts.googleapis.com` à `style-src` + `https://fonts.gstatic.com` à `font-src` dans `next.config.ts:13-17`.

#### P1-002 — `/admin/health` label global « Réussi » incohérent

- **Reproduction** : `/admin/health` à `http://localhost:4102/admin/health`.
- **Observable** :
  - Header « Santé système · Réussi » (vert)
  - Cartes en dessous : `Tavily — Hors ligne (5004 ms)`, `Exa — Dégradé`, `HeyGen — Dégradé`, `Recall.ai — Dégradé`, `LlamaParse — Dégradé`, etc.
  - 15 OK, 10 dégradés, 3 hors ligne, 1 non configuré.
- **Impact** : label global trompeur — un admin qui voit « Réussi » manque que Tavily est down. C'est une mauvaise sémantique pour un check de santé.
- **Critère d'acceptation** : label global = pire statut individuel (sauf `Non configuré`). Avec 3 hors ligne → « Hors ligne » ou « Dégradé » global.

#### P1-003 — 404 brut Next.js sur routes dynamiques admin

- **Reproduction** : `/admin/agents/fake-id-test` ou `/admin/orchestrator/runs/fake-run-id`.
- **Observable** : page 404 brute (`document.title === "404: This page could not be found."`), pas de sidebar admin, pas de breadcrumb, pas de retour vers `/admin`. Voir F-005.
- **Impact** : utilisateur perdu — pas de chemin de retour visible dans l'UI. Bizarre pour un admin qui s'attend à rester dans son shell.
- **Critère d'acceptation** : `not-found.tsx` dans `app/admin/agents/[id]/` et `app/admin/orchestrator/runs/[id]/` qui rend la coquille admin + un message FR « Agent introuvable » + un lien retour `/admin/agents`.

#### P1-004 — `/api/admin/runs/recent` retourne PII complet

- **Reproduction** : `curl http://localhost:4102/api/admin/runs/recent` (en dev-bypass, sans cookie).
- **Observable** : champs renvoyés `tenantId`, `userId`, `missionId`, `workspaceId`, `input` (full prompt user, ex. *"navigue sur https://www.hearstcorporation.io/"*).
- **Impact** : si le dev-bypass venait à être laissé actif sur un env autre que local, l'endpoint admin renvoie en clair tout l'historique des prompts utilisateurs. Pour usage admin pur c'est OK, mais on devrait au moins masquer `tenantId/userId` ou exiger un scope cookie même en dev.
- **Critère d'acceptation** : (1) middleware d'auth strict sur `/api/admin/*` même en dev-bypass (cookie obligatoire), (2) `input` tronqué à 200 caractères par défaut, full visible uniquement sur `/admin/runs/[id]`.

#### P1-005 — `/connections` n'a aucun heading + boutons sans label

- **Reproduction** : ouvrir `/connections`.
- **Observable** :
  - `document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]').length === 0`
  - 140 boutons sur la page, premier bouton textuel `"1"` sans `aria-label`.
  - Boutons catégories (`Tout123`, `Développement19`, `Collaboration15`) sans `aria-label` → la valeur agglutinée au label est lue par les lecteurs d'écran (`Tout cent vingt-trois`).
- **Impact** : a11y WCAG 2.2 AA non respecté — navigation au clavier + lecteur d'écran cassée pour une surface critique (gestion d'apps tierces).
- **Critère d'acceptation** : `<h1>Connexions</h1>` en haut de `ConnectionsHub.tsx`, headings `<h2>Connectés</h2>`, `<h2>Pour aller plus loin</h2>`, `<h2>Catalogue</h2>`. Bouton « 1 » → `aria-label="Voir les notifications de connexion"`. Catégories → texte + count séparé visuellement et `aria-label="Filtrer par développement (19 apps)"`.

#### P1-006 — `/api/admin/features-manifest` retourne 0 byte

- **Reproduction** : `curl http://localhost:4102/api/admin/features-manifest` → status 200, body vide.
- **Observable** : `/admin/agent-driven-dev` affiche bien 41 features (donc une source existe), mais le endpoint manifest est silencieux.
- **Hypothèse** : code de route lit `docs/features/_manifest.json` mais le fichier est absent ou le response stream est mal terminé.
- **Critère d'acceptation** : `curl …/features-manifest` retourne un JSON `{ok:true, features: [...]}` (>= 1 byte). Régénérer via `npm run features:manifest` si nécessaire.

### P2 — À traiter

#### P2-001 — `/api/admin/events-stream` ne pousse rien en 2s

- **Reproduction** : `curl --max-time 2 -N -H "Accept: text/event-stream" /api/admin/events-stream`.
- **Observable** : headers `text/event-stream` reçus mais **0 byte** de body capturé en 2 secondes. À comparer avec `/api/orchestrator/cc/stream` qui envoie un event `state` instantanément.
- **Impact** : si le DOM admin attend un heartbeat / un ping, il peut rester en `Chargement…` sans feedback. Le widget topbar admin (`Runs/min`, `Latence p95`) consomme cet endpoint via `/api/admin/metrics/live` polling — l'event-stream est-il utilisé ?
- **Critère d'acceptation** : émettre un event `connected` dans les 100ms suivant l'ouverture du flux, puis un `heartbeat` toutes les 15s.

#### P2-002 — `/admin/orchestrator/drift` : 5 000 findings sans pagination

- **Reproduction** : `/admin/orchestrator/drift`.
- **Observable** : `TOTAL 5000`, table massive scrollable, pas de pagination ni filtre. Top fichiers liste 10 entrées sans lien cliquable vers la ligne de code.
- **Impact** : impossible d'attaquer un finding spécifique — la table est un wall of text.
- **Critère d'acceptation** : pagination (50 par page) + filtre par `type` (déjà présent visuellement) actif + lien cliquable sur chaque chemin de fichier qui ouvre `/admin/orchestrator/registry` filtré.

#### P2-003 — `/admin/pipeline` : bouton « ACTIVER LE LIVE » sans état visuel d'attente

- **Reproduction** : `/admin/pipeline`, observer le bouton top.
- **Observable** : bouton `ACTIVER LE LIVE` toujours rendu de la même manière. Texte sous-jacent « Active le live ↑ · clique un stage pour sa fiche » donne l'instruction mais le bouton lui-même ne change pas (pas de loading, pas de connected, pas de hover guidance).
- **Critère d'acceptation** : trois états visuels — `idle`, `connecting`, `live` (avec status dot vert + halo cyan canonique).

#### P2-004 — `/admin/orchestrator/command-center` heartbeat sans fuseau horaire

- **Reproduction** : `/admin/orchestrator/command-center`.
- **Observable** : `heartbeat 19:30:46`, `phase: idle`. Heure brute sans précision UTC vs local. Pour un panneau ops temps réel c'est ambigu.
- **Critère d'acceptation** : `heartbeat 19:30:46 (Europe/Paris)` ou `19:30:46 UTC`. Idéalement timestamp relatif `il y a 2s`.

#### P2-005 — `/admin/agents` boutons « Démarrer / Pauser » non visibles

- **Reproduction** : `/admin/agents`.
- **Observable** : `numButtons === 1` côté nav, 4 cartes agents mais aucune action visible (kill, pause, edit, view detail). Le seul bouton listé est `AAdrien (dev)` (avatar topbar).
- **Impact** : feature « Slack Replier », « Research Analyst », etc. listée mais inactionnable.
- **Critère d'acceptation** : chaque carte agent expose au moins « Détail », « Pause », et confirmation modale pour « Supprimer » (anti double-clic, body lock, focus trap conformément aux specs cockpit-x).

### P3 — Polish

#### P3-001 — `/admin/orchestrator/release` mélange symboles ASCII et voix régulière

- **Observable** : statuts `✓ passé` / `✗ échec` côte-à-côte. Le DS Hearst pousse plutôt `Réussi` / `Échec` (voix éditoriale FR 2026-04-29).
- **Critère d'acceptation** : `Réussi` / `Échec` en t-13 + status dot cykan/danger.

#### P3-002 — `/admin/themes` montre `Hearst OS (default)` avec parenthèses + `Robotflow 2026-05-15` sans titre uniforme

- **Observable** : un thème dit `(default)` entre parenthèses, l'autre montre `2026-05-15` au lieu d'un statut. Verbalisation incohérente.
- **Critère d'acceptation** : badge « ACTIF » (présent sur Hearst OS) et badge « Inactif » sur Robotflow + format date uniforme.

#### P3-003 — `/admin/audit` empty state minimal

- **Observable** : « Aucune entrée d'audit » + table headers vides. Pas de microcopy d'aide.
- **Critère d'acceptation** : « Aucune entrée pour le moment. Les actions admin (changement de settings, kill agent, signature release) apparaîtront ici. »

## Tests bloqués

- **`/admin/orchestrator/runs/[id]` avec id réel** : testé OK (F-013).
- **`/admin/agents/[id]` avec id réel** : `/api/agents` retourne `{ok:true, agents:[]}` — les 4 agents affichés sur `/admin/agents` sont des seeds hardcodés sans ID exposable. Donc impossible de tester `/admin/agents/[id]` côté UI sans peupler un agent. **Tester avec un agent créé en POST `/api/agents` (CSRF requis)**.
- **`/admin/agent-driven-dev/[id]` avec id réel** : tentative `/admin/agent-driven-dev/auth` → P0-001 (redirect cockpit-x).
- **Token valide `/public/*`** : aucun token signé HMAC Approval / Report / Hearst Card disponible. **Tester en générant une mission qui émet un approval link (script seed) ou un report public**.
- **Suppression / quarantine / kill** : aucun bouton « Supprimer / Quarantine / Kill » présent dans l'UI auditée → modales de confirmation pas testables tant que P2-005 pas résolu.
- **Permissions non-admin** : impossible de simuler un user non-admin en dev-bypass — celui-ci court-circuite le check. **Tester en désactivant `HEARST_DEV_AUTH_BYPASS` et en se loggant avec un user dont `role !== 'admin'` → doit redirect vers `/` per `app/admin/layout.tsx:29`**.
- **PII en console** : aucun token ni email leak observé côté front. Côté serveur (`/api/admin/runs/recent`) cf P1-004.

## Annexes

### Erreurs console répétées sur toutes les pages

```
[ERROR] Loading the stylesheet 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap'
violates the following Content Security Policy directive:
"style-src 'self' 'unsafe-inline' https://api.fontshare.com"
```
2 occurrences par page. Cf P1-001.

### Inventaire screenshots

36 captures dans `docs/qa/screenshots/zone3/F-001 ... F-036`.

### Routes admin couvertes (27)

`/admin`, `/admin/pipeline`, `/admin/agents`, `/admin/agents/new`, `/admin/agents/[id]` (404 attendu), `/admin/runs`, `/admin/runs/[id]`, `/admin/orchestrator`, `/admin/orchestrator/overview`, `/admin/orchestrator/command-center`, `/admin/orchestrator/agents`, `/admin/orchestrator/registry`, `/admin/orchestrator/runs`, `/admin/orchestrator/runs/[id]`, `/admin/orchestrator/trust`, `/admin/orchestrator/drift`, `/admin/orchestrator/telemetry`, `/admin/orchestrator/quarantine`, `/admin/orchestrator/release`, `/admin/analytics`, `/admin/audit`, `/admin/health`, `/admin/metrics`, `/admin/agent-driven-dev`, `/admin/agent-driven-dev/[id]` (redirect bug), `/admin/settings`, `/admin/themes`.

### Endpoints API testés (zone 3)

`/api/admin/health`, `/api/admin/audit`, `/api/admin/agent-lock`, `/api/admin/llm-metrics`, `/api/admin/webhooks-status`, `/api/admin/features-manifest`, `/api/admin/runs/recent`, `/api/admin/metrics/live`, `/api/admin/settings`, `/api/admin/seed/agents` (POST CSRF), `/api/admin/events-stream` (SSE), `/api/composio/connections`, `/api/composio/diagnose`, `/api/composio/apps`, `/api/connections/expiring`, `/api/connections/native`, `/api/orchestrator/cc/state`, `/api/orchestrator/cc/stream` (SSE), `/api/v2/approvals/[token]/vote` (POST CSRF).

### Tokens dans URLs

Tous les tests de `/public/*` ont utilisé le token littéral `invalid-token-test` — pas de redaction nécessaire. Aucun token réel signé HMAC manipulé pendant cet audit.
