# QA — CSP : fonts Google bloquées — `qa-csp-fonts`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-csp-fonts`                                                                               |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — 2-4 erreurs console persistantes sur **toutes** les pages, thème Robotflow inutilisable |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

La CSP définie dans `next.config.ts` bloque `https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap` à chaque navigation. Cette stylesheet est chargée 2-4× par navigation et toujours bloquée, générant des erreurs console persistantes sur toutes les pages (admin, user, public).

La police Inter Tight est utilisée par le thème "Robotflow" (cf `/admin/themes`) qui devient inutilisable (fallback font).

Deux options de fix : retirer toute référence à Inter+Tight (Satoshi est la police canonique) OU étendre la CSP pour autoriser Google Fonts.

## Findings source

- **F-045** (Zone 1) — CSP bloque Inter+Tight, 4 erreurs console
- **F-115** (Zone 2) — même finding, 2× par navigation
- **P1-001** (Zone 3) — CSP bloque, thème Robotflow inutilisable

## Surface concernée

- [next.config.ts](../../next.config.ts) — directive CSP `style-src` ligne 13-17
- [app/(user)/themes/](<../../app/(user)/themes/>) ou équivalent registry thèmes — référence Inter+Tight pour Robotflow
- [app/globals.css](../../app/globals.css) — `@import` Google Fonts éventuel
- [app/layout.tsx](../../app/layout.tsx) — `<link rel="preload">` ou `<link rel="stylesheet">` éventuel

## Invariants verrouillés

### I-1. Aucune erreur CSP en console sur load page

`/cockpit-x`, `/admin/*`, `/public/*` : 0 erreur console liée à CSP au load initial. Lecture `mcp__playwright__browser_console_messages` → aucun message contenant "violates the following Content Security Policy".

### I-2. Si Inter+Tight retiré → toutes refs supprimées

Si l'option "retirer Inter+Tight" est choisie :
- Aucun `<link>` vers `fonts.googleapis.com` dans `<head>`
- Aucun `@import url('https://fonts.googleapis.com')` dans les CSS
- Le thème Robotflow utilise une font self-hosted (Inter dispo via `@fontsource` ou similaire) ou tombe sur Satoshi
- Grep `Inter+Tight` dans le code → 0 occurrence

### I-3. Si CSP étendue → autoriser uniquement les domaines Google Fonts canoniques

Si l'option "étendre CSP" est choisie :
- `style-src` inclut `https://fonts.googleapis.com`
- `font-src` inclut `https://fonts.gstatic.com`
- Pas de wildcard `*.google.com` global

### I-4. Satoshi reste la police canonique du DS

Indépendamment du fix, **Satoshi Variable** (`--font-satoshi`) reste la police canonique de Hearst OS. Inter Tight n'est qu'une font de thème secondaire (Robotflow). Le fix ne doit pas casser Satoshi.

## Critères d'acceptation testables

1. **Aucune erreur CSP** : `playwright.navigate('/cockpit-x')` + `expect(consoleMessages.filter(m => m.text.includes('Content Security Policy')))` → length === 0.
2. **Idem `/admin/themes`** : 0 erreur CSP.
3. **Idem `/public/approvals/invalid-token-test`** : 0 erreur CSP.
4. **Thème Robotflow fonctionnel** : `/admin/themes` → activer Robotflow → font appliquée (soit Inter Tight via CSP étendue, soit fallback self-hosted).
5. **Satoshi intact** : `/cockpit-x` → `getComputedStyle(h1).fontFamily.includes('Satoshi')`.

## Évolutions autorisées

- Switch entre les deux options selon contexte (perf, dépendance externe, etc.).
- Ajout d'autres polices self-hosted (Adobe Fonts, fontshare déjà whitelisté).
- Renforcement CSP sur d'autres directives (`script-src`, `connect-src`).

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| CSP étendue ouvre brèche XSS        | Vulnérabilité injection style          | Préférer self-host  |
| Self-hosting alourdit bundle        | Perf dégradée                           | `font-display: swap` + subset Latin |
| Retrait Inter+Tight casse Robotflow | Thème inutilisable                      | Fallback Satoshi    |

## Tests à écrire

- E2E : `tests/e2e/csp-no-violations.spec.ts` — assert 0 erreur CSP sur 5 routes clés
- Unit : `__tests__/themes/robotflow.test.ts` — font appliquée si Robotflow actif
- Lint : grep `fonts.googleapis.com` dans CSS et `<head>` → 0 si option "retirer" choisie

## Notes & historique

- 2026-05-15 — Bug identifié par les 3 audits QA en parallèle, sur toutes les routes. Trivial à fixer mais pollue tous les logs console depuis longtemps.
- Recommandation : self-hoster Inter Tight via `@fontsource/inter-tight` (option qu'on garde la police, sans dépendance Google).
