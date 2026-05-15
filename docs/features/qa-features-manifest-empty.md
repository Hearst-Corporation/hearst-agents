# QA — `/api/admin/features-manifest` retourne 0 byte — `qa-features-manifest-empty`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-features-manifest-empty`                                                                 |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — endpoint critique du dashboard Agent Driven Dev retourne vide                       |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

L'endpoint `GET /api/admin/features-manifest` retourne **status 200 mais body 0 byte**. Le dashboard `/admin/agent-driven-dev` affiche pourtant 41 features (donc la source existe via lecture directe du fichier `docs/features/_manifest.json` côté server side rendering). Mais l'endpoint API est cassé.

Hypothèse : route handler lit le fichier mais le response stream est mal terminé ou la fonction de read échoue silencieusement.

## Findings source

- **P1-006** (Zone 3) — `curl /api/admin/features-manifest` → 200 + body 0 byte
- Cross-ref : `/admin/agent-driven-dev` affiche 41 features (donc source OK)

## Surface concernée

- [app/api/admin/features-manifest/route.ts](../../app/api/admin/features-manifest/route.ts) — route handler
- [docs/features/_manifest.json](_manifest.json) — fichier source (existe, 41 features)
- [scripts/build-features-manifest.mjs](../../scripts/build-features-manifest.mjs) — générateur manifest

## Invariants verrouillés

### I-1. Endpoint retourne JSON non vide

`GET /api/admin/features-manifest` **doit** retourner :
- status 200
- body JSON valide
- shape : `{ generatedAt: string, total: number, counts: {...}, totals: {...}, features: [...] }`
- minimum 1 byte (typiquement >> 10 KB pour 41 features)

### I-2. Source = `docs/features/_manifest.json` regéneré

Le manifest source `docs/features/_manifest.json` **doit** être à jour, généré par `npm run features:manifest`.

Le pre-commit hook (`package.json` ligne `pre-commit`) s'assure que le manifest est régénéré et stagé à chaque commit qui touche `docs/features/*.md`.

### I-3. Read file robuste

Le route handler **doit** :
- lire le fichier via `fs.readFile()` ou équivalent async
- catch les erreurs (file not found, permission denied) → retourner 500 explicite, pas un body vide silencieux
- log côté serveur pour audit

### I-4. Cache éventuel

Si caching activé (ETag, Cache-Control), s'assurer qu'il n'y a pas de cache vide persistant.

### I-5. Auth admin

Endpoint sous `/api/admin/*` → requiert role admin (cf spec `qa-admin-runs-pii` I-1).

## Critères d'acceptation testables

1. **Body non vide** : `curl http://localhost:4102/api/admin/features-manifest` → `Content-Length > 1000`.
2. **JSON parsable** : `curl ... | jq '.total'` → integer ≥ 1.
3. **Shape** : `body.features` est un array, chaque entry a `id`, `statut`, `path`.
4. **Cohérent avec UI** : `body.total === document.querySelectorAll('[data-feature-card]').length` (sur `/admin/agent-driven-dev`).
5. **500 si fichier absent** : si `docs/features/_manifest.json` supprimé, endpoint retourne 500 avec message clair (pas 200 vide).

## Évolutions autorisées

- Ajout de filtres query (`?statut=verrouillé`, `?priorité=P0`).
- Cache server-side avec invalidation.
- Pagination si nombre de features explose.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Manifest pas regéneré après ajout   | Drift UI vs API                         | Pre-commit hook      |
| Path relatif cassé en prod          | File not found silencieux               | I-3 catch + log      |
| Permission denied                   | 0 byte silencieux                       | I-3 catch + log 500  |

## Tests à écrire

- API : `__tests__/api/admin/features-manifest.test.ts` — happy path + error cases
- E2E : `tests/e2e/admin-add-dashboard.spec.ts` — total UI = total API

## Notes & historique

- 2026-05-15 — Bug identifié Zone 3 par curl direct. UI fonctionne (probable lecture directe du fichier en SSR), mais API cassée.
- Régénération manifest : `npm run features:manifest`.
