# QA — Stabilité navigation shell — `qa-shell-navigation-stability`

## Métadonnées

| Champ              | Valeur                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **id**             | `qa-shell-navigation-stability`                                                                            |
| **statut**         | `draft`                                                                                                    |
| **owner**          | Adrien                                                                                                     |
| **dernière revue** | 2026-05-15                                                                                                 |
| **version spec**   | 1.0                                                                                                        |
| **niveau**         | **P0** — bloque toute la stabilité du shell utilisateur ; un user peut être éjecté du cockpit sans préavis |
| **priorité**       | `P0`                                                                                                       |
| **tag**            | `priorité-P0`, `qa-2026-05-15`                                                                             |

## Description

Le shell visionOS `/cockpit-x` doit rester stable sur sa propre URL. Pendant la session QA du 2026-05-15, des navigations parasites systématiques vers `/admin/*` (orchestrator/trust, orchestrator/overview, audit, metrics, agents/new, runs, themes, agent-driven-dev, pipeline, analytics, runs/[id]) et `/public/*` (approvals/invalid-token-test, hearst-card/invalid-token-test) sont déclenchées après simple attente, hover, screenshot ou resize — sans aucun clic ni hotkey. Reproduction multi-occurrence (≥ 15 fois sur 35min de session multi-agent).

La même classe de bug est observée à l'inverse dans Zone 3 : naviguer vers une route admin renvoie spontanément vers `/cockpit-x` après 2-3s.

Cette feature consolide la stabilité de la couche navigation entre `(user)` et `admin`.

## Findings source

- **F-036** (Zone 1) — navigations spontanées `/cockpit-x` → `/admin/audit`, `/admin/metrics`, etc.
- **F-100** (Zone 2) — reproduction systématique sur 21 routes admin/public
- **F-116** (Zone 2) — `browser_click` physique sur LeftRail dérive vers `/admin/*`, JS-click fonctionne
- **P0-001** (Zone 3) — redirection intermittente `/admin/*` → `/cockpit-x` après navigation rapide

## Surface concernée

- [app/(user)/layout.tsx](../../app/(user)/layout.tsx) — shell visionOS racine
- [app/(user)/page.tsx](<../../app/(user)/page.tsx>) — Cockpit Home
- [app/(user)/cockpit-x/](<../../app/(user)/cockpit-x/>) — route shell explicite
- [app/(user)/_shell/LeftRail.tsx](<../../app/(user)/_shell/LeftRail.tsx>) — rail nav 12 stages
- [app/admin/layout.tsx](../../app/admin/layout.tsx) — shell admin séparé
- Hooks/stores suspects à investiguer : `useStageStore`, `useGlobalHotkeys`, prefetch Next.js sur Link admin

## Hypothèses de cause

1. **Prefetch agressif** d'un `<Link href="/admin/...">` survolable au-dessus du shell `/cockpit-x` (rail, debug panel, ou layout admin shadow).
2. **Hook ou effet client** qui déclenche `router.push('/admin/...')` quand un store flag change.
3. **HMR Turbopack / React 19 transitions** réinjectant une route admin après hot reload.
4. **Cohabitation layout** admin/user shell sur mêmes routes côté Next 15 app router.

À investiguer dans cet ordre, avec capture network précise (sequence de requêtes ABORTED puis GET admin).

## Invariants verrouillés

### I-1. URL stable sur `/cockpit-x`

Naviguer à `/cockpit-x` et rester sans interaction utilisateur pendant 30s **doit** laisser `window.location.pathname === "/cockpit-x"`. Aucune dérive autorisée.

### I-2. Pas de `router.push('/admin/...')` depuis le shell utilisateur

Aucun hook, store, effet client ou composant rendu sous `app/(user)/**` ne doit appeler `router.push()` ou `router.replace()` vers une route `/admin/*` ou `/public/*`. Grep `router.push.*admin` sous `app/(user)/`, `app/hooks/`, `stores/` doit retourner vide.

### I-3. Hover physique sur LeftRail = no-op réseau

Un hover souris sur les boutons du rail gauche (`aside[aria-label="Navigation principale"] > button`) **ne doit pas** déclencher de prefetch Next.js vers une route admin. Aucun `<Link href="/admin/...">` ne doit cohabiter au-dessus du shell `/cockpit-x` en z-index ou en surface cliquable.

### I-4. Click LeftRail = stage switch local

Un click physique sur un bouton LeftRail (via `mcp__playwright__browser_click` ou click natif souris) **doit** produire le même comportement qu'un JS-click via `page.evaluate(btn.click())` : `setStageMode()` du store + `aria-current="page"` mis à jour + rendu du Stage correspondant, **sans navigation router**.

### I-5. Pas de redirection latente `/admin/*` → `/cockpit-x`

Réciproquement, depuis une route admin, aucun composant client de `app/admin/**` ne doit déclencher `router.push('/cockpit-x')` après mount. Si l'utilisateur visite `/admin/agents/new`, il y reste tant qu'il ne clique pas un lien interne.

### I-6. `/api/v2/cockpit/today` n'est pas appelé depuis `/admin/*`

Pendant la session admin, le hook `useCockpitData()` (ou équivalent) **ne doit pas** être monté. Le network log d'une visite `/admin/agents/new` ne doit montrer aucun `GET /api/v2/cockpit/today`.

## Critères d'acceptation testables

1. **Stabilité 30s** : `playwright.navigate('/cockpit-x')` + `await page.waitForTimeout(30000)` + `expect(page.url()).toBe('http://localhost:4102/cockpit-x')`.
2. **Stabilité 30s admin** : idem sur `/admin/agents/new`, `/admin/runs`, `/admin/agent-driven-dev/auth`.
3. **5× consécutifs** : reproduire les deux tests ci-dessus 5 fois sur 5 sans une seule dérive.
4. **Click + hover** : `mcp__playwright__browser_click` sur chaque bouton du LeftRail (12 boutons) → URL reste `/cockpit-x`, `aria-current="page"` mis à jour sur le bouton ciblé.
5. **Network** : pendant `/admin/agents/new`, aucun `GET /api/v2/cockpit/today` ni `GET /api/v2/user/connections` dans les 5s suivant le mount.

## Évolutions autorisées

- Refactor interne du layout shell visionOS tant que I-1 → I-6 tiennent.
- Ajout de prefetch explicite vers des routes `(user)` (cockpit-x, autres pages user) si pertinent.
- Modification du LeftRail (icônes, ordre, ajout/retrait de boutons) tant que click et hover restent inertes côté router.

## Risques & modes de défaillance

| Risque                                          | Impact                                  | Mitigation actuelle                    |
| ----------------------------------------------- | --------------------------------------- | -------------------------------------- |
| Cause root non identifiable (DevTools / Sentry) | Fix de surface qui ne tient pas         | Tracer côté serveur les GET hors-scope |
| HMR dev only                                    | Bug invisible en prod build             | Tester en `pnpm build && pnpm start`   |
| Prefetch Next.js intentionnel                   | Désactiver casse perf admin             | Désactiver `prefetch` uniquement admin |
| Store partagé entre user et admin               | Cause silencieuse de navigation croisée | Isoler les stores par layout           |

## Tests à écrire

- E2E Playwright : `tests/e2e/shell-stability.spec.ts` — navigate cockpit-x → wait 30s → assert URL
- E2E Playwright : `tests/e2e/admin-stability.spec.ts` — navigate /admin/* → wait 30s → assert URL
- E2E Playwright : `tests/e2e/leftrail-click.spec.ts` — click chaque bouton rail → assert stage switch + URL stable
- Unit : grep test (`scripts/lint-no-router-push-admin.mjs`) qui scanne `app/(user)/**` pour interdire `router.push.*admin`

## Notes & historique

- 2026-05-15 — Bug identifié par 3 audits QA parallèles (Zone 1, 2, 3), même symptôme côté shell user et admin.
- Cause root non identifiée pendant l'audit — l'enquête doit commencer par un `grep -r "router.push" app/(user)/ stores/ app/hooks/`.
