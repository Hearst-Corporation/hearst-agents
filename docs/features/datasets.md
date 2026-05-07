# Datasets — `datasets`

## Métadonnées
| **id** | `datasets` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P3 |

## Description
Système d'évaluation LLM : des datasets contiennent des paires `(input, expected_output)`.
L'endpoint `/evaluate` exécute un agent sur chaque entrée et compare la sortie réelle à la
sortie attendue par substring match. Les résultats sont tracés via `RunTracer` et persistés
dans la table `evaluations`. Utilisé pour mesurer la précision d'un agent donné.

## Surface publique
- **Route** : `GET /api/datasets` — liste des datasets avec agent lié
- **Route** : `POST /api/datasets` — crée un dataset (name, description?, agent_id?)
- **Route** : `GET /api/datasets/[id]/entries` — max 200 entrées triées par `created_at`
- **Route** : `POST /api/datasets/[id]/entries` — ajoute une entrée
- **Route** : `POST /api/datasets/[id]/evaluate` — lance un batch eval sur un agent
- **Tables DB** : `datasets`, `dataset_entries`, `evaluations`

## Types clés
```ts
// Création dataset
interface CreateDataset {
  name: string;           // 1..200 chars
  description?: string;   // max 2000 chars
  agent_id?: string;      // UUID optionnel — agent par défaut pour ce dataset
}

// Entrée
interface DatasetEntry {
  input: string;            // prompt envoyé à l'agent
  expected_output: string;  // sortie attendue (substring match)
  tags: string[];           // défaut []
}

// Résultat d'une entrée après évaluation
interface EvalEntryResult {
  entry_id: string;
  passed: boolean;   // true si actual.toLowerCase().includes(expected.toLowerCase())
  score: number;     // 1.0 | 0.0
  actual: string;    // tronqué à 200 chars dans la réponse
}

// Réponse POST /evaluate
interface EvaluateResponse {
  run_id: string;
  dataset_id: string;
  agent_id: string;
  total_entries: number;
  passed: number;
  failed: number;
  avg_score: number;  // arrondi à 2 décimales
  results: EvalEntryResult[];
}
```

## Invariants verrouillés

### I-1. Scoring : substring match insensible à la casse uniquement
Le scoring actuel est `actual.toLowerCase().includes(expected.toLowerCase())` → score `1.0`
ou `0.0`. Pas de scoring sémantique, pas de fuzzy match. Tout changement d'algorithme de
scoring nécessite une nouvelle version de spec.

### I-2. Limites : 200 entrées par lecture, 100 par eval batch
`GET entries` : limit 200. `POST evaluate` : limit 100 (premier fetch). Un dataset avec
plus de 100 entrées ne sera évalué que sur les 100 premières (triées par `created_at`).

### I-3. Température 0 obligatoire pour les evals
L'agent est appelé avec `temperature: 0` pour garantir la reproductibilité des évaluations.
Ne pas paramétrer la température via le body de la requête d'évaluation.

### I-4. Traçabilité obligatoire via RunTracer
Chaque evaluation batch crée un run `kind="evaluation"` via `RunTracer`. Chaque appel LLM
est tracé (`kind="llm_call"`). Les résultats sont persistés dans `evaluations` avec le
`run_id`, `dataset_entry_id`, `agent_id`. Ne pas bypasser le tracer.

### I-5. Dataset sans entrée → rejet 400
`POST /evaluate` retourne `err("dataset_empty", 400)` si `entries.length === 0`. L'UI
doit l'indiquer clairement avant de lancer une évaluation.

### I-6. Routes v1 sans authentification scope
`/api/datasets` utilise `requireServerSupabase()` directement, sans `requireScope()`.
Contrairement aux routes v2. Risque de sécurité connu — à corriger avant exposition publique.

## Tests
Existants : aucun test trouvé pour les routes datasets
Manquants :
- `POST /evaluate` : mock LLM provider + mock Supabase, vérification scoring, cas dataset vide
- `POST /entries` : validation Zod (input vide, expected_output vide)
- Scoring : cas passed / failed, avg_score calcul
