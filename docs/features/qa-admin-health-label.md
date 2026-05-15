# QA — `/admin/health` : label global cohérent — `qa-admin-health-label`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-admin-health-label`                                                                      |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — label trompeur, un admin manque que Tavily est down                                |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

La page `/admin/health` affiche un header `"Santé système · Réussi"` (vert) alors que les cartes en dessous montrent :
- `Tavily — Hors ligne (5004 ms)`
- 10 services `Dégradé` (Exa, HeyGen, Recall.ai, LlamaParse, etc.)
- 15 OK, 3 hors ligne, 1 non configuré

Sémantique cassée : l'admin voit "Réussi" et passe à autre chose, manquant les 3 services hors ligne.

## Findings source

- **P1-002** (Zone 3) — label global "Réussi" incohérent vs cartes individuelles

## Surface concernée

- [app/admin/health/page.tsx](../../app/admin/health/page.tsx) — page admin
- [app/api/admin/health/route.ts](../../app/api/admin/health/route.ts) — endpoint (retourne `status: healthy`)
- Logique de calcul du status global

## Invariants verrouillés

### I-1. Label global = pire statut individuel

Le label en header de `/admin/health` **doit** refléter le pire statut parmi les services :
- Si ≥ 1 service `Hors ligne` → label "Hors ligne"
- Sinon si ≥ 1 service `Dégradé` → label "Dégradé"
- Sinon si tous `Réussi` → label "Réussi"

Services `Non configuré` ne comptent pas dans l'agrégation (ne pénalisent pas).

### I-2. Voix régulière FR

Statuts en voix régulière française :
- `Réussi` (pas "OK" ni "HEALTHY")
- `Dégradé` (pas "DEGRADED")
- `Hors ligne` (pas "OFFLINE" ni "DOWN")
- `Non configuré` (pas "NOT CONFIGURED")

### I-3. Cohérence label / couleur

Le statut visuel (status dot, color token) doit matcher le label :
- `Réussi` → vert / accent-teal
- `Dégradé` → or sourd / warn
- `Hors ligne` → rouge sourd / danger
- `Non configuré` → gris / muted

### I-4. Endpoint `/api/admin/health` aligné

Le endpoint **doit** retourner un champ `globalStatus` calculé selon I-1 (pas seulement `status: healthy` figé).

```ts
{
  globalStatus: "healthy" | "degraded" | "offline",
  services: HealthService[],
}
```

### I-5. Count visible

Le header affiche aussi les counts : "15 réussis, 10 dégradés, 3 hors ligne, 1 non configuré". Idéalement cliquables pour filtrer la liste.

## Critères d'acceptation testables

1. **Calcul label** : mock 3 services offline → assert header text contient "Hors ligne".
2. **Cohérence API** : `GET /api/admin/health` → `body.globalStatus` matche le calcul attendu.
3. **Voix FR** : aucun `OFFLINE`, `DOWN`, `HEALTHY` dans le DOM.
4. **Couleur** : `Hors ligne` → status dot rouge sourd.

## Évolutions autorisées

- Ajout de filtres (par catégorie, par latence).
- Polling automatique (toutes les 30s) pour mise à jour live.
- Alertes / notifications si un service passe en `Hors ligne`.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Status global trop pessimiste       | Faux positifs anxiogènes                | Distinguer services critiques |
| Status global trop optimiste        | Bug observé                             | I-1 pire statut      |
| Service `Non configuré` mal compté  | Faux negative                           | I-1 exclusion        |

## Tests à écrire

- Unit : `__tests__/admin/health-status.test.ts` — calcul globalStatus
- API : `__tests__/api/admin/health.test.ts` — réponse aligned
- E2E : `tests/e2e/admin-health-label.spec.ts` — label correct selon scénarios

## Notes & historique

- 2026-05-15 — Bug identifié Zone 3.
- Fix simple : calculer globalStatus dans le route handler à partir des services.
