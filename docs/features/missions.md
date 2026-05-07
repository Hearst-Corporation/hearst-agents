# Missions — `missions`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `missions` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-04 |
| **version spec** | 1.0 |
| **niveau** | **P1** — distributed lease Redis/Supabase critique : régression = double-exécution ou silence total |

## Description

Agents IA autonomes multi-étapes avec scheduling cron, pause/resume, approval flow, persistance distribuée (anti-double-exécution sur multi-instance), export job auto post-run, mémoire long-terme par mission (résumé + messages + retrieval + KG snippet) et builder visuel (Cytoscape graph). Une mission = un prompt récurrent (`"Tous les matins à 9h, résume mes emails et envoie sur Slack"`) qui s'exécute via l'orchestrator (cf [chat.md](chat.md)) et persiste son contexte d'une exécution à l'autre.

Le cœur de la feature est le **scheduler** : un singleton boot (`instrumentation.ts`) qui démarre une boucle de polling 60s sur l'instance leader (élue par lease Supabase). Quatre garde-fous empêchent la double-exécution : leader lease → minute dedup → in-process lease → distributed lease per-mission-per-minute.

## Surface publique

### Pages utilisateur
- [app/(user)/missions/page.tsx](../../app/(user)/missions/page.tsx) — dashboard CRUD missions, polling ops 5s, drawer MissionEditor
- [app/(user)/missions/[id]/page.tsx](../../app/(user)/missions/[id]/page.tsx) — deep-link resolver (set focal + redirect `/`)
- [app/(user)/missions/builder/page.tsx](../../app/(user)/missions/builder/page.tsx) — workflow visual builder C3 (Cytoscape, 3-col palette + canvas + inspector)

### Composants
- [MissionEditor.tsx](../../app/(user)/components/MissionEditor.tsx) — form drawer (name, prompt, frequency dropdown → cron, enabled)
- [MissionStepGraph.tsx](../../app/(user)/components/MissionStepGraph.tsx) — timeline verticale step-by-step (legacy plan B1)
- [missions/MissionRow.tsx](../../app/(user)/components/missions/MissionRow.tsx) — row stateless avec status badge color-coded + actions
- [mission/MissionConversation.tsx](../../app/(user)/components/mission/MissionConversation.tsx) — affichage `mission_messages` long-terme
- [missions/builder/](../../app/(user)/components/missions/builder/) — `BuilderToolbar`, `NodePalette`, `WorkflowCanvas` (Cytoscape), `NodeConfigPanel`
- [stages/MissionStage.tsx](../../app/(user)/components/stages/MissionStage.tsx) — stage avec actions run/pause/toggle/delete + cadence editor inline + history runs (cf [stage.md](stage.md))

### Endpoints API (`app/api/v2/missions/`)

| Méthode + Route | Auth | Rôle |
|-----------------|------|------|
| `POST /api/v2/missions` | `requireScope` | Create — body `{ name?, input, schedule, enabled?, workflowGraph? }` → `createScheduledMission()` + dedupe + persist |
| `GET /api/v2/missions` | `requireScope` | List scoped — `getScheduledMissions()` |
| `PATCH /api/v2/missions` | `requireScope` | Bulk toggle `{ id, enabled }` |
| `PATCH /api/v2/missions/[id]` | `requireScope` + ownership | Update `{ name?, prompt?, frequency?, customCron?, enabled? }` |
| `DELETE /api/v2/missions/[id]` | `requireScope` + ownership | **Hard-delete** (pas soft) |
| `POST /api/v2/missions/[id]/run` | `requireScope` + ownership | Run now — branch C3 (executeWorkflow) ou legacy (orchestrate stream) — **`maxDuration = 120s`** |
| `POST /api/v2/missions/[id]/pause` | `requireScope` + ownership | enabled=false runtime + persist |
| `POST /api/v2/missions/[id]/resume` | `requireScope` + ownership | enabled=true runtime + persist |
| `POST /api/v2/missions/[id]/approve-step` | `requireScope` | Resume plan B1 (planner store) |
| `GET /api/v2/missions/[id]/context` | `requireScope` | Mission memory assemblée (summary + messages + retrieval + KG) |
| `GET /api/v2/missions/[id]/messages` | `requireScope` | List `mission_messages` (`?limit=50&before=<iso>`) |
| `POST /api/v2/missions/[id]/messages` | `requireScope` | Append message (role `user` ou `system`) |
| `GET /api/v2/missions/ops` | `requireScope` | Fusion persistant + in-memory (status running prend priorité) |

## Architecture interne

### Stratification du runtime

```
┌─────────────────────────────────────────────────────────┐
│  scheduler-init.ts  (instrumentation boot, singleton)    │
│  ├─ ensureSchedulerStarted()                             │
│  ├─ heartbeat 30s : renew leader lease ou try acquire   │
│  └─ chaque 10 heartbeats : cleanup leak leases         │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  scheduler.ts  (tick toutes les 60s, leader only)        │
│  Pour chaque mission enabled :                            │
│  ├─ shouldRunNow(mission) — cron vs UTC now             │
│  ├─ Guard 1: triggeredThisMinute Set (in-process)       │
│  ├─ Guard 2: isMissionRunning() (in-process lease)      │
│  ├─ Guard 3: tryAcquireMissionLease() (distributed)     │
│  ├─ trigger() — wraps orchestrate() avec missionContext │
│  ├─ on success : update lastRun + webhook + auto-export│
│  ├─ on error : normalize → blocked|failed + webhook    │
│  └─ finally : releaseMissionLease()                      │
└─────────────────────────────────────────────────────────┘
```

### Tables Supabase

#### `scheduler_leases` (migration `0016`)
```sql
CREATE TABLE scheduler_leases (
  key          text PRIMARY KEY,
  instance_id  text NOT NULL,
  acquired_at  timestamptz DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  metadata     jsonb DEFAULT '{}'
);
```

Deux types de clés cohabitent dans cette même table :
- `"scheduler_leader"` (élection leader scheduler, **TTL 90s**, heartbeat 30s)
- `"mission_run:<missionId>:<windowKey>"` (lock per-mission-per-minute, **TTL 300s**) — `windowKey = "<YYYY-MM-DDTHH:MM>"` UTC

RLS : service_role only (jamais d'accès direct user).

#### `mission_messages` (migration `0056`)
```sql
CREATE TABLE mission_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  tenant_id   text,
  role        text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     text NOT NULL,
  run_id      uuid,
  created_at  timestamptz DEFAULT now(),
  metadata    jsonb DEFAULT '{}'
);

CREATE INDEX idx_mission_messages_mission_created
  ON mission_messages (mission_id, created_at DESC);
CREATE INDEX idx_mission_messages_user_mission
  ON mission_messages (user_id, mission_id);
```

**Append-only**. Pas d'UPDATE ni DELETE (sauf cascade depuis missions). Fournit la mémoire long-terme.

#### `missions` (table existante, étendue)

Champs JSONB `actions` :
- `contextSummary: string | null` — résumé Haiku post-run (fait par `updateMissionContextSummary()`)
- `contextSummaryUpdatedAt: string | null`

Champs top-level :
- `lastRunStatus`: `success | failed | blocked | null`
- `lastError`: text
- `workflowGraph`: JSONB (optionnel, branch C3)

### Distributed lease (`distributed-lease.ts`)

- **TTL** : 300s (5 min, généreux pour missions longues)
- **Stratégie** :
  1. INSERT `scheduler_leases (key, instance_id, expires_at)` → si succès, on a gagné
  2. Si conflict : UPDATE `WHERE key=K AND expires_at < now()` → si succès, on a volé un lock expiré
  3. Vérifier `instance_id` retourné == nous
- **Fail-open** : toute erreur DB → retourne `true` (autorise l'exécution sur fault d'infra). Choix conscient (mieux ne rien manquer que se bloquer)
- **Release** : `DELETE WHERE key=K AND instance_id=us` (idempotent)
- **Race scenarios** : si l'instance crash avant release, la lease expire en ≤ 5 min puis next tick acquire → max 5 min sans exécution, recovery automatique

### Leader lease (`leader-lease.ts`)

- **Key** : `"scheduler_leader"`
- **TTL** : 90s, heartbeat 30s (3 beats avant expiry)
- **Atomic upsert** :
  ```sql
  INSERT INTO scheduler_leases ... ON CONFLICT (key)
    DO UPDATE SET ... WHERE instance_id = me OR expires_at < now()
  ```
- **Fallback** : si Supabase down, mode `local_fallback` (assume leader, skip distributed leases) — dev only

### Cron parser (minimal)

Format supporté : `"minute hour * * dow"` (5 champs séparés par espaces).

Exemples valides :
- `"0 9 * * *"` — daily 09:00 UTC
- `"0 9 * * 1"` — Mondays 09:00 UTC
- `"0 9 1 * *"` — 1er du mois 09:00 UTC

**NON supporté** : `*/N` intervals, ranges (1-5), lists (1,3,5). `parseInt` strict sur chaque champ.

### Window key & dedup

Format : `<missionId>:<YYYY-MM-DDTHH:MM>` UTC. Ce bucket par-minute permet :
- Une seule exécution par mission par minute UTC, cross-instance
- Si mission redue dans la même minute (cron `* * * * *` ou re-trigger manuel), le lock est déjà tenu

### Orchestration `/run` (branch dual)

```
[POST /api/v2/missions/[id]/run]
   ↓ requireScope() + ownership check
[Resolve mission (memory first, then Supabase)]
   ↓
   ├─ workflowGraph présent ?
   │   ├─ OUI → executeWorkflow(graph, context, handlers, opts)
   │   │        Sync, collect events, return { status, visitedCount, outputs }
   │   │
   │   └─ NON → orchestrate(db, { userId, message: input, missionId,
   │                             missionContext, tenantId, workspaceId })
   │            Stream SSE, drain, extract runId + final assistant text
   │            Fire-and-forget :
   │            ├─ appendMissionMessage (user intent + assistant reply)
   │            ├─ updateMissionContextSummary (Haiku archive)
   │            └─ fireAndForgetIngestTurn (KG global)
   ↓
[Update lastRun (memory + Supabase)]
[Webhook fire-and-forget : "mission.completed" | "mission.failed"]
[Auto-export job si mission.autoExport.enabled]
```

### Mission context (long-terme)

`getMissionContext()` assemble 4 composantes (toutes fail-soft) :
1. **Summary** : `missions.actions.contextSummary` (résumé Haiku 4 sections, 250 mots max — `updateMissionContextSummary()`)
2. **Recent messages** : 10 derniers via `listMissionMessages()` (ordre chronologique ASC)
3. **Retrieval** : pgvector search scoped par `mission_id` sur `embeddings`
4. **KG snippet** : `getKgContextForUser()` — KG global utilisateur

### Auto-export config (`AutoExportConfig` zod)

```ts
{
  enabled: boolean;
  format: "pdf" | "excel";
  recipients: string[]; // emails
  reportId: string; // UUID
}
```

Job appelé **après run réussi** uniquement. Charge `ReportSpec` depuis l'asset, run export, notify recipients. Email errors = best-effort (ne fail pas le job).

### Status normalization (`normalize-result.ts`)

| Status | Trigger | UX signal |
|--------|---------|-----------|
| `success` | `runId` retourné, pas d'erreur | OK |
| `blocked` | Erreur match `BLOCKED_PATTERNS` (`capability_blocked`, `not_connected`, `missing_scope`, `provider`, etc.) | User doit agir (reconnecter, scope, etc.) |
| `failed` | Autres erreurs (technique, timeout, etc.) | Possiblement transient |

### Stores in-memory (single-instance)

- `store.ts` : `Map<missionId, ScheduledMission>` — fast path scheduler tick (rebuild from Supabase si vide)
- `lease.ts` : `Map<missionId, timestamp>` — `isMissionRunning()` overlap guard in-process
- `ops-store.ts` : `Map<missionId, OpsEntry>` — état runtime `running | success | failed | blocked` + `runningSince` (consommé par `/ops`)

### Variables d'env critiques

| Var | Required | Notes |
|-----|----------|-------|
| `INSTANCE_ID` | recommandé en prod | Identité instance pour leases. Fallback : `HOSTNAME` puis random |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Lease + missions tables |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role pour lease ops |

## Data flow

### Scheduled run (cron tick)

```
[scheduler-init.ts at boot]
   ↓ ensureSchedulerStarted()
   ↓ tryAcquireSchedulerLeadership() — TTL 90s
[scheduler.ts tick toutes les 60s, si leader]
   ↓ pour chaque enabled mission
   ↓ shouldRunNow(mission) — cron vs UTC
   ↓ Guard 1 : triggeredThisMinute Set
   ↓ Guard 2 : isMissionRunning() in-process
   ↓ Guard 3 : tryAcquireMissionLease(key, TTL 300s)
   ↓ trigger() → orchestrate stream
   ↓ extract runId + final text
   ↓ appendMissionMessage (memory)
   ↓ updateMissionContextSummary (Haiku, fire-and-forget)
   ↓ updateMissionLastRun (memory + Supabase)
   ↓ webhook fire-and-forget
   ↓ auto-export job si enabled
   ↓ finally : releaseMissionLease()
```

### Manual run (`POST /run`)

Cf section "Orchestration `/run`" plus haut. **Pas de lock distribué** appliqué (l'utilisateur a explicitement demandé) — mais l'in-process lease (`isMissionRunning`) bloque les double-clics.

### Mission memory append (chaque run)

```
[run termine avec assistantText]
   ↓ fire-and-forget appendMissionMessage(role: "user", content: input)
   ↓ fire-and-forget appendMissionMessage(role: "assistant", content: assistantText, runId)
   ↓ fire-and-forget updateMissionContextSummary
       ├─ Charge previousSummary
       ├─ Prompt Claude Haiku : "4 sections (Objectif, État, Décisions, Prochaine étape), 250 mots max"
       ├─ Re-écrit summary (pas append) basé sur previousSummary + runResult
       └─ persiste missions.actions.contextSummary + contextSummaryUpdatedAt
```

## Invariants verrouillés

Toute modification d'un point ci-dessous **exige une mise à jour de cette spec validée par Adrien**.

### I-1. Schéma `scheduler_leases` figé

Colonnes : `key text PK`, `instance_id text NOT NULL`, `acquired_at timestamptz`, `expires_at timestamptz NOT NULL`, `metadata jsonb`.

Toute modification (rename, drop, add NOT NULL) = update spec + migration. Pas de bypass de la PK `key` (la garantie d'unicité du lock en dépend).

### I-2. Format des clés de lease

Deux types **uniquement** :
- `"scheduler_leader"` — un seul row pour l'élection leader
- `"mission_run:<missionId>:<YYYY-MM-DDTHH:MM>"` — un row par mission par minute UTC

Ajouter un type de clé = update spec. Le suffixe `windowKey` reste UTC ISO-8601 minute-precision.

### I-3. TTL leases figés

- Leader lease : **90s** (heartbeat 30s = 3 beats grace)
- Mission run lease : **300s** (5 min)

Toute modification = update spec. Si TTL leader > 90s, recovery après crash devient lent. Si TTL mission < 300s, missions longues (browser, video gen) peuvent voir leur lock expiré pendant qu'elles tournent → double-exécution possible.

### I-4. 4 guards anti-double-exécution dans l'ordre

`scheduler.ts` tick **doit** appliquer dans cet ordre :
1. `await isLeader()` (leader lease)
2. `triggeredThisMinute.has(missionId)` (in-process minute dedup)
3. `isMissionRunning(missionId)` (in-process lease)
4. `await tryAcquireMissionLease(...)` (distributed lease)

Retirer un guard = update spec. Inverser l'ordre = update spec (les guards in-process sont moins coûteux).

### I-5. Fail-open sur DB error pour les leases

`tryAcquireMissionLease()` retourne `true` (autorise) sur **toute erreur DB**. Choix conscient : mieux risquer une double-exécution une fois que se bloquer indéfiniment.

Toute migration vers fail-close = update spec + plan de rollback (les missions se bloqueraient si Supabase ralentit).

### I-6. Cron parser minimal — format figé

Supporté : `"minute hour day month dow"` avec valeurs entières strictes ou `*`.

**Pas** de `*/N`, ranges, lists. Si on doit supporter (ex: `*/15 * * * *`), update spec + tester contre tous les cas existants.

Fréquences UI mappées :
- `daily` → `"0 9 * * *"`
- `weekly` → `"0 9 * * 1"`
- `monthly` → `"0 9 1 * *"`

### I-7. Scheduler tick = 60s

Boucle toutes les 60s. Sub-minute precision **non supportée** (acceptable pour cron-based missions).

### I-8. `mission_messages` append-only

Pas d'UPDATE ni DELETE (sauf cascade depuis `missions ON DELETE CASCADE`). C'est la source de vérité historique. Refacto en update = update spec + plan de migration historique.

### I-9. Hard-delete sur `DELETE /missions/[id]`

Pas de soft-delete (pas de colonne `deleted_at`). La row est supprimée + les `mission_messages` cascadent.

Si tu introduis du soft-delete = update spec + plan de filtrage des `getScheduledMissions()`.

### I-10. `POST /run` `maxDuration = 120s`

Le streaming `orchestrate()` côté `/run` est cap à 120s. Au-delà, Vercel/Edge tue le handler.

Pour des missions plus longues (research, browser, video) : `maxDuration` du `orchestrate` reste 300s (cf [chat.md](chat.md) I-1), mais l'appel via `/run` reste 120s. La différence : `/run` retourne dès que `runId` est obtenu (l'orchestrate continue async).

### I-11. Status normalization `success | failed | blocked`

3 valeurs **uniquement**. `blocked` est distinct de `failed` car UX différente (action user vs réessayer).

`BLOCKED_PATTERNS` peut être étendu (ajout de patterns) mais retirer un pattern = update spec.

### I-12. Mission context = 4 composantes fail-soft

`getMissionContext()` doit toujours essayer d'assembler : summary + 10 messages + retrieval + KG snippet. Toute composante peut échouer sans casser le tout.

Retirer une composante = update spec. Ajouter une composante = OK si fail-soft.

### I-13. `updateMissionContextSummary` via Claude Haiku, format 4 sections

Modèle : Claude Haiku 4.5 (cohérent avec [chat I-6](chat.md) qui est Sonnet pour orchestrator — Haiku pour résumés moins coûteux).

Format imposé : 4 sections (Objectif, État actuel, Décisions actées, Prochaine étape), 250 mots max. Re-écriture totale (pas append).

### I-14. Auto-export config : Zod validated, format `pdf | excel`

Schéma figé. Format `pdf` (via pdfkit) ou `excel` (via exceljs). Pas d'autres formats sans update spec.

Email errors = best-effort, ne fail pas le job.

### I-15. Webhooks `mission.completed` / `mission.failed`

Émis fire-and-forget après chaque run. Pas de retry (c'est le rôle du dispatcher de webhooks downstream).

Ajouter un event = OK. Retirer = update spec.

### I-16. `/run` distingue branch `workflowGraph` (C3) vs branch legacy (orchestrate)

Si `mission.workflowGraph` est présent → `executeWorkflow()` synchrone.
Sinon → `orchestrate()` SSE stream.

Inverser ou unifier = update spec + plan de migration des missions C3 existantes.

### I-17. Ownership check sur les routes par-`[id]`

`PATCH /missions/[id]`, `DELETE`, `/run`, `/pause`, `/resume`, `/approve-step`, `/messages` → vérifient que `mission.userId === scope.userId`. Toute exception = update spec (multi-user collaboratif sur missions n'est pas dans le périmètre actuel).

### I-18. Mission ID = UUID v4 (`randomUUID()`)

Pas d'ID séquentiel, pas de slug. Toute migration vers ID lisible = update spec + plan ré-encodage des `mission_id` dans messages, runs, contextes.

## Évolutions autorisées sans spec

- Ajout d'un `BLOCKED_PATTERN` à `normalize-result.ts`
- Ajout d'un type de webhook (en plus de `mission.completed` / `failed`)
- Ajout d'un champ optionnel à `AutoExportConfig` (rétrocompatible)
- Polish UI sur n'importe quel composant
- Nouveau type de node dans `NodePalette` du builder (à condition que `executor.ts` le supporte)
- Refactor interne tant que les exports publics restent stables
- Ajout de tests
- Ajout d'un index Supabase pour perf
- Ajout d'un cron de cleanup distinct (en plus de `cleanup-leases.ts`)
- Migration `getMissionContext()` vers nouveau retrieval engine tant que l'output reste compatible

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| 2 instances ticking simultanément (race leader lease) | Double exécution mission | Atomic upsert + heartbeat 30s ; pire cas race ~30s window |
| Mission tient son lock 5 min, ne libère jamais (crash) | Délai de 5 min avant re-exécution | Acceptable. `cleanup-leases.ts` toutes les ~5 min purge les leaks |
| Clock skew entre instances et Supabase | Lock considéré expiré tôt ou tard | NTP sync assumé prod. TTL 300s absorbe minor skew |
| Cron parser ne supporte pas `*/15 * * * *` | Mission ne s'exécute jamais | Validation côté UI à ajouter (gap actuel) |
| `mission_messages` table grossit linéairement | Coût Supabase + perf | Pas de cleanup automatique. À surveiller (TTL ou archive si >1M rows) |
| `updateMissionContextSummary` Haiku quota dépassé | Summary stale | Fire-and-forget : run réussit, summary obsolète. Acceptable |
| Auto-export quota email Resend dépassé | Recipients ne reçoivent pas | Best-effort, log warn ; pas de retry |
| `executeWorkflow` C3 boucle infinie | Run jamais termine | TTL distributed lease 5 min coupe au pire ; abort signal recommandé |
| Orchestrator change `runId` format | `updateMissionLastRun` corrompt | Tests `__tests__/orchestrator/sse-contract.test.ts` couvrent partiellement |
| `BLOCKED_PATTERNS` retire un pattern par erreur | Erreurs auth deviennent `failed` (UX dégradée) | Code review + test de régression nécessaire |
| Hard-delete cascade sur `mission_messages` perd l'historique | Pas de récupération possible | Acceptable (UX explicite "supprimer" via ConfirmModal) |
| `instrumentation.ts` boot timing race | Scheduler démarre avant que les routes soient prêtes | `globalThis.__hearst_scheduler_started__` guard |
| Ownership bypass sur `/messages` | Lecture cross-user | `requireScope` + check `mission.userId === scope.userId` |

## Tests

### Existants
- [`__tests__/engine/distributed-lease.test.ts`](../../__tests__/engine/distributed-lease.test.ts) — acquire/release, fail-open, race scenarios
- [`__tests__/engine/leader-lease.test.ts`](../../__tests__/engine/leader-lease.test.ts) — election, heartbeat renewal
- [`__tests__/engine/scheduler.test.ts`](../../__tests__/engine/scheduler.test.ts) — tick, guards, cron parser
- [`__tests__/engine/cleanup-leases.test.ts`](../../__tests__/engine/cleanup-leases.test.ts) — leak cleanup
- [`__tests__/engine/normalize-result.test.ts`](../../__tests__/engine/normalize-result.test.ts) — blocked vs failed patterns
- [`__tests__/engine/export-job.test.ts`](../../__tests__/engine/export-job.test.ts) — auto-export flow
- [`__tests__/engine/scheduled-mission-auto-export.test.ts`](../../__tests__/engine/scheduled-mission-auto-export.test.ts) — E2E run + auto-export
- [`__tests__/missions-messages.test.ts`](../../__tests__/missions-messages.test.ts) — append/list mission_messages
- [`__tests__/runtime-fixes.test.ts`](../../__tests__/runtime-fixes.test.ts) — runtime store interactions

### Manquants (gap moyen)

**Scheduler resilience** :
- Test E2E : 2 instances, leader élu, leader crash, second prend le relais en ≤ 90s
- Test : 100 missions, scheduler tick en < 60s
- Test : cron parser rejette format invalide proprement (pas de NaN silencieux)

**Distributed lease edge cases** :
- Test : DB lent (latence 5s), fail-open après timeout
- Test : clock skew DB vs instance

**Mission context** :
- Test `getMissionContext` quand summary absent → assemblage partiel
- Test `updateMissionContextSummary` Haiku failure → log + skip
- Test KG snippet absent → pas de crash

**API routes** :
- Test ownership : user B essaie `/run` mission de user A → 403
- Test bulk delete cascade `mission_messages`
- Test rate limit `/run` (à ajouter ?)

**Workflow C3** :
- Test `executeWorkflow` cycle infini → break par max iterations
- Test approval node : pause + resume preserve graph state
- Test event emission ordre cohérent

**Auto-export** :
- Test format pdf vs excel
- Test recipients vide → skip mais run success
- Test email Resend quota → log warn

**UI** :
- Test MissionEditor frequency mapping (daily → "0 9 * * *")
- Test polling 5s de `/ops` pas de memory leak
- Test ConfirmModal delete trigger DELETE + cascade

**Cron parsing** :
- Test rejette `*/15` proprement avec error message clair (gap actuel : silently no-runs)

## Code orphelin (code-ready non câblé)

- `approve-step` planner store : actuellement in-memory, perte sur redéploiement → Phase 2 prévue (planner store Supabase). En l'état, l'endpoint répond `404` si plan non trouvé.
- `BuilderToolbar` "Publish" : flow vers marketplace existant mais peu testé
- Mission templates dropdown : `WORKFLOW_TEMPLATES` chargés dynamiquement, pré-câblé pour le builder

## Notes & historique

- **Migration `0016`** — `scheduler_leases` table (locks distribués)
- **Migration `0056`** — `mission_messages` (memory long-terme)
- **Phase B1** — planner multi-step + approval flow (`/approve-step`). Devenu chemin secondaire post-pivot streamText.
- **Phase C3** — workflow visual builder Cytoscape, branch dual `/run` (workflowGraph vs orchestrate)
- **Auto-export** — feature ajoutée pour rapports recurrents (PDF/Excel email post-run)
- **Mission memory** — vague 8 : context summary Haiku post-run, retrieval mission-scoped, KG snippet
- **Fail-open lease** — choix conscient après incident où Supabase down a bloqué tous les schedulers ; mieux double-exécuter une fois que rien
- **TTL 5 min mission lease** — choisi pour absorber missions browser/video longues sans risque de re-trigger pendant qu'elles tournent
- **Cron parser minimal** — délibérément simple, pas de dépendance externe ; `*/N` à ajouter quand cas concret demandé
- **Hard-delete** — choix UX (confirmation explicite) ; le cascade sur `mission_messages` est le coût assumé
