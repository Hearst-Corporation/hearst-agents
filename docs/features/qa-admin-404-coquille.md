# QA — Admin : 404 dynamiques dans la coquille — `qa-admin-404-coquille`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-admin-404-coquille`                                                                      |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — 404 brut Next.js sans sidebar admin, utilisateur perdu sans chemin retour          |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

Les routes dynamiques admin (`/admin/agents/[id]`, `/admin/orchestrator/runs/[id]`, et probablement d'autres) tombent en **404 brut Next.js** quand l'id est invalide. La page rendue est `404: This page could not be found.` sans :
- sidebar admin
- breadcrumb
- lien retour `/admin`

Conséquence : l'admin est éjecté de son shell admin et doit utiliser le bouton back du navigateur.

## Findings source

- **P1-003** (Zone 3) — 404 brut sur `/admin/agents/fake-id-test` et `/admin/orchestrator/runs/fake-run-id`
- **F-005** (Zone 3) — capture du 404 brut

## Surface concernée

- [app/admin/agents/[id]/page.tsx](<../../app/admin/agents/[id]/page.tsx>)
- [app/admin/agents/[id]/not-found.tsx](<../../app/admin/agents/[id]/not-found.tsx>) — à créer
- [app/admin/orchestrator/runs/[id]/page.tsx](<../../app/admin/orchestrator/runs/[id]/page.tsx>)
- [app/admin/orchestrator/runs/[id]/not-found.tsx](<../../app/admin/orchestrator/runs/[id]/not-found.tsx>) — à créer
- [app/admin/agent-driven-dev/[id]/page.tsx](<../../app/admin/agent-driven-dev/[id]/page.tsx>)
- [app/admin/runs/[id]/page.tsx](<../../app/admin/runs/[id]/page.tsx>)
- [app/admin/layout.tsx](../../app/admin/layout.tsx) — shell admin

## Invariants verrouillés

### I-1. 404 dans la coquille admin

Tout fichier `not-found.tsx` sous `app/admin/**` **doit** rendre la coquille admin (sidebar + topbar + content area) avec :
- titre "Page introuvable" ou "Élément introuvable" selon contexte
- message FR clair (ex: "Agent introuvable", "Run introuvable")
- bouton "Retour à `<liste>`" (ex: `/admin/agents`)
- bouton secondaire "Retour à `/admin`"

### I-2. `not-found.tsx` par route dynamique

Chaque route dynamique sous `/admin` qui peut générer un 404 doit avoir son `not-found.tsx` propre :
- `app/admin/agents/[id]/not-found.tsx`
- `app/admin/orchestrator/runs/[id]/not-found.tsx`
- `app/admin/agent-driven-dev/[id]/not-found.tsx`
- `app/admin/runs/[id]/not-found.tsx`

Le contenu peut varier (lien retour pertinent), mais la coquille est identique.

### I-3. Voix régulière FR

Pas de "404 Not Found" en anglais. Voix régulière : "Page introuvable", "Agent introuvable", "Run introuvable".

### I-4. Status HTTP 404

Le rendu doit conserver le status HTTP 404 (pas 200), pour respecter la sémantique HTTP et le SEO interne.

### I-5. Pas de double 404

Si une route 404 mais que `notFound()` est appelé dans le page handler, Next.js cherche le `not-found.tsx` le plus proche. S'assurer qu'aucune redirection inutile vers `/admin` n'est faite (sinon perte de l'URL et confusion historique).

## Critères d'acceptation testables

1. **Coquille présente** : `curl /admin/agents/fake-id-test` → response body contient `aria-label="Navigation admin"` ou équivalent sidebar.
2. **Lien retour** : `<a href="/admin/agents">` présent dans la page 404.
3. **Status 404** : `curl -I /admin/agents/fake-id-test` → `HTTP/1.1 404`.
4. **Voix FR** : aucun "404 Not Found" anglais dans le DOM.
5. **Couvert sur 4 routes** : test pour chaque route dynamique listée en I-2.

## Évolutions autorisées

- Customisation du copywriting par route (suggestion d'actions, recherche, etc.).
- Ajout d'un champ de recherche pour retrouver l'élément par nom.
- Logging des 404 fréquents pour détecter des liens cassés internes.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Oubli d'un `not-found.tsx`          | 404 brut persiste                       | Lint route check     |
| Coquille casse en dev (HMR)         | Layout shift                            | Test E2E             |
| Lien retour pointe vers route 404    | Boucle 404                              | Valider lien existe  |

## Tests à écrire

- E2E : `tests/e2e/admin-404-coquille.spec.ts` — pour 4 routes, vérifier sidebar + retour
- Lint : check existence `not-found.tsx` pour chaque route dynamique sous `/admin/`

## Notes & historique

- 2026-05-15 — Bug identifié Zone 3.
- Le 404 brut est le comportement par défaut de Next.js — fix = créer les `not-found.tsx` manquants.
