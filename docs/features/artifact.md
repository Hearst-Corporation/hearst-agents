# Artifact — `artifact`

## Métadonnées
| **id** | `artifact` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description
Stage code-exec (B8) : éditeur Monaco (CodeEditor) + PreviewPane côte à côte. L'utilisateur
écrit du code Python ou Node, le soumet au sandbox E2B via BullMQ, poll le statut, puis
visualise stdout/stderr/résultats. Chaque run crée un asset `kind=artifact` et un variant
versionné. Supporte le re-run sur un artifact existant avec historique des variants.

## Surface publique
- **Route** : `POST /api/v2/jobs/code-exec` → `{ jobId, assetId, variantId, status: "pending" }`
- **Route** : `GET /api/v2/jobs/[jobId]/status?kind=code-exec`
- **Worker** : `lib/jobs/workers/code-exec.ts` (handler kind=`code-exec`)
- **Provider** : `lib/capabilities/providers/e2b.ts` (`executeCode()`)
- **Stage** : `app/(user)/components/stages/ArtifactStage.tsx`
- **Composants** : `app/(user)/components/artifact/CodeEditor.tsx`, `PreviewPane.tsx`
- **CodeRunner** : `app/(user)/components/CodeRunner.tsx`

## Types clés
```ts
// Runtimes supportés
type Runtime = "python" | "node"; // node → e2b "javascript"

// Body POST /api/v2/jobs/code-exec
interface CodeExecBody {
  code: string;         // max 50 000 chars
  runtime?: Runtime;    // default "python"
  timeoutMs?: number;   // 1000..120000ms
  threadId?: string;
}

// Résultat stocké en JSON dans storage (storageUrl)
interface ExecResult {
  stdout: string;
  stderr: string;
  results: Array<{ type: string; data: unknown }>; // json | image/png | image/jpeg | text
  error?: string | null;
}

// Statut poll
interface JobStatusResponse {
  jobId: string;
  kind: string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";
  progress: number;       // 0..100 (5 → démarrage, 70 → exec terminée, 90 → persist, 100)
  returnvalue?: { storageUrl?: string; metadata?: Record<string, unknown> } | null;
  failedReason?: string | null;
}
```

## Invariants verrouillés

### I-1. E2B requis — 503 si absent
Si `E2B_API_KEY` n'est pas défini côté serveur, `POST /api/v2/jobs/code-exec` retourne 503
immédiatement. Ne pas silencier cette erreur ni implémenter un fallback local non-sandboxé.

### I-2. Polling pattern : 1.5s × 80 max = 2min timeout
`POLL_INTERVAL_MS = 1500`, `POLL_MAX_ATTEMPTS = 80`. Au-delà → "Timeout d'attente du résultat."
Ne pas réduire l'intervalle en dessous de 1s (pression serveur) ni augmenter le max au-delà
de 120 (4min serait aberrant pour un sandbox code).

### I-3. Asset + variant créés à l'enqueue, pas à la completion
L'asset `kind=artifact` et le variant `kind=code, status=pending` sont créés **avant** le
job BullMQ. Le worker met à jour le variant (`ready` ou `failed`) après l'exécution.

### I-4. ExecResult persisté dans storage (JSON), pas en DB
Le résultat complet (stdout, stderr, results[]) est uploadé en JSON via `getGlobalStorage()`.
Le `storageUrl` est retourné dans le `returnvalue` du job. Ne pas persister le contenu en
colonne JSONB directe en DB.

### I-5. Variants versionnés — historique préservé
Chaque run sur un artifact existant crée un nouveau variant. `ArtifactStage` affiche un
sélecteur de version si `variants.length > 1`. Ne pas écraser le variant précédent.

### I-6. Timeout E2B : 30s par défaut (max accepté en body : 120s)
`lib/capabilities/providers/e2b.ts` fixe `timeoutMs ?? 30_000`. Le body schema valide
`1_000..120_000`. Ne pas dépasser 120s côté E2B pour éviter les runaway sandboxes.

### I-7. Credits vérifiés avant enqueue
`requireCreditsForJob()` est appelé avant `enqueueJob()`. Si insuffisant → 402. En cas
d'échec à l'enqueue, un remboursement `settleCredits()` est tenté. Ne pas contourner.

### I-8. Hotkey ⌘Enter
L'exécution se déclenche sur ⌘Enter depuis le `CodeEditor`. Ce binding ne doit pas être
retiré ni remappé sans coordination avec les autres Stage hotkeys.

## Tests
Existants : aucun test unitaire trouvé pour le worker code-exec
Manquants :
- Worker : mock E2B + vérification upload storage + variant update
- Route `/code-exec` : validation body (code vide, runtime invalide, crédit insuffisant)
- Poll : simulation completed / failed / timeout
- E2B provider : mock `Sandbox.create`, résultats types (json, image/png)
