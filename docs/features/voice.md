# Voice — `voice`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `voice` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description

Mode voix ambient temps réel (Signature 6 — Pulse Vocal). L'utilisateur active la voix via ⌘7 ou ⌘⇧V. `VoicePulse` est monté **une seule fois** au root layout et reste monté en permanence — seul `voiceActive` (Zustand) pilote l'ouverture/fermeture du pipeline WebRTC. `VoiceStage` ne fait que visualiser (orb pulsant, badge phase, transcript via ContextRail) — il ne monte rien côté WebRTC. Le modèle est `gpt-4o-realtime-preview` avec function calling Composio + 4 Hearst natifs.

## Surface publique

**Endpoints API**
- `POST /api/realtime/session` — mint un token éphémère OpenAI Realtime (~60s lifetime), injecte les tools (Hearst + Composio curated), résout la voix depuis le tone de persona
- `POST /api/v2/voice/tool-call` — exécute une function call reçue via DataChannel, persiste tool_call + tool_result dans Supabase
- `POST /api/v2/voice/transcripts/append` — append une entry user/assistant au transcript persisté
- `GET /api/v2/voice/transcripts/[sessionId]` — charge le transcript complet (ownership check RLS)
- `PATCH /api/v2/voice/transcripts/[sessionId]` — lie le transcript à un thread chat

**Composants**
- `app/(user)/components/voice/VoicePulse.tsx` — pipeline WebRTC, monté au root layout via `VoiceMount`
- `app/(user)/components/stages/VoiceStage.tsx` — visualisation orb + badge phase, lit `useVoiceStore`

**Stores**
- `stores/voice.ts` — `useVoiceStore` (Zustand) : phase, sessionId, transcript, audioLevel, voiceActive

**Libs server**
- `lib/voice/tools.ts` — dispatcher `executeVoiceTool` + export `voiceToolDefs`
- `lib/voice/composio-bridge.ts` — `getVoiceComposioTools` (cap 20 total, 4/app)
- `lib/voice/transcript-store.ts` — UPSERT Supabase table `voice_transcripts`
- `lib/voice/voice-mapping.ts` — `resolveRealtimeVoice(tone)` → 8 voix Realtime
- `lib/capabilities/providers/openai-realtime.ts` — `mintRealtimeSession`

## Types clés

```ts
// stores/voice.ts
type VoicePhase = "idle" | "connecting" | "listening" | "processing" | "speaking" | "error";

interface TranscriptEntry {
  id: string;
  role: "user" | "assistant" | "tool_call" | "tool_result";
  text: string;
  timestamp: number;
  callId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  output?: string;
  status?: "pending" | "success" | "error";
  providerId?: string;
}

// lib/voice/tool-defs.ts
interface VoiceToolDef {
  type: "function";
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

// lib/voice/tools.ts
interface VoiceToolResult {
  output: string;
  stageRequest?: StagePayload;
  providerId?: string;
  latencyMs?: number;
  costUsd?: number;
  status?: "success" | "error";
}

// lib/capabilities/providers/openai-realtime.ts
// mintRealtimeSession retourne :
interface RealtimeSessionResult {
  sessionId: string;
  ephemeralKey: string; // ~60s lifetime
  expiresAt: number;
  voice: RealtimeVoice;
}
```

## Invariants verrouillés

### I-1. Singleton WebRTC — jamais deux sessions concurrentes
`VoicePulse` utilise deux guards module-level (`activePc` + `isStarting`) pour bloquer tout double-mint. Si `activePc !== null` ou `isStarting === true`, `start()` retourne immédiatement sans ouvrir de seconde session OpenAI Realtime.

### I-2. VoicePulse monté au root layout, jamais dans VoiceStage
Le composant doit rester monté en permanence pour éviter l'accumulation de sessions (bug historique : 14 sessions accumulées quand monté dans le Stage). Toute tentative de déplacer `VoicePulse` dans `VoiceStage` ou un enfant de Stage est interdite.

### I-3. voiceActive pilote le pipeline, pas le mount/unmount
Le pipeline WebRTC s'ouvre/ferme via `useVoiceStore.setVoiceActive(bool)`. `reset()` n'inclut **pas** `voiceActive` pour éviter la boucle `teardown → reset → unmount → teardown` qui coupait le son.

### I-4. La clé API OpenAI ne quitte jamais le serveur
Le client browser reçoit uniquement l'`ephemeralKey` (~60s) via `/api/realtime/session`. La connexion SDP est établie directement entre le browser et `api.openai.com` avec cette clé éphémère. `OPENAI_API_KEY` côté serveur ne doit jamais être exposée au client.

### I-5. Composio tools : cap 20 total, 4 par app
`curateForVoice` applique `MAX_TOOLS_TOTAL = 20` et `MAX_TOOLS_PER_APP = 4`. Jamais injecter plus de 20 tools dans le mint — latence, coût, hallucinations. Les Hearst tools natifs (4 : `start_meeting_bot`, `start_simulation`, `generate_image`, `start_browser`) s'ajoutent **en plus** de ce cap Composio.

### I-6. Actions destructives : confirmation orale obligatoire avant tool call
Le system prompt impose : pour SEND (mail, message, post), DELETE, ARCHIVE → le modèle redonne les paramètres clés à l'utilisateur et attend un "oui/confirme/go" explicite. Cette règle ne doit pas être retirée du prompt `mintRealtimeSession`.

### I-7. stageRequest appliqué après patch de phase, pas avant
Dans `handleFunctionCall`, `setPhase("listening")` est appelé **avant** `useStageStore.getState().setMode(stageRequest)`. Inverser l'ordre peut geler la phase en "processing" si le stage change décore VoicePulse avant que `response.done` remette la phase.

### I-8. Transcript persisté dans Supabase, pas de TTL applicatif
La table `voice_transcripts` (migration 0045) est append-only par UPSERT. Aucun TTL n'est appliqué côté code — la rétention est gérée par la politique Supabase/base de données. Les erreurs de persistance sont silencieuses (fire-and-forget) pour ne pas casser la voix.

### I-9. Tone-to-voice mapping fixe — ne pas modifier sans spec
`TONE_TO_VOICE` dans `voice-mapping.ts` est le contrat entre les personas et les voix Realtime. Modifier un mapping change l'expérience voix pour tous les users avec cette persona. Tout changement requiert une validation par Adrien.

### I-10. RLS migration 0045 — scope userId/tenantId obligatoire
`appendTranscriptEntry` reçoit `userId` et `tenantId` de `requireScope`. Le service_role bypass Supabase côté server est autorisé. Toute lecture de transcript vérifie `transcript.userId === scope.userId` avant de retourner le payload.

## Tests

Existants :
- Tests Vitest unitaires sur `voice-mapping.ts` (resolveRealtimeVoice)
- Tests sur `composio-bridge.ts` (curateForVoice, isComposioToolName)

Manquants :
- Test d'intégration `POST /api/realtime/session` (mock OpenAI Realtime)
- Test du guard singleton WebRTC (deux appels concurrents à `start()`)
- Test `handleFunctionCall` → stageRequest appliqué après patch phase
- Test RLS : user A ne peut pas lire le transcript de user B
- Test du transcript-store UPSERT (entry existante = patch en place, nouvelle = append)
