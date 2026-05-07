# Meetings — `meetings`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `meetings` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description

Bot meeting temps réel via Recall.ai (Zoom / Google Meet / Teams). L'utilisateur colle une URL, un bot Recall rejoint le call, transcrit via Deepgram (embarqué côté Recall), et détecte les action items. `MeetingStage` poll toutes les 5s pendant la session. En fin de meeting, le worker `meeting-bot` génère un débrief éditorial via Claude Sonnet 4.6 (4 sections markdown : Contexte / Décisions / Actions / Suivi) et persiste l'asset `kind=event` enrichi. Les action items sélectionnés peuvent être convertis en mission via le Commandeur.

## Surface publique

**Endpoints API**
- `POST /api/v2/meetings/start` — crée le bot Recall.ai synchrone, persiste un asset placeholder `kind=event`, enqueue le worker `meeting-bot`, retourne `{ meetingId, jobId, status, provider, threadId }` avec status 202
- `GET /api/v2/meetings/[id]` — polling status + transcript + actionItems (extraction Haiku avec timeout 8s)
- `DELETE /api/v2/meetings/[id]` — stopBot (leave_call) + deleteBot fire-and-forget
- `POST /api/v2/meetings/webhook` — receveur callback Recall.ai (HMAC sha256, header `x-recall-signature`)

**Composants**
- `app/(user)/components/stages/MeetingStage.tsx` — polling 5s, split transcript (60%) + action items (40%), sélection → Commandeur

**Libs**
- `lib/capabilities/providers/recall-ai.ts` — `createMeetingBot`, `getBotStatus`, `getTranscript`, `stopBot`, `deleteBot`, `verifyWebhookSignature`, `detectMeetingProvider`, `validateMeetingUrl`
- `lib/meetings/debrief.ts` — `generateMeetingDebrief` (Sonnet 4.6, 4 sections, ≤350 mots)
- `lib/meetings/webhook-cache.ts` — cache mémoire LRU 200 entries, pas de persistence
- `lib/jobs/workers/meeting-bot.ts` — worker polling (30s interval, timeout 2h, transcript stable 30s)

## Types clés

```ts
// lib/capabilities/providers/recall-ai.ts
interface CreateMeetingBotParams {
  meetingUrl: string;
  botName?: string;
  recordingMode?: "speaker_view" | "gallery_view";
  language?: string;
  transcriptionProvider?: "deepgram" | "assembly_ai" | "rev";
}

interface BotStatus {
  status: string;          // joining | in_call | done | call_ended | fatal | ended_early | failed
  videoUrl?: string;
  transcript?: string;
  recordingId?: string;
}

interface TranscriptSegment {
  speaker: string | number;
  text: string;
  start: number;
  end: number;
}

// lib/meetings/debrief.ts
interface GenerateMeetingDebriefInput {
  transcript: string;       // capé à 30k chars dans l'implémentation
  actionItems: MeetingActionItem[];
  title?: string;
  participants?: string[];
}

// lib/meetings/webhook-cache.ts
interface RecallWebhookEvent {
  event: string;
  statusCode?: string;
  recordingUrl?: string;
  receivedAt: number;
}
```

## Invariants verrouillés

### I-1. Bot créé synchrone dans /start, worker pour le suivi long
`createMeetingBot` est attendu (await) dans `POST /api/v2/meetings/start` — le `botId` est connu avant le retour HTTP. Le worker `meeting-bot` ne crée **pas** de bot, il fait uniquement le polling long (POLL_INTERVAL_MS = 30s, TIMEOUT_MS = 2h). Ne pas déplacer `createMeetingBot` dans le worker.

### I-2. Polling MeetingStage = 5s, arrêt auto sur status "completed"
`MeetingStage` poll `/api/v2/meetings/[id]` toutes les 5 000ms. Si `data.status === "completed"`, le timer n'est pas replanifié. Ne pas changer l'intervalle sans évaluer l'impact API Recall.ai. Sur erreur réseau, le polling continue (retry au prochain tick).

### I-3. Webhook HMAC : strict en prod, permissif en dev
`verifyWebhookSignature` retourne `reason: "no_secret"` si `RECALL_WEBHOOK_SECRET` est absent. En production, la route retourne 503. En dev (NODE_ENV !== "production"), le payload est accepté avec un warn. Cette bifurcation dev/prod ne doit pas être supprimée — elle permet de tester les webhooks localement sans secret.

### I-4. webhook-cache = mémoire volatile, pas de source de vérité
`webhook-cache.ts` est un cache LRU mémoire (max 200 entries, LRU via Map insertion order). Un redéploiement perd le cache. `getBotStatus()` est la source de vérité. Le cache ne doit pas servir à décider d'actions critiques (persister asset, terminer worker).

### I-5. Debrief = Sonnet 4.6, 4 sections markdown, ≤350 mots
`generateMeetingDebrief` utilise `claude-sonnet-4-6` avec `max_tokens: 1500`. Le format (Contexte / Décisions / Actions / Suivi) est imposé dans `DEBRIEF_SYSTEM_PROMPT`. L'UI lit `editorialSummary` du `contentRef` tel quel — changer le format casse l'affichage sans migration.

### I-6. Asset placeholder kind=event persisté avant le worker
`POST /start` appelle `storeAsset` avec `kind: "event"` et `contentRef` initial avant d'enqueuer le job. Si l'enqueue échoue (Redis indisponible), l'asset existe quand même et l'UI peut poller Recall directement. Ne jamais inverser l'ordre persist → enqueue.

### I-7. Action items extraits via Deepgram (Haiku fallback) avec timeout 8s
`GET /api/v2/meetings/[id]` appelle `extractActionItems(transcript)` via un `withTimeout` de 8 000ms (fallback `[]`). Le worker appelle `extractActionItems` uniquement si le transcript est stable depuis 30s (`STABLE_TRANSCRIPT_MS`). Ne pas retirer le timeout côté API — l'extraction Haiku peut bloquer.

### I-8. Action items → Commandeur, jamais création directe de mission
Quand l'utilisateur sélectionne des action items et clique "Créer mission", `MeetingStage` appelle `setCommandeurOpen(true, { prefilledQuery })` — il ne crée pas de mission directement. L'utilisateur voit la query préremplie dans le Commandeur, peut l'éditer, puis valide via le pipeline standard. Ne pas court-circuiter cette étape.

### I-9. stopBot ≠ deleteBot — deux opérations distinctes
`stopBot` = `POST /bot/:id/leave_call` (quitter la réunion). `deleteBot` = `DELETE /bot/:id` (supprimer la ressource Recall). Le DELETE est fire-and-forget (`.catch(() => {})`). `stopBot` peut échouer silencieusement en DELETE (`status 404/405` = considéré OK). Ne pas fusionner les deux.

### I-10. RECALL_API_KEY absent → 503 propre sur toutes les routes
Toutes les routes meetings vérifient `isRecallAiConfigured()` avant d'agir. Retour `{ error: "recall_ai_unavailable" }` avec status 503. `MeetingStage` détecte le 503 au start et affiche un CTA "Configure Recall.ai dans .env". Cette gate ne doit pas être retirée.

### I-11. validateMeetingUrl : seuls Zoom / Google Meet / Teams acceptés
`validateMeetingUrl` rejette tout provider `"unknown"` (retourne `{ ok: false, reason: "unsupported_provider" }`). Les URLs http:// et https:// sont les seuls protocoles acceptés. Ne pas élargir la liste des providers sans valider la compatibilité Recall.ai.

## Tests

Existants :
- Tests Vitest sur `recall-ai.ts` (verifyWebhookSignature, detectMeetingProvider, validateMeetingUrl)
- Tests `webhook-cache.ts` (recordWebhookEvent, LRU eviction)

Manquants :
- Test `POST /start` — mock createMeetingBot + storeAsset + enqueueJob, vérifie ordre persist → enqueue
- Test `GET /[id]` — withTimeout 8s sur extractActionItems (mock delay > 8s → retourne [])
- Test worker meeting-bot — transcript stable 30s déclenche extractActionItems, TERMINAL_STATUSES arrête la boucle
- Test `generateMeetingDebrief` — transcript vide → null, ANTHROPIC_API_KEY absent → null
- Test `POST /webhook` — signature valide → 200, signature invalide → 403, no_secret + prod → 503
- Test sélection action items → Commandeur prefilledQuery formatée correctement
