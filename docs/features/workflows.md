# Workflows — `workflows`

## Métadonnées
| **id** | `workflows` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description
Système de graphes d'automatisation DAG (WorkflowGraph). Un graphe est constitué de nodes
typés (trigger, tool_call, condition, approval, output, transform) reliés par des edges
gardées. L'executor BFS est stateless — l'état est porté par le `WorkflowExecutionContext`
passé par le caller. Les graphes sont persistés en JSONB dans `missions.actions.workflowGraph`
(pas de table dédiée). Deux verticaux disponibles : hospitality (2 templates code-as-data).

## Surface publique
- **Route v1** : `GET/POST /api/workflows` (table `workflows` + `workflow_steps`)
- **Route v1** : `GET /api/workflows/templates?vertical=hospitality`
- **Route v2** : `POST /api/v2/workflows/preview` (dry-run synchrone, `maxDuration=60`)
- **Route v2** : `POST /api/v2/workflows/[runId]/approve-node` (audit-only MVP)
- **Executor** : `lib/workflows/executor.ts` (`executeWorkflow()`)
- **Validator** : `lib/workflows/validate.ts` (`validateGraph()`)
- **Handlers** : `lib/workflows/handlers/index.ts` (`executeWorkflowTool()`, `WORKFLOW_HANDLERS`)
- **Types** : `lib/workflows/types.ts`
- **Templates** : `lib/workflows/templates/hospitality/*`

## Types clés
```ts
type WorkflowNodeKind = "trigger" | "tool_call" | "condition" | "approval" | "output" | "transform";
type WorkflowOnError = "abort" | "skip" | "retry";  // default "abort"

interface WorkflowNode {
  id: string; kind: WorkflowNodeKind; label: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
  onError?: WorkflowOnError;
}

interface WorkflowGraph {
  nodes: WorkflowNode[]; edges: WorkflowEdge[];
  startNodeId: string; version?: number;
}

// Handlers disponibles dans WORKFLOW_HANDLERS
type HandlerKey =
  | "pms_list_arrivals_today"
  | "pms_update_request_status"
  | "ai_draft_welcome_notes"
  | "ai_classify_priority"
  | "slack_send_message";
```

## Invariants verrouillés

### I-1. Executor stateless — état transmis par le caller
`executeWorkflow()` ne persiste rien en base. L'état courant (`outputs: Map<string, unknown>`)
vit dans le `WorkflowExecutionContext` passé par le caller. Ne pas ajouter de persistance
directe dans l'executor sans créer une couche orchestrateur dédiée.

### I-2. Approval = pause sans resume automatique (MVP)
`POST /api/v2/workflows/[runId]/approve-node` est **audit-only** : il log l'approval mais
ne relance pas le workflow. Le client doit afficher un disclaimer et fournir un bouton
"Relancer". Un vrai resume transparent nécessite une colonne `awaiting_state JSONB` en DB —
pas implémenté. Ne pas prétendre que l'approval relance le run.

### I-3. Cap BFS : 50 nodes max par défaut
`maxNodes = 50` (overridable via `opts.maxNodes`). Au-delà, l'executor s'arrête sans émettre
`workflow_failed` — il retourne `completed` avec les outputs collectés. Ce cap évite les
boucles infinies sur les graphes mal formés.

### I-4. Validation obligatoire avant toute exécution
`validateGraph()` est appelé en tête d'`executeWorkflow()`. Les 5 règles : startNodeId
existant, intégrité edges, pas de cycle accessible, config requise par kind, au moins
un terminal joignable. Un graphe invalide retourne `status: "invalid"`.

### I-5. Templates hospitality code-as-data, non mutables
Les templates de `lib/workflows/templates/hospitality/` sont du code TypeScript, pas des
données DB. Ils ne peuvent pas être modifiés via l'API. Pour étendre : ajouter un fichier
template + l'enregistrer dans la route templates.

### I-6. Doublon v1/v2 routes — coexistence assumée
`/api/workflows` (v1) gère la table `workflows` + `workflow_steps` (CRUD bas niveau).
`/api/v2/workflows/*` gère l'exécution + preview (pas de CRUD table). Les deux coexistent.
Ne pas merger avant que le schéma DB v1 soit déprécié.

### I-7. Évaluateur d'expressions sans `eval`
Les expressions des nodes `condition` et `transform` sont évaluées par `evaluateCondition()`
/ `evaluateValue()` sans eval JS. Opérateurs supportés : `==`, `!=`, `<`, `>`, `<=`, `>=`.
Placeholders `${nodeId.path}` résolus depuis `context.outputs`. Ne pas introduire d'eval.

### I-8. Tool inconnu → échec explicite
Si `executeWorkflowTool()` ne trouve pas le handler, il retourne `{ success: false, error: "tool_not_implemented: <name>" }`.
C'est intentionnel pour que les QA voient les tools manquants. Ne pas retourner de succès
silencieux.

## Tests
Existants : aucun test trouvé dans `lib/workflows/`
Manquants :
- Executor : happy path BFS, cycle détecté, approval pause, cap 50 nodes, preview mode
- Validator : chaque code d'erreur (`missing_start`, `cycle_detected`, `no_terminal`, etc.)
- Handlers : mock PMS + Slack + Claude pour chaque handler
- Route preview : dry-run complet avec graph valide / invalide
