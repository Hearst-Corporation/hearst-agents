# Cockpit — `cockpit`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `cockpit` |
| **statut** | `in_progress` (verrouillé sur invariants ci-dessous) |
| **owner** | Adrien |
| **dernière revue** | 2026-05-04 |
| **version spec** | 1.3 |
| **pivot d'origine** | 2026-04-29 (cockpit polymorphe post-shell 3 colonnes) |

## Description

Écran d'accueil de l'app Hearst OS. Affiche en un coup d'œil l'état du jour : briefing IA, missions en cours, KPIs (assets / missions / reports), agenda live (Google Calendar via Composio), watchlist live (Stripe MRR / HubSpot pipeline / Stripe runway via Composio), strip d'activité temps réel basée sur les événements SSE du runtime. Vertical hospitality affiche un badge dédié.

Philosophie : **fail-soft** (une source en erreur ne casse pas le cockpit) et **honest empty state** (pas de mock fallback — Phase B3 — si Stripe/Calendar non connectés, on affiche un empty state "Connect X").

## Surface publique

### Page
- [app/(user)/page.tsx](../../app/(user)/page.tsx) — RSC, prefetch `getCockpitToday(scope)` côté serveur, passe `initialData` à `HomePageClient`
- [app/(user)/HomePageClient.tsx](../../app/(user)/HomePageClient.tsx) — route via `useStageStore.current.mode === "cockpit"` vers `<CockpitStage>`

### Composants câblés (rendus actuellement)
- [CockpitStage.tsx](../../app/(user)/components/stages/CockpitStage.tsx) — conteneur stage : fetch `/api/v2/cockpit/today`, gère loading/error/success, sync client même si RSC prefetch
- [CockpitHome.tsx](../../app/(user)/components/cockpit/CockpitHome.tsx) — layout cockpit (header → activity strip → **HearstParticlesCloud hero** → KPI strip → accordion agenda+watchlist)
- [CockpitHeader.tsx](../../app/(user)/components/cockpit/CockpitHeader.tsx) — greeting prénom + date/heure + missions running count
- [ActivityStrip.tsx](../../app/(user)/components/cockpit/ActivityStrip.tsx) — ticker live (dernier SSE event > dernier run > briefing > "no recent activity")
- [HearstParticlesCloud.tsx](../../app/(user)/components/cockpit/HearstParticlesCloud.tsx) — nuage de ~15k particules (Three.js Points + AdditiveBlending) formant le H Hearst par sampling alpha de `public/hearst-mark-h.svg`. Réactif souris (force répulsive cykan), ResizeObserver container-relative, `flex-1` minHeight `--space-48`. Remplace HearstLogo3D (v1.3)
- [KPIStrip.tsx](../../app/(user)/components/cockpit/KPIStrip.tsx) — 3 cartes Assets | Missions | Reports
- [CockpitAgenda.tsx](../../app/(user)/components/cockpit/CockpitAgenda.tsx) — agenda du jour (max 4 items, empty CTA → /apps#calendar)
- [WatchlistMini.tsx](../../app/(user)/components/cockpit/WatchlistMini.tsx) — watchlist compacte (max 3 items, sparkline 7pts, anomaly badge)

### Composants code-ready non câblés (orphelins)
- [QuickActionsGrid.tsx](../../app/(user)/components/cockpit/QuickActionsGrid.tsx) — grille 6 tiles (≤3 suggestions ML + ≤3 favoris reports + universels)
- [AgentsConstellation.tsx](../../app/(user)/components/cockpit/AgentsConstellation.tsx) — grille services connectés (mode "panel" 4×3 ou "band" rangée)
- [CockpitHero.tsx](../../app/(user)/components/stages/CockpitHero.tsx) — hero éditorial (briefing headline+body)

### Endpoint API
- `GET /api/v2/cockpit/today` ([route.ts](../../app/api/v2/cockpit/today/route.ts))
  - **Auth** : `requireScope()` (401 sinon)
  - **Runtime** : `nodejs`, `force-dynamic`
  - **Input** : aucun (scope tiré de la session)
  - **Output** : `CockpitTodayPayload & { scope: { isDevFallback } }`
  - **Erreur** : 500 `internal_error` si `getCockpitToday` throw uncaught

## Architecture interne

### Orchestrateur backend
- [lib/cockpit/today.ts](../../lib/cockpit/today.ts) — `getCockpitToday(scope)` agrège **6 sources en parallèle fail-soft** :
  1. `buildBriefing()` → `getSummary(userId)` + extract headline (≤160ch) + body (≤360ch ellipsis)
  2. `buildMissionsRunning()` → join `getScheduledMissions` + memory missions + ops runtime, max 4, running first, inclut orphans
  3. `buildSuggestions()` → `getApplicableReports()` filtré par connected providers, status `ready|partial`, max 3
  4. `buildFavoriteReports()` → `CATALOG.slice(0, 3)`
  5. `buildInbox()` → `loadLatestInboxBrief()` + stale check (>1h)
  6. `buildHospitalitySection()` → mock KPI snapshot (industry hospitality only)
  - Counts : `assets`, `reports` (filtered type=report), `missions`
  - `mockSections[]` tracking des sources non-live
  - Wrapper `safe<T>(label, fn, fallback)` log warn + return fallback

### Live data providers
- [lib/cockpit/agenda-live.ts](../../lib/cockpit/agenda-live.ts) — Google Calendar via Composio
  - Action : `GOOGLECALENDAR_LIST_EVENTS`
  - Plage : maintenant → demain 12:00, max 20
  - Cache : 5min per (userId, tenantId)
  - Helper test : `_resetAgendaCache()`
- [lib/cockpit/watchlist-live.ts](../../lib/cockpit/watchlist-live.ts) — Stripe + HubSpot via Composio
  - Actions : `STRIPE_LIST_SUBSCRIPTIONS` (MRR), `STRIPE_LIST_CHARGES` (runway approx), `HUBSPOT_LIST_DEALS` (pipeline weighted, exclu closed)
  - Cache : 5min per (userId, tenantId)
  - Anomaly detection (vague 9, action #3) : snapshots → 7-day baseline → threshold 5% → narration Haiku ≤140ch via `narrateAnomaly()`
  - Fail-soft per source : si Stripe down, item "—" + CTA "Connecte X"
  - Helper test : `_resetWatchlistCache()`

### Stores Zustand consommés

| Store | Composant | Selectors |
|-------|-----------|-----------|
| `useStageStore` | CockpitStage, HomePageClient | `setMode`, `lastMissionId`, `current.mode` |
| `useNavigationStore` | QuickActionsGrid, HomePageClient | `activeThreadId`, `addThread`, `surface`, `messages`, `addMessageToThread`, `updateMessageInThread`, `updateThreadName` |
| `useRuntimeStore` | ActivityStrip, AgentsConstellation, HomePageClient | `coreState`, `events`, `addEvent`, `startRun`, `setAbortController` |
| `useServicesStore` | AgentsConstellation | `services`, `loaded`, `setServices`, `setLoaded` |
| `useVoiceStore` | QuickActionsGrid, HomePageClient | `setVoiceActive` |
| `useFocalStore` | HomePageClient | `hydrateThreadState`, `clearFocal`, `hide`, `isVisible` |

### Types
- `CockpitTodayPayload` (défini dans [lib/cockpit/today.ts](../../lib/cockpit/today.ts)) — contrat frontend ↔ backend

### Dépendances externes
- `three` (vanilla, sans R3F) — système de particules `HearstParticlesCloud`. Asset SVG local : `public/hearst-mark-h.svg` (778 B, partagé avec Hearst-app marketing) — sampling alpha pour positionner les particules en forme de H
- Composio SDK (via `lib/connectors/composio/`) — Calendar / Stripe / HubSpot live data
- `next-auth/react` — `useSession()` pour prénom dans Header / Hero
- Anthropic SDK (Haiku) — narration d'anomalie watchlist

## Data flow

```
[RSC app/(user)/page.tsx]
   ↓ getCockpitToday(scope) — server-side, prefetch
   ↓ initialData prop
[HomePageClient]
   ↓ Stage router (useStageStore)
   ↓ mode="cockpit"
[CockpitStage]
   ↓ useEffect mount → fetch /api/v2/cockpit/today (sync même si RSC prefetch)
[CockpitHome]
   ├─ CockpitHeader  (session → prénom + clock 30s)
   ├─ ActivityStrip  (useRuntimeStore.events + clock 1s)
   ├─ KPIStrip       (data.assets / missions / reports favoris)
   └─ <details> accordion
        ├─ CockpitAgenda    (data.agenda — live via watchlist-live)
        └─ WatchlistMini    (data.watchlist — sparkline + anomaly)
```

## Invariants verrouillés

Toute modification de l'un des points ci-dessous **exige une mise à jour de cette spec validée par Adrien**. Les modifs hors invariants peuvent passer par PR normale.

### I-1. Contrat endpoint `/api/v2/cockpit/today`
- Méthode `GET`, `requireScope()`, runtime `nodejs`, `force-dynamic`
- Output reste `CockpitTodayPayload & { scope }`
- Pas de migration vers POST, GraphQL, ou auth différente sans spec

### I-2. Philosophie fail-soft
- Toute nouvelle source ajoutée à `getCockpitToday()` **doit** passer par `safe<T>()`
- Une source en erreur **ne doit jamais** kill le payload entier
- Les tests `__tests__/cockpit/today.test.ts` "fail-soft (one source error)" doivent rester verts

### I-3. Honest empty state (Phase B3)
- Watchlist et Agenda **n'ont pas de mock fallback** quand vides
- Si Stripe/HubSpot/Calendar non connectés : empty state avec CTA `/apps#serviceId`
- Pas de réintroduction de fake KPIs "—" sans spec

### I-4. Cache live providers
- TTL 5min sur `agenda-live.ts` et `watchlist-live.ts`
- Cache key `(userId, tenantId)` — pas global
- Helpers `_resetAgendaCache()` et `_resetWatchlistCache()` exposés pour tests

### I-5. Stage routing
- L'entrée du Cockpit reste `useStageStore.current.mode === "cockpit"`
- `CockpitStage` reste l'unique conteneur pour ce mode
- Pas de fork "CockpitStageV2" sans spec

### I-6. Hero particules (HearstParticlesCloud)
- Asset SVG obligatoire : `public/hearst-mark-h.svg` (synchronisé avec Hearst-app marketing) — sampling pixel alpha pour la silhouette du H
- Rendu vanilla `three` (`THREE.Points` + `BufferGeometry` + `PointsMaterial` + `AdditiveBlending`). Pas de R3F ni drei.
- Couleur lue runtime depuis `--cykan` (parsing hex → int Three.js)
- Sizing **container-relative** : `getBoundingClientRect()` + `ResizeObserver`, jamais `window.innerWidth/Height` (le cockpit est un panneau, pas un viewport)
- `dynamic(() => …, { ssr: false })` obligatoire — Three.js manipule WebGL au mount
- Particle count : 15k desktop / 6k mobile (override possible via prop) — ne pas remonter sans benchmark perf

### I-7. RSC prefetch + client refetch
- La page reste un RSC qui prefetch côté serveur
- `CockpitStage` **doit** refetch côté client au mount (KPIs à jour, ne pas s'appuyer uniquement sur SSR snapshot)
- Pas de migration full-CSR sans spec

### I-8. *(libre)*

## Évolutions autorisées sans spec

- Polish CSS / spacing / typo / tokens dans les composants câblés
- Ajout d'un nouveau KPI dans `KPIStrip` (si data déjà dans `CockpitTodayPayload`)
- Nouvelle source dans `getCockpitToday()` **wrappée dans `safe()`** (respecte I-2)
- Refactor interne d'un composant cockpit (split en sous-composants, extraction primitive)
- Ajout de tests
- Câblage d'un composant orphelin (QuickActionsGrid, CockpitHero, AgentsConstellation) à condition de respecter les invariants
- Ajout d'une nouvelle action dans `QuickActionsGrid` universal tiles
- Ajout d'un provider dans `watchlist-live.ts` (autre KPI Stripe/HubSpot, ou nouveau service)

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| Spline crash (WebGL, asset load) | Cockpit blanc | `SplineErrorBoundary` isole, dynamic import `ssr:false` |
| Composio Stripe/HubSpot down | Watchlist vide | Fail-soft per source, CTA fallback dans l'item |
| Calendar non connecté | Agenda empty | Empty state avec CTA `/apps#calendar` |
| Briefing absent | Hero vide | Fallback "Pas encore de signal" + CTA gold `/apps` |
| SSE runtime déconnecté | ActivityStrip stale | Fallback : last mission run > briefing > "No recent activity" |
| `getCockpitToday` throw uncaught | 500 endpoint | À surveiller — pas de wrapper safe au niveau supérieur |
| Cache stale (5min) | KPIs en retard | Acceptable, justifié par coût Composio |
| Hospitality mock data | Confusion réel/mock | Badge "demo" affiché si `mockSections.includes(...)` |

## Tests

### Existants
- [`__tests__/cockpit/today.test.ts`](../../__tests__/cockpit/today.test.ts) — 10 cases : payload completeness, watchlist empty (Phase B3), favorite reports, briefing logic + truncate, missions join + running first + orphans, suggestions, fail-soft
- [`__tests__/cockpit/today-with-inbox.test.ts`](../../__tests__/cockpit/today-with-inbox.test.ts) — 6 cases : inbox empty, needsConnection, brief populated, stale 1h, snoozed filter, fail-soft inbox
- [`__tests__/cockpit/watchlist-live.test.ts`](../../__tests__/cockpit/watchlist-live.test.ts) — 4 cases : CTA fallback all-fail, MRR calc, pipeline weighted, cache 5min dedup

### Manquants (gap à combler)
- **E2E Playwright cockpit** : aucun test e2e dédié `cockpit.spec.ts`. Le `happy-path.spec.ts` couvre indirectement.
- **Test agenda-live** : aucun test sur `lib/cockpit/agenda-live.ts` (cache, time range, unwrap Composio response)
- **Test composants UI** : aucun test sur `CockpitHeader`, `KPIStrip`, `WatchlistMini`, `CockpitAgenda`, `ActivityStrip`, `CockpitHome` (snapshot ou interaction)
- **Test HearstParticlesCloud** : aucun test (Three.js mock + ResizeObserver mock + image load fallback)
- **Test CockpitStage** : aucun test (loading state, error state, refetch on mount, RSC initialData passthrough)
- **Test QuickActionsGrid** : aucun test (priorité suggestions > favoris > universels, runSuggestion via hook)
- **Test AgentsConstellation** : aucun test (tri actif > idle > pending > error, mode panel vs band)
- **Test anomaly detection watchlist** : `narrateAnomaly` n'est pas testé sous le scope cockpit
- **Test contract endpoint** : pas de contract test sur `GET /api/v2/cockpit/today` (auth required, output shape)

## Code orphelin (code-ready non câblé)

Ces composants existent, sont compilables, mais ne sont **pas importés** dans `CockpitHome`. Probablement réservés pour une vague future.

| Composant | État | Plan présumé |
|-----------|------|--------------|
| [QuickActionsGrid](../../app/(user)/components/cockpit/QuickActionsGrid.tsx) | Logique complète (suggestions ML + favoris + universels) | Remplacé visuellement par le hero 3D ; à supprimer si non recâblé d'ici v1.3 |
| [AgentsConstellation](../../app/(user)/components/cockpit/AgentsConstellation.tsx) | Modes panel et band prêts | Probablement pour ContextRail (mode panel) ou PulseBar (mode band) |
| [CockpitHero](../../app/(user)/components/stages/CockpitHero.tsx) | Hero éditorial briefing | Alternative ou complément à CockpitHeader |

⚠ **Tant que ces composants ne sont pas câblés**, ils ne sont pas verrouillés par les invariants. Mais leur câblage = update spec obligatoire.

## État actuel du repo (drift à clore)

Au moment de la rédaction de cette spec (2026-05-03), **les fichiers cockpit suivants ont des modifications non commitées** :

```
app/(user)/components/cockpit/ActivityStrip.tsx     | 52 lignes
app/(user)/components/cockpit/CockpitAgenda.tsx     | 10 lignes
app/(user)/components/cockpit/CockpitHeader.tsx     |  4 lignes
app/(user)/components/cockpit/CockpitHome.tsx       | 29 lignes
app/(user)/components/cockpit/KPIStrip.tsx          |  5 lignes
app/(user)/components/cockpit/QuickActionsGrid.tsx  | 30 lignes
app/(user)/components/cockpit/WatchlistMini.tsx     |  8 lignes
```

**Action recommandée** : commit ou stash avant de poser le verrou. Un verrou sur un état non-commité n'est pas une référence stable.

## Notes & historique

- **Pivot 2026-04-29** : passage shell 3 colonnes → cockpit polymorphe avec PulseBar top + ChatDock bottom
- **Vague 9 (anomaly detection)** : ajout narration Haiku sur deltas watchlist >5% vs 7-day baseline
- **Migration 3D v1** (commits `2581e7d` → `ecd6997`) : Three.js abandonné au profit de Spline runtime pour HaloAgentCore (constellation 6 agents).
- **Pivot 3D v1.2 (2026-05-04)** : Spline + HaloAgentCore retirés au profit de HearstLogo3D (R3F + GLB local). Identité de marque (le H) plutôt que constellation générique.
- **Pivot 3D v1.3 (2026-05-04)** : HearstLogo3D + GLB + R3F retirés au profit de **HearstParticlesCloud** (vanilla Three.js + sampling SVG H + AdditiveBlending). Effet "scintillement électrique" magnétique qui réagit à la souris. Asset partagé avec Hearst-app marketing (`hearst-mark-h.svg`). Stack 3D minimaliste : juste `three`, plus de drei/fiber/GLB.
- **Phase B3** : suppression des mock fallbacks watchlist/agenda — empty state honnête à la place
