# Planner — `planner`

## Métadonnées
| **id** | `planner` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 (review) |

## Description

Couche d'orchestration multi-step qui transforme une intention utilisateur complexe en plan d'exécution structuré (`ExecutionPlan`). Gated par le flag `HEARST_ENABLE_PLANNER` (défaut `false` prod, `true` dev). Le planner est activé uniquement si `isComplexIntent(message)` retourne `true` — heuristique basée sur la longueur (> 80 chars) et la présence de mots-clés "plan / orchestre / compile / board pack…".

**Différence Plan / Mission / Workflow :**
- `ExecutionPlan` (`lib/engine/planner/types.ts`) — plan d'exécution runtime, in-memory, créé à partir d'une intention chat. Court terme (one_shot) ou récurrent (mission). Invisible à l'UX sauf via `/planner` et les events SSE `plan_*`.
- `Plan` (`lib/engine/runtime/plans/types.ts`) — plan cognitif Supabase, attaché à un `run_id`. Multi-steps avec agents nommés, dépendances, `PlanStore` (Supabase). Produit par `planFromIntent` (orchestrateur LLM Claude). Distinct de `ExecutionPlan`.
- `Mission` (`features/missions.md`) — scheduled mission avec `WorkflowGraph`, persistée Supabase. Peut être créée par clone marketplace ou manuellement via Studio.
- `Workflow` (`features/workflows.md`) — `WorkflowGraph` exécuté étape par étape par le runtime missions.

**Deux stacks "planner" coexistent :**
1. `lib/engine/planner/` — `ExecutionPlan` in-memory, heuristique `isComplexIntent`, activé par `HEARST_ENABLE_PLANNER`. Stack B1.
2. `lib/engine/orchestrator/planner.ts` — `planFromIntent` via Claude tool-calling (`create_plan` / `text_response` / `request_connection`), produit un `Plan` Supabase (`lib/engine/runtime/plans/`). Stack orchestrateur LLM. Toujours actif dans le path chat.

**Plan store — état actuel :**
`lib/engine/planner/store.ts` = **in-memory uniquement** (Map). Conforme à ce qu'indique `features/missions.md` : "Phase 2 = planner store Supabase, currently in-memory". Le store `lib/engine/runtime/plans/store.ts` (PlanStore class) est, lui, Supabase natif — c'est le store des plans cognitifs LLM.

## Surface publique

Routes UI :
- `GET /planner` — liste des plans avec filtres status, polling 5s, bouton "Demander un plan" (→ chat)

API :
- `GET /api/v2/plans` — liste les `ExecutionPlan` in-memory filtrés par scope (tenantId + workspaceId + userId)
- `POST /api/v2/plans/[id]/approve` — approve un plan `awaiting_approval` et reprend l'exécution via `approveAndResume`

Orchestrateur (interne, pas de route dédiée) :
- `planFromIntent(db, engine, message, history, opts)` — produit `PlanningResult` via Claude
- `runPlannerWorkflow(engine, eventBus, input)` — exécute un `ExecutionPlan`, émet SSE `plan_*`
- `isComplexIntent(message)` — heuristique d'activation
- `isPlannerEnabled()` — lecture flag `HEARST_ENABLE_PLANNER`

## Types clés

```ts
// lib/engine/planner/types.ts — stack B1 (in-memory)

export type PlanStatus =
  | "draft" | "ready" | "awaiting_approval" | "executing"
  | "completed" | "failed" | "degraded";

export type PlanStepKind =
  | "read" | "analyze" | "synthesize" | "generate_asset"
  | "deliver" | "schedule" | "monitor" | "wait_for_approval";

export interface ExecutionPlan {
  id: string;
  threadId: string;
  userId: string; tenantId: string; workspaceId: string;
  intent: string;
  type: "one_shot" | "mission" | "monitoring";
  status: PlanStatus;
  steps: ExecutionPlanStep[];
  requiresApproval: boolean;
  approvalStepId?: string;
  createdAt: number; updatedAt: number;
}

// lib/engine/runtime/plans/types.ts — stack LLM (Supabase)

export interface Plan {
  id: string;
  run_id: string;
  reasoning: string;
  status: "active" | "completed" | "abandoned";
  steps: PlanStep[];
  created_at: string;
}

export interface ActionPlan {
  id: string;
  run_id: string;
  plan_id: string | null;
  summary: string;
  status: ActionPlanStatus; // proposed | approved | partially_approved | executing | completed | failed | rejected
  actions: ActionStep[];
  decided_at: string | null;
}
```

## Invariants verrouillés

### I-1. `HEARST_ENABLE_PLANNER` gate le path planner entier
`isPlannerEnabled()` : `true` si var `=true|1`, `false` si `=false|0`, sinon `NODE_ENV === "development"`. En production sans var explicite = désactivé. Le caller (orchestrateur) doit fallback sur `runAiPipeline` si le planner est désactivé ou crash.

### I-2. `isComplexIntent` : seuil 80 chars + keyword
Heuristique volontairement stricte pour limiter les coûts LLM. Ne pas l'abaisser sans mesurer l'impact sur les coûts d'orchestration. Les messages courts (< 80 chars) ne déclenchent jamais le planner, même avec des mots-clés.

### I-3. userId/tenantId viennent du scope auth, jamais du body request
`POST /api/v2/plans/[id]/approve` log un warning si le body contient `userId` ou `tenantId` et les ignore. Ces champs sont résolus exclusivement via `requireScope()` (NextAuth). Invariant de sécurité multi-tenant.

### I-4. Plan store in-memory (`lib/engine/planner/store.ts`) : pas de persistance restart
Les `ExecutionPlan` sont perdus au restart serveur. La page `/planner` se retrouve vide après un redémarrage. C'est accepté MVP. La migration Supabase est Phase 2. Ne pas simuler de persistance côté route (`GET /api/v2/plans` → `getAllPlans()` in-memory).

### I-5. Approbation plan : `approvePlan(planId)` puis `approveAndResume`
L'approval flow (`POST /api/v2/plans/[id]/approve`) exécute deux étapes séquentielles : `approvePlan(planId)` (transition status → approved) puis `approveAndResume(planId, ctx, cb)` (reprise exécution pipeline). Si `approvePlan` retourne `null` (plan introuvable ou pas `awaiting_approval`) → 404. Les deux appels ne doivent pas être inversés.

### I-6. Events SSE plan_* doivent être émis dans l'ordre du cycle de vie
Ordre obligatoire : `plan_attached` → `plan_preview` → n × (`plan_step_started` → `plan_step_completed` | `plan_step_failed` | `plan_step_awaiting_approval`) → `plan_run_complete`. Toute implémentation UI qui consomme ces events s'appuie sur cet ordre.

### I-7. Write actions : draft-first avant exécution (règle non-négociable)
Pour tout step `deliver` / `wait_for_approval` sur une action write (SEND, CREATE, UPDATE, DELETE…), le planner doit présenter un draft à l'utilisateur et obtenir une confirmation explicite avant d'émettre l'action. Cette règle est injectée dans le system prompt dynamique via `buildDynamicSystemSuffix`. Ne pas la supprimer.

### I-8. Isolation multi-tenant stricte sur `GET /api/v2/plans`
`getAllPlans()` retourne tous les plans in-memory, puis filtrage `tenantId + workspaceId + userId`. Ne pas exposer des plans d'un autre tenant même si le store est global. Ce filtrage est la seule barrière d'isolation côté route.

### I-9. `planFromIntent` (LLM) utilise prompt caching sur le system prompt statique
Le `ORCHESTRATOR_SYSTEM_PROMPT` est envoyé avec `cache_control: { type: "ephemeral" }` (TTL 5min). Le bloc dynamique (Composio actions + règle draft-first) est un second bloc système sans cache. Ne pas fusionner les deux blocs — cela invaliderait le cache à chaque user.

### I-10. Deux stacks Plan doivent rester séparées et non-confondues
`ExecutionPlan` (planner B1 in-memory) et `Plan` (orchestrateur LLM Supabase) sont deux entités distinctes avec des types distincts, des stores distincts et des cycles de vie différents. Ne pas tenter de les unifier sans spec dédiée — le risque de régression sur le chat pipeline est élevé.

## Notes

- Le `/planner` page poll toutes les 5s via `usePollingEffect`. En prod avec planner désactivé, l'API retourne `[]` — la page affiche l'état empty sans erreur.
- Coût estimé par step : `analyze`/`synthesize` = 0.01$ ; `generate_asset` = 0.02$ ; autres = 0.005$. Estimation grossière, affinée Phase 2.
- `createPlanFromIntent` (stack B1) est heuristique/règle-based — pas de LLM. `planFromIntent` (stack LLM) utilise Claude avec tool-calling. Distinction importante pour les coûts.

## Tests

Existants : `data-testid` non identifiés sur `/planner`. Filtres status (boutons inline).

Manquants :
- Test `isComplexIntent` : messages < 80 chars → false, messages avec keyword → true
- Test `isPlannerEnabled` : var `=false` → false même en development
- Test `GET /api/v2/plans` : plans d'un autre tenant ne sont pas exposés
- Test approve plan : body avec `userId` → warn log + ignoré
- Test approve plan introuvable → 404
- Test `runPlannerWorkflow` : événements SSE émis dans l'ordre attendu
- Test `planFromIntent` : tool `create_plan` → `Plan` Supabase créé
