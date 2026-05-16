# Brief Opus — Spatial Cinéma : implémentation P0 + P1 + P2

**Cible** : transformer `/spatial` (proto luxe actuel) en **mode cinéma parallèle à `/`**.
Le robot Spline réagit en temps réel au runtime LLM + voice + tool calls.
**Aucune migration depuis `/`** — `/spatial` reste hors-DS, hors-ADD, expérience focus pour démos / sessions vocales / présentations.

---

## Contexte (à lire avant de coder)

### État actuel `/spatial`

**Vivant** :

- `app/spatial/page.tsx` — RSC qui compose layout client + scène + overlay
- `components/spatial/core/SpatialLogoCore.tsx` — Spline dynamic-loaded (`ssr:false`), URL `https://prod.spline.design/jc1CUanFKE-XIpec/scene.splinecode`
- `components/spatial/core/SpatialLogoInteraction.tsx` — wrapper client qui toggle Look At ON/OFF au clic
- `components/spatial/core/SpatialLayout.tsx` — providers (theme/motion/stage/mouse)
- `components/spatial/core/SpatialScene.tsx` — conteneur fixed
- `components/spatial/overlays/SpatialOverlayManager.tsx` — grille bento gauche + CommandBar bas
- `components/spatial/overlays/CommandBar.tsx` — input style bento (**onSubmit = console.log, PAS branchée**)
- `components/spatial/panels/BentoCard.tsx` — primitive glass + tilt 3D mouse-follow
- `components/spatial/panels/MiniChart.tsx` — bars random animées
- `components/spatial/panels/{Brief,Mission,Assets}Panel.tsx` — bento cards
- `components/spatial/panels/FloatingPanel.tsx` — primitive ancien style (NON utilisée par les bento, mais encore exportée)
- `components/spatial/panels/AssetCard.tsx` — modal asset (NON montée actuellement)
- `providers/spatial/Spatial{Theme,Motion,Stage,Mouse}Provider.tsx`
- `hooks/spatial/{useSpatialMouse,useSpatialR3F}.ts`
- `lib/spatial/{types,constants,utils}.ts`
- `styles/spatial/spatial.css`

**Dépendances 3D actives** : `@splinetool/react-spline@4.1.0`, `three`, `@react-three/fiber`, `@react-three/drei` (these last sont là pour la phase hybride future, peu utilisés)

### Stores existants à consommer (NE PAS dupliquer)

| Store                   | Path                      | Ce qu'on lit                                                                                                             |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `useRuntimeStore`       | `stores/runtime.ts`       | `coreState`, `currentRunId`, `currentPlan`, `events`, `addEvent`, `startRun`, `failRun`, `stopRun`, `setAbortController` |
| `useVoiceStore`         | `stores/voice.ts`         | `phase`, `audioLevel`, `voiceActive`, `setVoiceActive`, `transcript`                                                     |
| `useFocalStore`         | `stores/focal.ts`         | `focal`, `secondary`, `setFocal`, `pinnedFocalKey`                                                                       |
| `useNavigationStore`    | `stores/navigation.ts`    | `activeThreadId`, `messages`, `addThread`, `setActiveThread`, `addMessageToThread`, `updateMessageInThread`              |
| `useStageStore`         | `stores/stage.ts`         | `setMode` (pour navigation cross-stage)                                                                                  |
| `useNotificationsStore` | `stores/notifications.ts` | `notifications`, `unreadCount`                                                                                           |

### Endpoints API existants à appeler (NE PAS recréer)

- `POST /api/orchestrate` — chat principal SSE (RuntimeStore.startRun + parse stream)
- `POST /api/orchestrate/abort/:runId` — fire-and-forget abort
- `POST /api/realtime/session` — mint ephemeralKey OpenAI Realtime (déjà appelé par VoicePulse)
- `POST /api/v2/voice/tool-call` — exec voice tools (déjà appelé par VoicePulse)

### Pattern canonique à reproduire

Le code de `app/(user)/components/ChatDock.tsx` (lignes 156-297) montre **exactement comment consommer `/api/orchestrate` SSE** :

- POST avec messages + history
- `Body.getReader()` + decode chunks
- Parse `event:` + `data:` SSE lines
- Dispatch chaque event vers `useRuntimeStore.addEvent()` (qui set automatiquement coreState)
- Cas spécial `text_delta` → concat dans `assistantBuffer` + `updateMessageInThread`
- Cas spécial `stage_request` → `setStageModeFromTool()`

→ **Réutiliser cette logique mot pour mot** dans la CommandBar de `/spatial`. Ne pas réinventer.

---

## Objectif final

Sur `/spatial`, l'utilisateur :

1. Voit le robot 3D centré-droit, yeux allumés
2. Tape un prompt dans la CommandBar style bento
3. Le robot **commence à bouger** (anim "thinking" / "processing")
4. Les bento cards s'updatent en live (`MissionPanel` montre les steps)
5. Si voice ON, le robot **pulse en synchro avec audioLevel TTS**
6. Quand un tool s'exécute (envoi mail, génération image), le robot fait l'**anim contextuelle**
7. Quand un asset est généré, une `AssetCard` slide-in centrale
8. Approval HITL → halo cyan + bento alert
9. Click bento Mission → bascule vers `MissionStage` classique sur `/`

---

## P0 — Bindings runtime + bridge Spline (fondations, ~1.5j)

### P0-1 — Hook `useSplineApp` + capture Application

**Fichier nouveau** : `hooks/spatial/useSplineApp.ts`

```ts
"use client";

import { useCallback, useRef } from "react";
import type { Application, SPEObject } from "@splinetool/runtime";

const TARGET_OBJECTS = ["Robot", "Orb", "Halo", "Eyes"] as const;
type TargetName = (typeof TARGET_OBJECTS)[number];

export function useSplineApp() {
  const appRef = useRef<Application | null>(null);
  const objectsRef = useRef<Map<TargetName, SPEObject>>(new Map());
  const readyRef = useRef(false);

  const onLoad = useCallback((app: Application) => {
    appRef.current = app;
    for (const name of TARGET_OBJECTS) {
      const o = app.findObjectByName(name);
      if (o) objectsRef.current.set(name, o);
    }
    readyRef.current = true;
  }, []);

  const emit = useCallback(
    (event: "mouseDown" | "mouseUp" | "keyDown" | "keyUp" | "start", target: string) => {
      appRef.current?.emitEvent(event, target);
    },
    [],
  );

  const setVar = useCallback((name: string, value: number | string | boolean) => {
    appRef.current?.setVariable(name, value);
  }, []);

  const obj = useCallback((name: TargetName) => objectsRef.current.get(name), []);

  return { onLoad, emit, setVar, obj, app: appRef, ready: readyRef };
}
```

Refactor `SpatialLogoCore.tsx` pour appeler `onLoad={onLoad}` sur `<Spline />`. Exporter le hook en barrel `hooks/spatial/index.ts`.

### P0-2 — Bridge `useVoiceStore.audioLevel` → Spline pulse

**Fichier nouveau** : `hooks/spatial/useSplineVoiceBridge.ts`

```ts
"use client";

import { useEffect } from "react";
import { useVoiceStore } from "@/stores/voice";
import { useSplineApp } from "./useSplineApp";

export function useSplineVoiceBridge(spline: ReturnType<typeof useSplineApp>) {
  // Pulse continu : RAF lit audioLevel et l'envoie à Spline 60fps sans re-render
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const level = useVoiceStore.getState().audioLevel; // ref read, no subscribe
      if (spline.ready.current) {
        spline.setVar("pulse", level);
        // Fallback si la scène n'expose pas la variable : muter scale Orb directement
        const orb = spline.obj("Orb");
        if (orb) {
          const s = 1 + level * 0.18;
          orb.scale.x = orb.scale.y = orb.scale.z = s;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spline]);
}
```

### P0-3 — Bridge `useVoiceStore.phase` + `useRuntimeStore.coreState` → Spline events

**Fichier nouveau** : `hooks/spatial/useSplineStateBridge.ts`

```ts
"use client";

import { useEffect } from "react";
import { useVoiceStore } from "@/stores/voice";
import { useRuntimeStore } from "@/stores/runtime";
import { useSplineApp } from "./useSplineApp";

const PHASE_TO_SPLINE_KEY: Record<string, string> = {
  idle: "A", // mappé dans Spline éditeur sur State Idle
  listening: "B", // → State Listening
  speaking: "C", // → State Speaking
  processing: "D", // → State Processing
  error: "E", // → State Error
};

const CORE_TO_SPLINE_KEY: Record<string, string> = {
  idle: "A",
  streaming: "D",
  processing: "D",
  error: "E",
  awaiting_approval: "F",
  awaiting_clarification: "F",
};

export function useSplineStateBridge(spline: ReturnType<typeof useSplineApp>) {
  const voicePhase = useVoiceStore((s) => s.phase);
  const coreState = useRuntimeStore((s) => s.coreState);

  useEffect(() => {
    if (!spline.ready.current) return;
    // Voice prend la priorité si voice active
    const voiceActive = useVoiceStore.getState().voiceActive;
    const key = voiceActive ? PHASE_TO_SPLINE_KEY[voicePhase] : CORE_TO_SPLINE_KEY[coreState];
    if (!key) return;
    spline.emit("keyDown", "Robot");
    spline.setVar("mood", voiceActive ? voicePhase : coreState);
  }, [voicePhase, coreState, spline]);
}
```

**⚠ Décision designer** : si la scène Spline n'expose ni les States ni la variable `mood`/`pulse`, fallback automatique sur la mutation directe de `scale/intensity` dans le RAF P0-2. Voir section "Conventions Spline designer" en fin de doc.

### P0-4 — CommandBar branchée sur `/api/orchestrate`

Refactor complet de `components/spatial/overlays/CommandBar.tsx`. Reproduire exactement le pattern de `app/(user)/components/ChatDock.tsx` lignes 156-297.

Pseudo-code :

```ts
async function handleSubmit(text: string) {
  const runtime = useRuntimeStore.getState();
  const navigation = useNavigationStore.getState();
  const voice = useVoiceStore.getState();

  // 1. Crée ou récupère un thread
  let threadId = navigation.activeThreadId;
  if (!threadId) {
    threadId = navigation.addThread(text.slice(0, 60), "home");
    navigation.setActiveThread(threadId);
  }

  // 2. Push message user
  const userMessageId = crypto.randomUUID();
  navigation.addMessageToThread(threadId, {
    id: userMessageId,
    role: "user",
    content: text,
    createdAt: Date.now(),
  });

  // 3. Push placeholder assistant (sera updated par text_delta)
  const assistantMessageId = crypto.randomUUID();
  navigation.addMessageToThread(threadId, {
    id: assistantMessageId,
    role: "assistant",
    content: "",
    createdAt: Date.now(),
  });

  // 4. Start run + setup abort
  const abortController = new AbortController();
  runtime.setAbortController(abortController);

  try {
    const res = await fetch("/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        threadId,
        conversationHistory:
          navigation.messages[threadId]?.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })) ?? [],
      }),
      signal: abortController.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantBuffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (let i = 0; i < lines.length; i += 2) {
        const eventLine = lines[i];
        const dataLine = lines[i + 1];
        if (!eventLine?.startsWith("event:") || !dataLine?.startsWith("data:")) continue;

        const eventType = eventLine.slice(6).trim();
        const data = JSON.parse(dataLine.slice(5).trim());

        // Route to RuntimeStore (sets coreState automatically)
        runtime.addEvent({ type: eventType, ...data });

        // Special: text_delta → update assistant message
        if (eventType === "text_delta") {
          assistantBuffer += data.delta ?? "";
          navigation.updateMessageInThread(threadId, assistantMessageId, {
            content: assistantBuffer,
          });
        }
      }
    }
  } catch (err) {
    runtime.failRun(err instanceof Error ? err.message : "unknown");
  } finally {
    runtime.setAbortController(null);
  }
}
```

Garde le rendu visuel actuel (bento glass), juste branche le `onSubmit` réel.

### P0-5 — BriefPanel consomme Focal Store

Refactor `components/spatial/panels/BriefPanel.tsx` :

```ts
const focal = useFocalStore((s) => s.focal);
const isBrief = focal?.type === "brief";

// Si focal brief existe : afficher focal.title + focal.summary
// Sinon : fallback sur greeting éditorial (CockpitHeader-style)
```

Mémoiser le calcul d'heure du meeting (déjà fait dans la version actuelle via `useMemo`).

### P0-6 — MissionPanel consomme `currentPlan`

Refactor `components/spatial/panels/MissionPanel.tsx` :

```ts
const currentPlan = useRuntimeStore((s) => s.currentPlan);
const coreState = useRuntimeStore((s) => s.coreState);

const runningSteps = currentPlan?.steps.filter((s) => s.status === "running").length ?? 0;
const totalSteps = currentPlan?.steps.length ?? 0;
const currentStepLabel = currentPlan?.steps.find((s) => s.status === "running")?.label;

// MiniChart : remplacer random heights par latencyMs des steps complétés
const chartHeights =
  currentPlan?.steps
    .filter((s) => s.latencyMs)
    .slice(-12)
    .map((s) => Math.min(100, (s.latencyMs! / 5000) * 100)) ?? [];
```

Refactor `MiniChart` pour accepter `heights?: number[]` en prop (fallback random si absent).

### P0-7 — AssetsPanel consomme Focal secondary + messages assetRef

Refactor `components/spatial/panels/AssetsPanel.tsx` :

```ts
const secondary = useFocalStore((s) => s.secondary);
const activeThreadId = useNavigationStore((s) => s.activeThreadId);
const messages = useNavigationStore((s) => (activeThreadId ? s.messages[activeThreadId] : []));

const assetRefs = (messages ?? [])
  .filter((m) => m.assetRef)
  .slice(-5)
  .map((m) => ({
    label: m.assetRef!.label ?? "Asset",
    time: relativeTime(m.createdAt),
    id: m.assetRef!.id,
  }));

const allAssets = [
  ...secondary.map((o) => ({ label: o.title, time: relativeTime(o.updatedAt), id: o.id })),
  ...assetRefs,
];
```

Helper `relativeTime(ts: number) => 'hier' | 'lun.' | 'à l\'instant'` à créer dans `lib/spatial/utils.ts`.

---

## P1 — UX flow agent + intercos stages (~1.5j)

### P1-1 — Plan steps live → bento secondaires éphémères

Quand `currentPlan.steps` contient des steps `running` ou `awaiting_approval`, afficher un nouveau bento card par step actif (max 3 simultanés). Composant nouveau : `components/spatial/panels/PlanStepCard.tsx`.

Layout : 1 colonne × 1 rangée chacun, glissés en bas de la grille bento. Anim emerge stagger 0.1s.

```ts
{currentPlan?.steps
  .filter(s => s.status === 'running' || s.status === 'awaiting_approval')
  .slice(0, 3)
  .map((step, i) => (
    <PlanStepCard key={step.id} step={step} delay={i * 0.1} />
  ))
}
```

`PlanStepCard` affiche : `step.label`, `step.kind` (toolname → icon), `step.providerId` (badge), `step.status` (dot pulse).

### P1-2 — Asset généré → AssetCard centrale slide-in

Écouter `useFocalStore.focal` qui passe à `status: 'delivered'` pour un type `report`/`doc`/`brief`. Monter `AssetCard` (déjà existant, à recâbler) en center stage avec backdrop dim.

Refactor `components/spatial/panels/AssetCard.tsx` pour consommer le focal réel :

- `focal.title`, `focal.summary`, `focal.body`
- Bouton "Ouvrir" → `useStageStore.setMode({ mode: 'asset', assetId: focal.sourceAssetId })` + redirect `/`
- Bouton "Fermer" → `useFocalStore.hide()`

### P1-3 — HITL `awaiting_approval` → halo cyan + bento alert

Quand `coreState === 'awaiting_approval'` :

- Halo cyan sur le robot (variable Spline `mood='approval'` ou fallback : ring overlay HTML pulsant cyan autour du conteneur Spline)
- Card bento alert top-right "Validation requise" + preview du `currentPlan.steps[].approvalPreview`
- Bouton "Approuver" → `useRuntimeStore.approveStep(planId, stepId)`

Composant nouveau : `components/spatial/overlays/ApprovalAlert.tsx`.

### P1-4 — Click bento Mission/Asset → bascule vers stage classique

Sur click `MissionPanel` :

```ts
const router = useRouter();
const stage = useStageStore.getState();

function handleClick() {
  if (currentPlan) {
    stage.setMode({ mode: "mission", missionId: currentPlan.id });
    router.push("/");
  }
}
```

Idem pour `AssetsPanel` items + `AssetCard` "Ouvrir".

Indication visuelle : cursor pointer + chevron right au hover.

### P1-5 — ⌘K dans CommandBar → ouvrir Commandeur existant

Hotkey `Cmd+K` global sur `/spatial` :

```ts
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      useStageStore.getState().setCommandeurOpen(true, { prefilledQuery: "" });
      router.push("/"); // Commandeur vit dans le layout (user)
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

Note : Commandeur n'existe pas dans `/spatial`. Soit on bascule sur `/`, soit on monte une copie isolée. **Décision** : bascule sur `/` (pas de duplication).

### P1-6 — Tool calls → anims Spline contextuelles

Écouter `useRuntimeStore.events` pour `tool_call_started`. Selon `providerId`, déclencher l'event Spline mappé :

```ts
const PROVIDER_TO_SPLINE_KEY: Record<string, string> = {
  gmail: "G", // → State "Sending mail" anim (enveloppe orbite)
  slack: "H", // → State "Slack message"
  fal_ai: "I", // → State "Generating image"
  composio: "J", // → State "Tool call generic"
};

useEffect(() => {
  const lastEvent = events[events.length - 1];
  if (lastEvent?.type === "tool_call_started") {
    const key = PROVIDER_TO_SPLINE_KEY[lastEvent.providerId] ?? "J";
    spline.emit("keyDown", "Robot");
  }
}, [events.length]);
```

Hook nouveau : `hooks/spatial/useSplineToolBridge.ts`.

---

## P2 — Polish + intégration satellites (~1j)

### P2-1 — KPIs hero bento (style CockpitStage existant)

Bento card large 4×1 en haut : reproduire `KPIStrip` existant (`app/(user)/components/cockpit/KPIStrip.tsx`) : Assets · Missions · Reports en typographie t-60 font-extralight.

Source de données : reuse `getCockpitToday(scope)` server-side, passé via props depuis `app/spatial/page.tsx` (RSC).

### P2-2 — Notifications bell flottant

Bento mini top-right : reuse `NotificationBell` (`app/(user)/components/NotificationBell.tsx`) ou clone simplifié.

Hook : `useNotificationsStore.startRealtime(tenantId)` au mount de `/spatial`.

### P2-3 — Voice toggle ⌘7 visible

Pill cyan flottante bottom-right qui devient active quand `voiceActive`. Hotkey `Cmd+7` toggle. Quand actif, affiche `phase` label + icône mic.

```ts
const voiceActive = useVoiceStore((s) => s.voiceActive);
const setVoiceActive = useVoiceStore((s) => s.setVoiceActive);

// Cmd+7
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "7") {
      e.preventDefault();
      setVoiceActive(!voiceActive);
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [voiceActive, setVoiceActive]);
```

⚠ `VoicePulse` (le pipeline WebRTC) vit dans `app/(user)/layout.tsx` — il n'est pas monté sur `/spatial`. Deux options :

- **A** : Mount `<VoicePulse />` dans `app/spatial/page.tsx` aussi (duplication contrôlée)
- **B** : Faire que `voiceActive=true` redirige vers `/` qui a déjà VoicePulse

**Décision** : option A. `<VoicePulse />` est déjà singleton (guards `activePc` + `isStarting` module-level), donc pas de risque de double instance. À monter en bas du layout `/spatial`.

### P2-4 — Adapter mobile (grille collapse en stack)

Tailwind responsive : `md:grid-cols-4 grid-cols-1` sur la grille bento.
Sur mobile, robot Spline pleine width en haut, bento cards stackées en dessous, CommandBar fixed bottom.

### P2-5 — Stage breadcrumb si stage actif différent

Si `useStageStore.current.mode !== 'cockpit'`, afficher mini breadcrumb top-left "Mode actif : Mission > Q2 Pipeline" avec bouton retour `/`.

### P2-6 — Background ambient si robot inactif

Si `coreState === 'idle'` ET `voicePhase === 'idle'` depuis > 30s, ajouter une légère anim ambient (rotation très lente du robot, ou glow halo background pulsant doux). Variable Spline `idle_intensity = 0.3`.

---

## Conventions Spline designer (à remettre au designer Spline)

Pour que les bridges P0/P1 marchent, le `.splinecode` exporté DOIT exposer :

### Variables (à créer dans Variables panel Spline)

| Nom              | Type   | Range                                                              | Bind suggéré                                |
| ---------------- | ------ | ------------------------------------------------------------------ | ------------------------------------------- |
| `pulse`          | Number | 0..1                                                               | Scale orbe central, intensité emissive yeux |
| `mood`           | String | "idle"\|"listening"\|"speaking"\|"processing"\|"error"\|"approval" | Couleur halo, anim posture                  |
| `idle_intensity` | Number | 0..1                                                               | Force de l'anim ambient idle                |

### States (à créer sur l'objet `Robot`)

| State name        | Trigger event Spline | Quand on l'active                                                  |
| ----------------- | -------------------- | ------------------------------------------------------------------ |
| `Idle`            | `keyDown` key='A'    | `coreState='idle'` & `voicePhase='idle'`                           |
| `Listening`       | `keyDown` key='B'    | `voicePhase='listening'`                                           |
| `Speaking`        | `keyDown` key='C'    | `voicePhase='speaking'`                                            |
| `Processing`      | `keyDown` key='D'    | `coreState='streaming'\|'processing'` ou `voicePhase='processing'` |
| `Error`           | `keyDown` key='E'    | `coreState='error'\|voicePhase='error'`                            |
| `Approval`        | `keyDown` key='F'    | `coreState='awaiting_approval'`                                    |
| `SendingMail`     | `keyDown` key='G'    | tool gmail                                                         |
| `SlackMessage`    | `keyDown` key='H'    | tool slack                                                         |
| `GeneratingImage` | `keyDown` key='I'    | tool fal_ai                                                        |
| `GenericTool`     | `keyDown` key='J'    | tool composio générique                                            |

### Objets nommés (pour fallback mutation directe)

Si le designer ne crée pas les variables, le code fallback sur :

- `Robot` — l'objet conteneur principal
- `Orb` — orbe central (scale + intensity pulse)
- `Halo` — anneau qui change couleur selon mood
- `Eyes` — pour faire blink/glow indépendant

**Action désigner** : nommer ces objets exactement comme listés (case-sensitive).

### Si la scène n'expose RIEN de tout ça

Le code DOIT **tomber gracieusement** :

- `setVariable` no-op si la variable n'existe pas (Spline API ne throw pas)
- `emitEvent` no-op si l'event n'est pas mappé
- Le RAF P0-2 mute `Orb.scale` direct si trouvé, sinon ne fait rien
- L'app reste fonctionnelle, juste sans réactivité visuelle

---

## Architecture finale visée

```
app/spatial/
└─ page.tsx                          [RSC] preFetch cockpit data, pass to client

components/spatial/
├─ core/
│  ├─ SpatialLayout.tsx             [client] providers
│  ├─ SpatialScene.tsx              [client] container fixed
│  ├─ SpatialLogoCore.tsx           [client] Spline + onLoad → useSplineApp
│  └─ SpatialLogoInteraction.tsx    [client] toggle Look At
├─ overlays/
│  ├─ SpatialOverlayManager.tsx     [client] grille bento + CommandBar
│  ├─ CommandBar.tsx                [client] BRANCHÉE /api/orchestrate
│  ├─ ApprovalAlert.tsx             [P1-3] HITL
│  ├─ NotificationBellSpatial.tsx   [P2-2]
│  ├─ VoicePill.tsx                 [P2-3] toggle voice
│  └─ StageBreadcrumb.tsx           [P2-5]
├─ panels/
│  ├─ BentoCard.tsx                 [primitive existante]
│  ├─ MiniChart.tsx                 [accepte heights?: number[]]
│  ├─ BriefPanel.tsx                [REFACTOR P0-5 : focal store]
│  ├─ MissionPanel.tsx              [REFACTOR P0-6 : currentPlan]
│  ├─ AssetsPanel.tsx               [REFACTOR P0-7 : focal secondary]
│  ├─ KPIBento.tsx                  [P2-1]
│  ├─ PlanStepCard.tsx              [P1-1]
│  └─ AssetCard.tsx                 [REFACTOR P1-2 : focal réel + setMode]
└─ ...

hooks/spatial/
├─ useSplineApp.ts                  [P0-1]
├─ useSplineVoiceBridge.ts          [P0-2]
├─ useSplineStateBridge.ts          [P0-3]
├─ useSplineToolBridge.ts           [P1-6]
└─ ...

stores/voice.ts                     [INCHANGÉ - on lit seulement]
stores/runtime.ts                   [INCHANGÉ - on lit seulement]
stores/focal.ts                     [INCHANGÉ - on lit seulement]
```

**Aucun nouveau store**. Tout consomme l'existant.

---

## Contrats stricts (à respecter, ne pas dévier)

1. **Pas de duplication de logique runtime** — la CommandBar appelle `/api/orchestrate` exactement comme ChatDock, en réutilisant les helpers de parsing SSE si besoin (extraire dans `lib/spatial/sse.ts` si nécessaire pour éviter copy-paste).

2. **Pas de re-render storm** — `audioLevel` se lit via `useVoiceStore.getState()` dans un RAF, jamais via subscribe. Idem pour les events SSE haute fréquence.

3. **Pas de mock dans les panels finaux** — si un store est vide, fallback à un message vide explicite ("Aucune mission active") plutôt que des fausses données.

4. **Préserver l'esthétique bento existante** — `BentoCard` glass `rgba(255,255,255,0.05)`, `border 0.10`, `rounded-[32px]`, tilt 3D 18°, blur 22px sat 130%. Respecter ces tokens.

5. **Pas de SSR sur Spline** — toujours `dynamic({ ssr: false })`. Le composant Spline ne doit JAMAIS être prerendered.

6. **CSP** — `next.config.ts` contient déjà : `connect-src https://prod.spline.design https://*.spline.design https://unpkg.com`, `worker-src 'self' blob:`, `style-src 'self' 'unsafe-inline' https://api.fontshare.com`. Si le bridge audio nécessite une nouvelle origine, MAJ + restart dev server.

7. **Validation finale** — `npx tsc --noEmit` doit passer côté spatial. Lint visual désactivé pour `/spatial` (déjà `lint-visual-disable-file` dans plusieurs fichiers, conserver).

8. **Hors-DS, hors-ADD** — ne pas toucher aux features verrouillées du `docs/AGENT-LOCK.json`. `/spatial` reste en mode autonomie totale.

9. **Tests** — pas de tests unitaires obligatoires sur le module spatial (proto luxe). En revanche, vérifier manuellement avant chaque commit :
   - `/spatial` charge sans erreur console
   - Robot apparaît, yeux allumés
   - CommandBar accepte input + envoie un vrai run
   - Si voice ON, robot pulse audibly avec TTS
   - Bento panels s'updatent quand un run tourne

---

## Sortie attendue d'Opus

À la fin de l'exécution :

1. **Tous les fichiers listés ci-dessus créés / refactorés**
2. **`npx tsc --noEmit` clean côté spatial**
3. **Un fichier `docs/specs/spatial-cinema-impl.md` mis à jour** avec une section "Implémentation réelle" qui documente :
   - Ce qui a été codé
   - Ce qui n'a pas pu être branché (ex. si la scène Spline ne contient pas les variables `pulse`/`mood`, mentionner que le designer doit les ajouter)
   - Les hotkeys disponibles
   - Comment tester chaque P0/P1/P2 manuellement
4. **Un commit unique par phase** : `feat(spatial): P0 bindings runtime + bridge Spline`, `feat(spatial): P1 UX flow agent + intercos stages`, `feat(spatial): P2 polish + satellites`
5. **Pas de push** — laisser Adrien valider visuellement avant push

---

## Anti-patterns à NE PAS faire

- ❌ Réécrire `VoicePulse` ou un nouveau pipeline WebRTC
- ❌ Créer un nouveau orchestrator / endpoint API
- ❌ Faire des animations Spline en JS pur (mutate Three.js sous-jacent) — passer par variables/events Spline
- ❌ Mettre `audioLevel` dans `useState` (60 setState/s = mort)
- ❌ Toucher à `app/(user)/` sauf si strictement nécessaire pour exposer un store/helper réutilisable
- ❌ Ajouter de nouvelles deps npm sans demander
- ❌ Régénérer la scène Spline (URL fixe : `https://prod.spline.design/jc1CUanFKE-XIpec/scene.splinecode`)

---

## Estimation finale

| Phase                                 | Effort Opus | Réalisme                                           |
| ------------------------------------- | ----------- | -------------------------------------------------- |
| P0 (bindings runtime + bridge Spline) | 1.5j        | Critique : sans P0, `/spatial` reste déco          |
| P1 (UX flow agent + intercos stages)  | 1.5j        | Important : sans P1, le mode cinéma manque de nerf |
| P2 (polish + satellites)              | 1j          | Confort : sans P2, c'est juste pas raffiné         |
| **Total**                             | **4j Opus** | Soit ~1 journée user en compressant                |

---

## Variant de prompt minimaliste pour Opus (à coller direct)

```
Lis docs/specs/spatial-cinema-impl.md.

Implémente intégralement P0 + P1 + P2 dans cet ordre, en respectant tous les contrats stricts et anti-patterns.

À chaque phase complétée :
1. Run `npx tsc --noEmit` (uniquement vérifier 0 erreur SPATIAL — ignorer les erreurs préexistantes hors module)
2. Commit avec le message exact prescrit
3. Continuer sans demander confirmation

Si la scène Spline ne contient pas les variables `pulse`/`mood` ou les States A-J, code les fallbacks (mutate Orb.scale direct si Orb existe, sinon log warn et continuer).

À la fin, mets à jour la section "Implémentation réelle" de docs/specs/spatial-cinema-impl.md avec :
- Ce qui marche
- Ce qui dépend de modifications côté designer Spline
- Les hotkeys actifs
- Le test manuel pas à pas

Ne push pas. Termine en disant ce qui reste à valider visuellement.
```

---

## Implémentation réelle (mise à jour Opus 2026-05-11)

### Ce qui marche

#### Bridges runtime ↔ Spline (P0)

**Fichiers créés** :

- `hooks/spatial/useSplineApp.ts` — capture l'`Application` Spline au load, expose `emit`/`setVar`/`obj` no-op-safe
- `hooks/spatial/useSplineVoiceBridge.ts` — RAF 60 fps qui pousse `voiceStore.audioLevel` (0..1) vers `pulse` Spline + fallback `Orb.scale` (1 → 1.18)
- `hooks/spatial/useSplineStateBridge.ts` — voice phase + core state → `keyDown('Robot')` + variable `mood`
- `hooks/spatial/useSplineToolBridge.ts` — `tool_call_started` / `plan_step_started` → `keyDown` + `mood: tool:<provider>` + `tool_key: G/H/I/J`
- `hooks/spatial/useSplineIdleAmbient.ts` — `idle_intensity` ramp 0 → 0.3 après 30 s d'inactivité

**Tous les bridges** lisent les stores via subscribe granulaire (sauf `useSplineVoiceBridge` qui lit `getState()` dans la RAF — zero re-render React).

#### Composants client refactorés (P0)

- `components/spatial/core/SpatialLogoCore.tsx` — accepte `onLoad?` propagé à `<Spline />`
- `components/spatial/core/SpatialRoot.tsx` (nouveau) — orchestre `useSplineApp` + tous les bridges + monte la scène + l'overlay manager + les satellites P2 + `<VoicePulse />` (dynamic ssr:false)
- `components/spatial/overlays/CommandBar.tsx` — branchée sur `/api/orchestrate` (pattern ChatDock 156-297 reproduit), parsing SSE via `lib/spatial/sse.ts`, gère `text_delta` + crée thread + push messages user/assistant
- `components/spatial/panels/BriefPanel.tsx` — consomme `useFocalStore.focal` (type='brief') sinon greeting éditorial avec `subjectsCount` réel issu de navigation messages
- `components/spatial/panels/MissionPanel.tsx` — consomme `useRuntimeStore.currentPlan`, affiche step running courant + chart latences réelles + click → `setMode({mode:'mission', missionId})` + `router.push('/')`
- `components/spatial/panels/MiniChart.tsx` — accepte `heights?: number[]` (fallback random conservé)
- `components/spatial/panels/AssetsPanel.tsx` — consomme `useFocalStore.secondary` + `messages[].assetRef`, click → `setMode({mode:'asset', assetId})` + `router.push('/')`
- `lib/spatial/utils.ts` — helper `relativeTime(ts)` (à l'instant / 5min / hier / lun. / 12 mai)
- `lib/spatial/sse.ts` (nouveau) — parser SSE réutilisable `parseSSEChunk(buffer)`

#### Composants client P1

- `components/spatial/panels/PlanStepCard.tsx` — bento éphémère par step running ou awaiting_approval, max 3, stagger 0.1s
- `components/spatial/panels/AssetCard.tsx` — refactor : consomme `useFocalStore.focal` (delivered + type asset), bouton "Ouvrir" → `setMode({mode:'asset'})` + push '/'
- `components/spatial/overlays/ApprovalAlert.tsx` — alerte HITL top-right, halo cyan pulsant, bouton "Approuver" → `useRuntimeStore.approveStep(planId, stepId)`
- `components/spatial/overlays/SpatialHotkeys.tsx` — composant null qui pose les listeners Cmd+K et Cmd+7

#### Composants client P2

- `components/spatial/panels/KPIBento.tsx` — bento 4×1 hero top, KPIs Agenda / Missions / Suggestions depuis `getCockpitToday` pre-fetché RSC
- `components/spatial/overlays/NotificationBellSpatial.tsx` — pill glass top-right, dot cyan si unread, click → redirect `/notifications`
- `components/spatial/overlays/VoicePill.tsx` — pill glass bottom-right, label phase actif si `voiceActive`, hint Cmd+7
- `components/spatial/overlays/StageBreadcrumb.tsx` — breadcrumb top-left si stage shell ≠ cockpit, click → push '/'
- `app/spatial/page.tsx` — RSC pre-fetch `getCockpitToday(scope)` (fail-soft) → passé en prop à `SpatialRoot`
- Mobile : grille bento responsive (`md:grid-cols-4 grid-cols-1`) — robot pleine width sur mobile, bento stackés

#### Mounts de la shell (P2)

- `<VoicePulse />` monté dans `SpatialRoot` via dynamic ssr:false. Le composant a déjà des guards `activePc` + `isStarting` module-level, donc le double-mount sur `/` et `/spatial` ne crée pas deux sessions WebRTC concurrentes.
- `useNotificationsStore.startRealtime(tenantId)` démarré au mount du `NotificationBellSpatial`.

### Ce qui dépend du designer Spline

La scène actuelle (`https://prod.spline.design/jc1CUanFKE-XIpec/scene.splinecode`) n'a **pas été inspectée par cet agent** (pas d'accès Spline éditeur). Le code est codé pour **degrader gracieusement** :

| Asset attendu                                                                     | Si présent                                    | Si absent (état actuel probable)                                                                  |
| --------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Variable `pulse` (Number 0..1)                                                    | Spline anime tout objet bindé sur `pulse`     | No-op silencieux + fallback : mute `Orb.scale` (1 → 1.18) si l'objet `Orb` existe                 |
| Variable `mood` (String)                                                          | Shaders / posture peuvent lire l'état courant | No-op silencieux                                                                                  |
| Variable `tool_key` (String G..J)                                                 | Sub-anims tool-spécifiques                    | No-op silencieux                                                                                  |
| Variable `idle_intensity` (Number 0..1)                                           | Anim ambient quand idle > 30s                 | No-op silencieux                                                                                  |
| State `Idle/Listening/Speaking/Processing/Error/Approval` (keys A..F) sur `Robot` | Trigger anims via `keyDown('Robot')`          | No-op (Spline ne throw pas, juste rien ne se passe)                                               |
| Objets nommés : `Robot`, `Orb`, `Halo`, `Eyes`                                    | Mutation directe scale/intensity possible     | Au load : `console.warn` une fois "aucun des objets Spline attendus introuvable" + fallback no-op |

**Action désigner Spline** :

1. Créer les variables ci-dessus dans Variables panel (Spline éditeur → Settings → Variables)
2. Sur l'objet `Robot`, créer 6 States `A..F` (Idle/Listening/Speaking/Processing/Error/Approval) bindés sur `keyDown` avec ces keys
3. Optionnel : 4 States supplémentaires `G..J` (SendingMail/SlackMessage/GeneratingImage/GenericTool) — sinon `mood: 'tool:<provider>'` reste lisible
4. Bind `pulse` → scale d'un orbe central, intensité emissive yeux
5. Bind `mood` → couleur halo (cyan si 'approval', rouge si 'error', etc.)
6. Bind `idle_intensity` → vitesse rotation lente robot ou opacity halo background

### Hotkeys actifs sur /spatial

| Combo                      | Action                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Cmd/Ctrl + K`             | Ouvre le Commandeur (sur la home `/`, qui héberge le composant — `setCommandeurOpen(true)` + `router.push('/')`) |
| `Cmd/Ctrl + 7`             | Toggle `voiceStore.voiceActive` (active/désactive le pipeline WebRTC)                                            |
| `Enter` (focus CommandBar) | Soumet le prompt → `/api/orchestrate` SSE                                                                        |

Le mapping global `STAGE_HOTKEYS` (Cmd+1..0) n'est pas réinstallé sur `/spatial` — `setMode` requiert d'être sur `/`. Si l'user veut switcher de stage depuis `/spatial`, il passe par Cmd+K (Commandeur) ou clique un bento (Mission/Asset).

### Test manuel pas à pas

1. **Charge `/spatial`** : la scène Spline doit apparaître au centre-droit, yeux allumés. Le bento BriefPanel s'affiche à gauche avec "Bonjour" + nb sujets. La VoicePill apparaît bottom-right ("Voix · ⌘7"). Le KPIBento (Agenda/Missions/Suggestions) flotte top-center si la session est valide. Si pas de session → `getCockpitToday` retourne null, KPIs à 00.
2. **Tape un prompt dans la CommandBar** ("Résume mes mails") : le bouton Envoyer s'active, click → ouvre une connexion `/api/orchestrate`. Le placeholder devient "Hearst orchestre…". Le robot doit (a) déclencher `keyDown('Robot')` via `useSplineStateBridge` quand `coreState='streaming'` arrive, (b) si la scène a la State 'D' (Processing), bouger.
3. **Watch la grille bento** : quand un `plan_preview` arrive, `MissionPanel` switch sur "Plan en cours" + chart vide. Quand un `plan_step_started` arrive, un `PlanStepCard` éphémère apparaît en bas de la grille (max 3). Quand `plan_step_completed` arrive avec `latencyMs`, le chart de MissionPanel se remplit barre par barre.
4. **Approval HITL** : si le plan déclenche `plan_step_awaiting_approval`, `coreState` passe à `awaiting_approval` → l'`ApprovalAlert` slide-in top-right avec halo cyan pulsant + preview + bouton "Approuver". Le robot devrait jouer la State F (Approval) si la scène l'a. Click "Approuver" → POST `/api/v2/missions/<planId>/approve-step`.
5. **Asset délivré** : quand `focal_object_ready` arrive avec un type 'report'/'doc'/'brief'/'outline' et status='delivered', `AssetCard` slide-in center stage. Bouton "Ouvrir" → `setMode({mode:'asset'})` + push `/`.
6. **Click bento MissionPanel** : si un `currentPlan` existe, le card devient cliquable (cursor pointer + chevron au hover). Click → bascule sur `/` en mode `mission` avec le plan ID dans le store.
7. **Click bento AssetsPanel** (un asset) : bascule sur `/` en mode `asset` avec l'assetId.
8. **Cmd+K** : ouvre le Commandeur sur `/` (push + setCommandeurOpen).
9. **Cmd+7** : toggle `voiceActive`. La VoicePill bottom-right passe à cyan, label affiche "Connexion…" puis "À l'écoute". Le `<VoicePulse />` monté dans `SpatialRoot` démarre la session OpenAI Realtime. Quand l'utilisateur parle → `audioLevel` monte → l'`Orb` scale pulse en synchro (fallback) ou la variable `pulse` Spline est poussée.
10. **Idle 30s+** : si on ne fait rien pendant 30s, `useSplineIdleAmbient` ramp `idle_intensity` 0 → 0.3 sur 1.5s. Si la scène a la variable bindée à un effet, anim ambient se déclenche.

### Limitations connues

1. **Spline scene not introspected** : aucune validation que les States A..F ou les variables `pulse`/`mood`/`idle_intensity`/`tool_key` existent dans la scène prod. L'agent suppose qu'elles n'existent **pas** et le code est codé pour ne pas planter. Il faut un passage du designer Spline pour brancher l'éditeur.
2. **Tool key mapping limité** : Spline n'a qu'**une key par event keyDown**. Le bridge tool envoie `keyDown('Robot')` (via la state map A..F déjà utilisée par state bridge) puis pousse la `mood='tool:<provider>'` et `tool_key='G/H/I/J'` en variables. Pour des sub-anims tool-spécifiques, le designer doit binder ces variables ou créer un autre objet (`Toolbox` ?) avec ses propres keys.
3. **Mobile responsive partial** : la grille bento bascule en single column sur mobile, mais le robot Spline ne change pas de cadrage (toujours `translate-x-[15%]` desktop). À retravailler en média query si on veut une vraie expérience mobile.
4. **AssetCard z-index** : `FloatingPanel` utilise `position: absolute` sans z explicite, peut overlap avec NotificationBell ou ApprovalAlert. À durcir si conflit visuel.
5. **VoicePulse double-mount** : le composant est singleton via `activePc`/`isStarting` modules-level. Mount sur `/` et `/spatial` simultané est safe en théorie, mais teardown lors d'une nav React 19 strict mode pourrait racer. À surveiller en QA.
6. **CommandBar abort manquant** : pas de bouton stop visible. Pour annuler un run, il faut soit attendre la fin, soit appeler `useRuntimeStore.getState().stopRun()` depuis la console.
7. **Pas de tests Playwright spatial** : module proto luxe, pas couvert.
8. **`KPIBento` placement** : posé en overlay au top-center séparé de la grille bento gauche pour préserver le layout 4×3 existant. Pas un vrai bento de la grille — si Adrien veut le réintégrer dans la grille, il faut bumper la grille à 4 colonnes × 4 rangées et insérer le KPIBento en row 1.
