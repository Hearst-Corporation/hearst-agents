# Simulation — `simulation`

## Métadonnées
| **id** | `simulation` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description
Stage 5 (Chambre de Simulation) : l'utilisateur soumet un scénario business + variables clés,
DeepSeek R1 (`deepseek-reasoner`) génère 3-5 scénarios chiffrés contrastés. Le résultat est
persisté comme asset `kind=report` et affiché sous forme de `ScenarioCard`.

## Surface publique
- **Route** : `POST /api/v2/simulations/start` (`maxDuration=60`)
- **Route** : `GET /api/v2/simulations/history`
- **Route** : `GET /api/v2/simulations/[id]`
- **Worker** : `lib/jobs/workers/simulation.ts` (handler kind=`simulation`, `startSimulationWorker()`)
- **Stage** : `app/(user)/components/stages/SimulationStage.tsx`
- **Schémas** : `lib/simulations/schemas.ts` (`simulationOutputSchema`, `SimulationOutput`)

## Types clés
```ts
// lib/simulations/schemas.ts
interface Scenario {
  name: string;           // max 80 chars
  narrative: string;      // 10-2000 chars
  metrics: Record<string, string | number>; // 2-5 KPIs
  risks: string[];        // max 10, max 200 chars chacun
  probability: number;    // 0..1, somme ≈ 1.0 (±0.1)
}

interface SimulationOutput {
  scenarios: Scenario[]; // 1..10 (MVP : 3-5)
  summary?: string;      // max 800 chars
}

// Réponse de /api/v2/simulations/start
interface SimulationResponse {
  scenarios: Scenario[];
  reasoning: string | null; // chain-of-thought DeepSeek R1
  assetId: string;
}
```

## Invariants verrouillés

### I-1. Modèle fixé : DeepSeek R1 uniquement
Le MVP utilise exclusivement `deepseek-reasoner` via `deepseekChat()`. Phase B (E2B + Exa)
n'est pas implémentée. Ne pas substituer par un autre modèle sans update spec.

### I-2. Appel synchrone dans la route (pas de queue worker)
`POST /api/v2/simulations/start` appelle DeepSeek directement (30-50s). `maxDuration=60`.
Le worker `simulation.ts` existe en parallèle pour un futur mode async avec `simulation_runs`,
mais la route route actuelle ne l'utilise pas — elle est synchrone.

### I-3. Asset systématiquement persisté
Chaque simulation crée un asset `kind=report` (markdown complet) via `storeAsset()`. L'`assetId`
est retourné au client. La fermeture du Stage ne doit pas perdre les résultats.

### I-4. Validation Zod obligatoire
Le JSON DeepSeek est validé par `simulationOutputSchema`. En cas d'échec Zod, le raw output
est préservé dans `reasoning` pour debug. Pas de relaxation du schéma silencieuse.

### I-5. Auto-run depuis payload Stage
Si `stagePayload.mode === "simulation"` et `stagePayload.scenario` est défini, la simulation
se lance automatiquement au mount (via `launchSimulation(scenarioOverride)`). Le ref `autoRanRef`
empêche la double-exécution en React Strict Mode.

### I-6. Variables clés filtrées avant envoi
Les entrées avec `key === ""` sont filtrées côté client avant le POST. Le serveur accepte un
tableau vide (`[]`) et génère un bloc `(aucune variable spécifiée)`.

### I-7. Réponses obligatoirement en français
Le prompt force `STRICTEMENT en français pour TOUS les champs`. Les clés metrics, narratives
et risques doivent être en FR. Ne pas retirer cette directive.

## Tests
Existants : aucun test unitaire trouvé dans `lib/simulations/`
Manquants :
- Validation Zod : cas happy path + cas dégradé (JSON invalide, probability hors plage)
- Worker `processSimulation` : mock DeepSeek + vérification persistance asset
- Route `/start` : test integration avec mock DeepSeek (timeout 60s)
