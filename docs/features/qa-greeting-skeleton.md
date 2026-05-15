# QA — Cockpit greeting : skeleton vs flicker — `qa-greeting-skeleton`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-greeting-skeleton`                                                                       |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — flash de greeting non-personnalisé "Bonjour." pendant 2-3s avant la résolution session |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

Au boot de `/cockpit-x`, le H1 greeting affiche d'abord `"Bonjour."` (sans nom) pendant 2-3 secondes, puis devient `"Bonjour, Adrien."` après résolution de la session NextAuth. Idem pour l'avatar qui passe de `"?"` à `"A"`.

Pas de squelette / loading state explicite — simple swap textuel qui crée un flicker visuel.

## Findings source

- **F-006** (Zone 1) — greeting flicker "Bonjour." → "Bonjour, Adrien."
- **F-120** (Zone 2) — même bug reproduit après navigations

## Surface concernée

- [app/(user)/page.tsx](<../../app/(user)/page.tsx>) — Cockpit Home (greeting H1)
- [app/(user)/components/cockpit/CockpitHeader.tsx](<../../app/(user)/components/cockpit/CockpitHeader.tsx>) — header avec avatar + greeting
- Hook `useSession()` de NextAuth — status `loading` | `authenticated` | `unauthenticated`

## Invariants verrouillés

### I-1. Pas de version dégradée du greeting

Tant que `status === "loading"`, le H1 greeting **ne doit pas** afficher `"Bonjour."` (sans nom). Le composant doit rendre :
- soit un skeleton (placeholder block animé subtilement)
- soit rien (return null / fragment vide)
- soit la version finale uniquement quand `status === "authenticated"`

### I-2. Skeleton cohérent avec le DS

Le skeleton doit utiliser la primitive DS canonique (cf CLAUDE.md → `<RowSkeleton>`, `<CardSkeleton>`). Pour le greeting, créer ou utiliser `<HeadingSkeleton>` :
- même dimension que le H1 final (pas de layout shift)
- animation subtile (`animate-pulse` ou shimmer du DS, pas de spinner)
- couleur token `--text-muted` ou `--surface-elevated`

### I-3. Avatar idem

Si l'avatar passe de `?` à `A` (initiale), il doit lui aussi être en skeleton tant que la session loading. Pas de fallback `?` visible.

### I-4. Pas de layout shift (CLS)

Le rendu skeleton doit avoir les mêmes dimensions que le rendu final pour éviter un shift CLS. Mesure : Cumulative Layout Shift < 0.1.

### I-5. Cohérence inter-stages

Le même principe s'applique aux autres Stages qui dépendent de la session (mission, KG, etc.) : skeleton tant que `status === "loading"`, render data quand authenticated.

## Critères d'acceptation testables

1. **Pas de "Bonjour." sans nom** : navigate `/cockpit-x` avec session loading mocked → assert H1 ne contient pas `"Bonjour."` standalone (sans virgule suivante).
2. **Skeleton visible** : pendant `loading`, assert `[data-testid="greeting-skeleton"]` ou équivalent présent.
3. **Pas de layout shift** : measure CLS sur boot complet < 0.1.
4. **Avatar skeleton** : `[data-testid="avatar"]` ne contient pas `?` tant que loading.
5. **Transition propre** : `loading → authenticated` ne crée pas de flash.

## Évolutions autorisées

- Choix d'implémentation (skeleton vs delay avec opacity).
- Animation du skeleton (pulse, shimmer, fade-in).
- Customisation par stage si les besoins de loading divergent.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Skeleton trop visible / animation distrayante | UX dégradée                  | Animation sourde DS  |
| Session timeout pendant skeleton    | Skeleton infini                         | Timeout fallback     |
| Refetch après navigation = re-skeleton | Flicker à chaque transition          | Cache session client |

## Tests à écrire

- E2E : `tests/e2e/greeting-no-flicker.spec.ts` — assert pas de "Bonjour." standalone
- Unit : `__tests__/cockpit/CockpitHeader.test.tsx` — rendu selon `status` mocked
- Perf : `tests/perf/cls.spec.ts` — CLS < 0.1 sur boot

## Notes & historique

- 2026-05-15 — Bug identifié Zone 1 + Zone 2.
- Cause probable : `useSession()` retourne `data: null` pendant `status: "loading"`, le composant fallback sur `"Bonjour."` sans guard.
