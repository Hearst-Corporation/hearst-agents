# QA — `/api/admin/runs/recent` : PII tronquée + auth strict — `qa-admin-runs-pii`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-admin-runs-pii`                                                                          |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — endpoint admin retourne PII complet en clair, accessible même en dev-bypass         |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`, `sécurité`                                                   |

## Description

L'endpoint `GET /api/admin/runs/recent` retourne en clair les champs PII :
- `tenantId`
- `userId`
- `missionId`
- `workspaceId`
- `input` (full prompt utilisateur, ex: `"navigue sur https://www.hearstcorporation.io/"`)

Risques :
1. Si `HEARST_DEV_AUTH_BYPASS=1` venait à être laissé actif sur un env staging ou prod par erreur → exposition de tout l'historique des prompts utilisateurs.
2. Même en usage admin pur, retourner `input` complet en list view (`/admin/runs`) est excessif — l'admin n'a besoin que d'un aperçu, le détail complet est sur `/admin/runs/[id]`.
3. Pas de scope cookie obligatoire en dev → curl direct accède sans auth.

## Findings source

- **P1-004** (Zone 3) — `/api/admin/runs/recent` retourne PII complet
- Carte API zone 3 : endpoint testé en curl sans cookie

## Surface concernée

- [app/api/admin/runs/recent/route.ts](../../app/api/admin/runs/recent/route.ts) — route handler
- [app/api/admin/](../../app/api/admin/) — middleware admin (à créer ou vérifier)
- [lib/platform/auth/scope.ts](../../lib/platform/auth/scope.ts) — `requireScope()` + check role admin
- [app/admin/runs/page.tsx](../../app/admin/runs/page.tsx) — consumer UI

## Invariants verrouillés

### I-1. Auth admin strict sur `/api/admin/*`

Toute route sous `/api/admin/*` **doit** :
1. Vérifier que la session existe (cookie NextAuth ou bypass dev strictement loggé).
2. Vérifier que `session.user.role === "admin"` (ou check équivalent).
3. Retourner `401 Unauthorized` si pas authentifié, `403 Forbidden` si pas admin.

Même en `HEARST_DEV_AUTH_BYPASS=1`, l'endpoint **doit** exiger un cookie session. Pas d'accès curl raw sans session.

### I-2. `input` tronqué à 200 caractères par défaut

Le champ `input` dans la réponse `/api/admin/runs/recent` (list view) **doit** être tronqué à 200 caractères max, suffixé par `…` si plus long.

Le full input reste visible uniquement sur `/admin/runs/[id]` (detail view, après navigation explicite).

### I-3. PII identifiants masqués par défaut

`tenantId`, `userId`, `workspaceId`, `missionId` peuvent être retournés mais :
- soit en forme tronquée (8 premiers chars + `…`)
- soit derrière un toggle "Voir IDs complets" dans l'UI admin

Cette protection peut être désactivée pour un admin ayant un rôle élevé (super-admin) si pertinent.

### I-4. Logs serveur ne logguent pas l'input full

Si la route logue les requêtes (Sentry, Pino, etc.), `input` **ne doit pas** être loggé en clair. Hash ou tronqué.

### I-5. Test d'intégration scope isolation

Un user dont `role !== "admin"` qui tente `GET /api/admin/runs/recent` avec session valide → 403.

## Critères d'acceptation testables

1. **401 sans cookie** : `curl http://localhost:4102/api/admin/runs/recent` sans `Cookie` → 401.
2. **403 user non-admin** : `curl` avec cookie session user normal → 403.
3. **200 admin** : `curl` avec cookie admin → 200, JSON conforme.
4. **`input` tronqué** : un input de 500 chars → response `input.length === 203` (200 + `…`).
5. **IDs tronqués** : `tenantId.length === 9` (8 + `…`) par défaut.

## Évolutions autorisées

- Ajout d'autres champs admin (latence, cost) tant que pas PII.
- Toggle UI admin pour voir IDs complets si role super-admin.
- Pagination, filtres, recherche sur les runs.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| `HEARST_DEV_AUTH_BYPASS=1` en prod  | Exposition PII totale                   | I-1 cookie obligatoire |
| Logs Sentry capturent `input`       | Leak via service externe                | I-4 ne pas logger    |
| Input contient URL sensible         | Disclosure via list view                | I-2 truncation       |
| Multi-tenant : admin tenant A voit tenant B | Cross-tenant leak               | Scope tenantId requis |

## Tests à écrire

- API : `__tests__/api/admin/runs/recent.test.ts` — 401, 403, 200 cases
- API : `__tests__/api/admin/runs/recent-truncation.test.ts` — input tronqué
- E2E : `tests/e2e/admin-runs-pii.spec.ts` — IDs tronqués en UI

## Notes & historique

- 2026-05-15 — Bug identifié Zone 3 via curl. Endpoint accessible sans cookie en dev-bypass.
- Risque modéré en l'état (dev only), mais à fixer avant prod.
