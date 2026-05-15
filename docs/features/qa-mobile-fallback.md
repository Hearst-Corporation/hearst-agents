# QA — Mobile : fallback shell visionOS — `qa-mobile-fallback`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-mobile-fallback`                                                                         |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — sur viewport mobile, le shell `/cockpit-x` n'est pas rendu, page dérive ailleurs   |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`, `responsive`                                                 |

## Description

Sur viewport 375×812 (iPhone 13), naviguer à `/cockpit-x` :
- `aside[aria-label="Navigation principale"]` absent du DOM
- Page dérive immédiatement vers `/admin/pipeline` (probable bug F-100 navigation parasite, mais aussi)
- `/admin/pipeline` affiche `"⌥ Vue desktop requise — Le canvas pipeline est optimisé pour les écrans larges"`

Le shell visionOS est desktop-only. Aucun fallback mobile n'est implémenté.

Note : Zone 1 a observé que `/cockpit-x` n'a pas de scroll horizontal sur 375×812 (F-040), mais sans le shell rendu, c'est ambigu.

## Findings source

- **F-112** (Zone 2) — shell visionOS desktop-only, dérive vers admin/pipeline
- **F-040** (Zone 1) — mobile responsive sans scroll horizontal (mais shell présent ?)

## Surface concernée

- [app/(user)/cockpit-x/page.tsx](<../../app/(user)/cockpit-x/page.tsx>)
- [app/(user)/layout.tsx](<../../app/(user)/layout.tsx>) — shell visionOS
- [app/(user)/_shell/LeftRail.tsx](<../../app/(user)/_shell/LeftRail.tsx>)
- Hook ou détection viewport
- [app/admin/pipeline/](<../../app/admin/pipeline/>) — message "Vue desktop requise" (à reproduire mais pour le shell user, pas l'admin)

## Invariants verrouillés

### I-1. Choix explicite : desktop-only ou mobile responsive

Deux options exclusives :

**Option A — Mobile desktop-only intentionnel** :
- Sur viewport < 768px, `/cockpit-x` rend un écran "Vue desktop requise" propre, en cohérence avec le DS Hearst.
- Pas de dérive vers `/admin/pipeline`.
- Message FR : "L'expérience Hearst OS est optimisée pour les écrans desktop (≥ 1024px). Reviens sur ton ordinateur."
- CTA optionnel : "Recevoir un lien email pour ouvrir sur desktop".

**Option B — Mobile responsive** :
- Le shell s'adapte avec :
  - LeftRail → bottom bar 12 stages (icônes scrollables horizontalement)
  - ChatDock → drawer pleine page
  - ContextRail → drawer overlay (swipe)
  - PulseBar → fixed top
- Tous les Stages s'adaptent en 1 colonne.

### I-2. Pas de dérive vers `/admin/pipeline`

Sur mobile, naviguer à `/cockpit-x` **ne doit pas** rediriger vers `/admin/pipeline` (qui est une route admin destinée aux admins, pas un fallback pour les utilisateurs mobiles).

### I-3. Aucun scroll horizontal sur viewport mobile

Quelle que soit l'option choisie, `scrollWidth === clientWidth` sur viewport ≤ 375px. Pas de débordement.

### I-4. Détection viewport propre

La détection mobile se fait via :
- CSS `@media (max-width: 767px)` pour Option A (display: none du shell + display: block du fallback)
- Hook `useViewportSize()` ou équivalent pour Option B (rendu conditionnel composants)

Pas de user-agent sniffing.

### I-5. Tests responsive systématiques

Chaque nouveau Stage/composant ajouté au shell **doit** être testé en 375, 768, 1024, 1440px.

## Critères d'acceptation testables

### Option A (recommandée par défaut tant que mobile pas priorisé)

1. **375px → page fallback** : `playwright.viewport({width: 375, height: 812})` + navigate `/cockpit-x` → assert h1 contient "Vue desktop requise" ou équivalent.
2. **Pas de dérive admin** : URL reste `/cockpit-x`, pas de redirect vers `/admin/pipeline`.
3. **Pas de scroll horizontal** : `scrollWidth === clientWidth`.
4. **Voix FR** : message en français voix régulière.

### Option B (si mobile priorisé)

1. **Shell mobile présent** : `aside[aria-label="Navigation"]` ou équivalent bottom bar visible.
2. **12 stages accessibles** : scroll horizontal des stages.
3. **ChatDock drawer fonctionnel** : ouvre, ferme, message envoyable.
4. **Pas de débordement** : `scrollWidth === clientWidth`.

## Évolutions autorisées

- Bascule d'Option A vers Option B quand le mobile devient priorité produit.
- Customisation du message fallback (CTA, illustration, etc.).
- Détection viewport plus fine (tablet 768-1023 = layout intermédiaire).

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Dérive parasite vers admin          | Bug critique                            | I-2 + spec qa-shell-navigation-stability |
| Choix Option A puis user demande mobile | Migration coûteuse                  | Option A explicite et documentée |
| Mobile responsive cassé sur certains breakpoints | UX dégradée            | Tests systématiques  |

## Tests à écrire

- E2E : `tests/e2e/mobile-fallback.spec.ts` — viewport 375 + navigate cockpit-x → assert message
- E2E : `tests/e2e/no-mobile-derive-admin.spec.ts` — viewport 375 → pas de dérive admin

## Notes & historique

- 2026-05-15 — Bug identifié Zone 2 : shell desktop-only sans fallback explicite.
- Décision recommandée : Option A (page "Vue desktop requise") tant que mobile n'est pas une priorité produit.
