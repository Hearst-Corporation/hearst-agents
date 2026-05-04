# Stage System — `stage`

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **id** | `stage` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-04 |
| **version spec** | 1.0 |
| **niveau** | **P0** — régression = tous les écrans utilisateur cassés |
| **pivot d'origine** | 2026-04-29 (cockpit polymorphe post-shell 3 colonnes) |

## Description

Système de routing UI central de Hearst OS. Le `Stage` est le conteneur principal qui rend l'un des 11 modes polymorphes (`cockpit`, `chat`, `asset`, `asset_compare`, `mission`, `browser`, `meeting`, `kg`, `voice`, `simulation`, `artifact`) selon l'état du `useStageStore.current`. Chaque mode a son sous-Stage spécialisé (`CockpitStage`, `ChatStage`, etc.) avec sa propre logique de fetch / render. Le système expose aussi `FocalStage` (afficheur d'objets focal en mode compact ou full) et `StageFooter` (barre de statut globale).

Cœur architectural post-pivot 2026-04-29 : remplace l'ancien shell 3 colonnes par un cockpit polymorphe + Stage central + ContextRails dépendants du mode.

## Surface publique

### Conteneurs centraux
- [Stage.tsx](../../app/(user)/components/Stage.tsx) — router pur, switch sur `useStageStore.current.mode`
- [FocalStage.tsx](../../app/(user)/components/FocalStage.tsx) — afficheur read-only d'un `FocalObject` (compact embedded ou full-width)
- [StageFooter.tsx](../../app/(user)/components/StageFooter.tsx) — barre de statut runtime (DotsCluster animé + label flow)
- [stages/StageActionBar.tsx](../../app/(user)/components/stages/StageActionBar.tsx) — barre d'actions cohérente (back / context / primary / secondary / overflow)

### 11 sous-Stages (un par mode)
- [CockpitStage.tsx](../../app/(user)/components/stages/CockpitStage.tsx) → mode `cockpit`
- [ChatStage.tsx](../../app/(user)/components/stages/ChatStage.tsx) → mode `chat`
- [AssetStage.tsx](../../app/(user)/components/stages/AssetStage.tsx) → mode `asset`
- [AssetCompareStage.tsx](../../app/(user)/components/stages/AssetCompareStage.tsx) → mode `asset_compare`
- [MissionStage.tsx](../../app/(user)/components/stages/MissionStage.tsx) → mode `mission`
- [BrowserStage.tsx](../../app/(user)/components/stages/BrowserStage.tsx) → mode `browser`
- [MeetingStage.tsx](../../app/(user)/components/stages/MeetingStage.tsx) → mode `meeting`
- [KnowledgeStage.tsx](../../app/(user)/components/stages/KnowledgeStage.tsx) → mode `kg`
- [VoiceStage.tsx](../../app/(user)/components/stages/VoiceStage.tsx) → mode `voice`
- [SimulationStage.tsx](../../app/(user)/components/stages/SimulationStage.tsx) → mode `simulation`
- [ArtifactStage.tsx](../../app/(user)/components/stages/ArtifactStage.tsx) → mode `artifact`

### Stores
- [stores/stage.ts](../../stores/stage.ts) — état du mode actif + history + commandeur + tool override guard
- [stores/stage-data.ts](../../stores/stage-data.ts) — miroir read-only de l'état des Stages (consommé par les Rails)
- [stores/focal.ts](../../stores/focal.ts) — état du `FocalObject` en cours + secondary history + pin lock

### Types & mappers
- [lib/core/types/focal.ts](../../lib/core/types/focal.ts) — types `FocalObject`, `FocalType`, `FocalStatus` + `mapFocalObject()` (validation universelle)
- [lib/ui/focal-mappers.ts](../../lib/ui/focal-mappers.ts) — `missionToFocal()`, `assetToFocal()` (transformation domaine → focal)

## Architecture interne

### Pattern de routing (`Stage.tsx`)

```ts
function Stage({ messages, onSubmit, hasMessages, initialCockpitData }) {
  const current = useStageStore((s) => s.current);
  switch (current.mode) {
    case "cockpit":      return <CockpitStage initialData={initialCockpitData} />;
    case "chat":         return <ChatStage messages={messages} hasMessages={hasMessages} onSubmit={onSubmit} />;
    case "asset":        return <AssetStage assetId={current.assetId} variantKind={current.variantKind} />;
    case "asset_compare":return <AssetCompareStage assetIdA={current.assetIdA} assetIdB={current.assetIdB} />;
    case "mission":      return <MissionStage missionId={current.missionId} />;
    case "browser":      return <BrowserStage sessionId={current.sessionId} />;
    case "meeting":      return <MeetingStage meetingId={current.meetingId} />;
    case "kg":           return <KnowledgeStage entityId={current.entityId} query={current.query} />;
    case "voice":        return <VoiceStage sessionId={current.sessionId} />;
    case "simulation":   return <SimulationStage />;
    case "artifact":     return <ArtifactStage artifactId={current.artifactId} initialCode={current.code} initialLanguage={current.language} />;
    default:             return null;
  }
}
```

- **Imports statiques** des 11 sous-Stages (pas de `React.lazy`, pas de dynamic) — bundle unique
- **Pas de wrapper d'animation** (pas de Framer Motion, pas de transitions CSS sur changement de mode)
- **Mode invalide → `null`** (le parent est responsable du fallback)

### Discriminated unions (stores/stage.ts)

```ts
type StageMode =
  | "cockpit" | "chat" | "asset" | "asset_compare" | "mission"
  | "browser" | "meeting" | "kg" | "voice" | "simulation" | "artifact";

type StagePayload =
  | { mode: "cockpit" }
  | { mode: "chat"; threadId?: string }
  | { mode: "asset"; assetId: string; variantKind?: string }
  | { mode: "asset_compare"; assetIdA: string; assetIdB: string }
  | { mode: "mission"; missionId: string }
  | { mode: "browser"; sessionId: string }
  | { mode: "meeting"; meetingId: string }
  | { mode: "kg"; entityId?: string; query?: string }
  | { mode: "voice"; sessionId?: string }
  | { mode: "simulation"; scenario?: string }
  | { mode: "artifact"; artifactId?: string; code?: string; language?: "python" | "node" };
```

### Actions du store stage

| Action | Comportement |
|--------|-------------|
| `setMode(payload)` | Met à jour `current`, push history (max 20), update `lastAssetId`/`lastMissionId` si applicable, met `lastManualChangeAt = Date.now()` |
| `setModeFromTool(payload)` | **No-op** si `Date.now() - lastManualChangeAt < TOOL_OVERRIDE_GUARD_MS (10_000)`. Sinon = setMode mais ne touche **pas** à `lastManualChangeAt`. |
| `back()` | Dépile le history (max 20 entries) |
| `reset()` | Goto `cockpit`, clear history |
| `setCommandeurOpen(open, options?)` | Ouvre le Commandeur, peut pré-remplir une `prefilledQuery` (utilisé par MeetingStage → "Créer mission") |
| `consumeCommandeurPrefilledQuery()` | Lit + clear (pattern one-shot) |

### State store stage

```ts
interface StageState {
  current: StagePayload;             // Mode actif
  history: StageEntry[];             // Stack pour back() (max 20)
  lastAssetId: string | null;        // Hotkey ⌘3 re-ouvre asset
  lastMissionId: string | null;      // Hotkey ⌘9 re-ouvre mission
  commandeurOpen: boolean;
  commandeurPrefilledQuery: string | null;
  lastManualChangeAt: number | null;
}
```

**Pas de middleware `persist`**. Chaque mount SPA repart à `{ mode: "cockpit" }`.

**Dev exposure** : `window.__hearstStageStore` exposé en `process.env.NODE_ENV !== "production"`.

### Hotkeys

`STAGE_HOTKEYS` figé (mapping ⌘1..9, ⌘0) — branché via [app/hooks/use-global-hotkeys.ts](../../app/hooks/use-global-hotkeys.ts) et [components/MobileBottomNav.tsx](../../app/(user)/components/MobileBottomNav.tsx).

### Stage-data (miroir pour Rails)

[stores/stage-data.ts](../../stores/stage-data.ts) garde 4 slices :
- `meeting` (`actionItems`, `transcript`, `status`)
- `simulation` (`scenario`, `variables`, `scenarios`, `phase`)
- `asset` (`assetId`, `assetTitle`, `assetSummary`, `assetCreatedAt`, `assetKind`, `variants`)
- `kg` (`graph`, `selectedNode`)

Pattern : chaque sous-Stage écrit son state local via `useEffect` après update interne. Les `ContextRail*` consomment en read-only. **Source de vérité reste dans le sous-Stage**, le store-data est un cache UI.

### Focal store (stores/focal.ts)

```ts
interface FocalObject {
  id: string;
  type: FocalType;       // brief | report | doc | mission_active | etc. (10 valeurs)
  status: FocalStatus;   // ready | awaiting_approval | active | etc. (8 valeurs)
  title: string;
  body?: string;
  summary?: string;
  sections?: { heading?: string; body: string }[];
  createdAt: number;
  updatedAt: number;
  threadId?: string;
  sourcePlanId?: string;   // si dérivé d'un plan
  sourceAssetId?: string;  // si preview asset
  missionId?: string;      // pour pause/resume
  primaryAction?: { kind: string; label: string };
  // … cf lib/core/types/focal.ts
}

interface FocalState {
  focal: FocalObject | null;
  secondary: FocalObject[];      // Historique max 3
  isFocused: boolean;
  hasContent: boolean;
  isVisible: boolean;            // FocalStage plein écran
  pinnedFocalKey: string | null; // sourceAssetId ?? missionId ?? null
}
```

**Pin lock (Phase C3)** : tant que `pinnedFocalKey != null`, `hydrateThreadState()` (appelé par SSE poll) **ne remplace pas** le focal pinné, sauf si le nouveau match le pin (auquel cas update du contenu seulement). Remplace l'ancien timer 30s, plus robuste contre les races SSE.

**`isValidContent()`** : filtre des patterns d'erreur connus (`"Aucun email trouvé"`, `"Accès non autorisé"`, etc.). Empêche la pollution de FocalStage avec des erreurs API qui se sont mal propagées.

### Mappers focal

`mapFocalObject(obj, fallbackThreadId)` ([lib/core/types/focal.ts](../../lib/core/types/focal.ts)) :
- Validation universelle de tout objet API
- Fallbacks : `type` invalide → `"brief"`, `status` invalide → `"ready"`, body manquant → fallback summary ou première section, timestamp manquant → `Date.now()`, ID manquant → `focal-{ts}`

`missionToFocal()`, `assetToFocal()` ([lib/ui/focal-mappers.ts](../../lib/ui/focal-mappers.ts)) :
- Transformation domaine → focal (mission active vs draft, asset vers report/brief/doc/message_receipt)

### Stores Zustand consommés (par les sous-Stages)

| Sous-Stage | Stores |
|-----------|--------|
| CockpitStage | (pur client state, pas de store) |
| ChatStage | focal, navigation, runtime, working-document |
| AssetStage | stage, stage-data |
| AssetCompareStage | stage |
| MissionStage | stage, runtime |
| BrowserStage | stage |
| KnowledgeStage | stage, navigation, stage-data |
| VoiceStage | stage, voice |
| MeetingStage | stage, stage-data |
| SimulationStage | stage, stage-data |
| ArtifactStage | stage |

### Endpoints API (par sous-Stage)

| Sous-Stage | Endpoints |
|-----------|-----------|
| CockpitStage | `GET /api/v2/cockpit/today` |
| ChatStage | (délègue à ChatMessages — voir feature `chat`) |
| AssetStage | `GET /api/v2/assets/{id}`, `GET /api/v2/assets/{id}/variants`, `POST /api/reports/{id}/rerun`, `POST /api/reports/share`, `DELETE /api/v2/assets/{id}`, `POST /api/reports/{id}/export` |
| AssetCompareStage | `GET /api/v2/assets/{a}` + `{b}`, `POST /api/v2/assets/diff` |
| MissionStage | `GET/PATCH/POST/DELETE /api/v2/missions[/{id}]`, `GET /api/v2/runs?limit=50`, custom event `mission:edit` |
| BrowserStage | `POST /api/v2/browser/start`, `GET/DELETE /api/v2/browser/{id}`, `POST /api/v2/browser/{id}/take-over|capture|extract`, SSE `/api/admin/events-stream` |
| KnowledgeStage | `GET /api/v2/kg/graph`, `POST /api/v2/kg/ingest`, `GET /api/v2/kg/search`, `GET /api/v2/kg/path` |
| VoiceStage | (WebRTC géré dans VoicePulse, pas d'endpoint direct) |
| MeetingStage | `POST/GET/DELETE /api/v2/meetings[/{id}]` |
| SimulationStage | `POST /api/v2/simulations/start` |
| ArtifactStage | `GET /api/v2/assets/{id}`, `GET /api/v2/assets/{id}/variants`, `POST /api/v2/jobs/code-exec`, `GET /api/v2/jobs/{id}/status` |

## Data flow (mode change)

```
[user action: setMode(payload)]
   ↓ stores/stage.ts
   ├─ check: aucun guard tool override (user prend priorité)
   ├─ history.push(current); cap 20 (FIFO)
   ├─ if mode==="asset" → lastAssetId = payload.assetId
   ├─ if mode==="mission" → lastMissionId = payload.missionId
   ├─ lastManualChangeAt = Date.now()
   └─ current = payload
   ↓
[Stage.tsx re-render via useStageStore selector]
   ↓ switch(current.mode)
   ↓
[<XxxStage> avec props extraites du payload]
   ↓
[sous-Stage fetch sa data, render, écrit dans stage-data]
```

```
[tool/agent action: setModeFromTool(payload)]
   ↓ guard: now - lastManualChangeAt < 10_000 ?
   ├─ oui → no-op (l'utilisateur a la priorité)
   └─ non → setMode(payload) MAIS sans toucher lastManualChangeAt
```

## Invariants verrouillés

Toute modification d'un point ci-dessous **exige une mise à jour de cette spec validée par Adrien**.

### I-1. `StageMode` discriminated union — 11 modes figés

Liste exhaustive : `cockpit`, `chat`, `asset`, `asset_compare`, `mission`, `browser`, `meeting`, `kg`, `voice`, `simulation`, `artifact`.

Ajouter un mode = update spec + ajouter un cas dans `Stage.tsx` switch + ajouter un sous-Stage. Renommer ou supprimer un mode = update spec.

### I-2. `Stage.tsx` est l'**unique** router

Pas de fork `StageV2`, pas de routing alternatif via React Router ou autre. Le composant `<Stage>` reste le seul point d'entrée pour rendre un mode.

`default: return null` reste la stratégie d'erreur (mode invalide = rendu vide, jamais throw).

### I-3. Tool override guard 10s

`setModeFromTool()` doit rester no-op si `Date.now() - lastManualChangeAt < 10_000`. Cette protection empêche un agent de "téléporter" l'utilisateur juste après une action manuelle.

Constante : `TOOL_OVERRIDE_GUARD_MS = 10_000`. Ne pas réduire sans validation explicite.

`setMode()` (user-initiated) **doit** mettre à jour `lastManualChangeAt`. `setModeFromTool()` (tool-initiated) **ne doit pas** y toucher.

### I-4. History stack max 20, FIFO

`back()` consomme un history stack capped à 20 entries. Si tu touches à cette logique, vérifie que les tests `__tests__/stores/stage.test.ts` passent toujours.

### I-5. No persistence

Le store stage **n'a pas** de middleware `persist`. Chaque mount SPA repart à `{ mode: "cockpit" }`. Si un jour tu veux deeplink (URL ↔ mode), c'est une décision spec qui exige update + plan de migration des hotkeys.

### I-6. `lastAssetId` / `lastMissionId` mis à jour automatiquement

À chaque `setMode("asset", { assetId })` ou `setMode("mission", { missionId })`, ces champs **doivent** être mis à jour. Les hotkeys ⌘3 / ⌘9 et le `Commandeur` en dépendent.

### I-7. Pin-based focal lock

`pinnedFocalKey = focal.sourceAssetId ?? focal.missionId ?? null`. Tant qu'un pin est actif, `hydrateThreadState()` ne remplace pas le focal sauf si le nouveau focal match le pin (update contenu seulement).

Ne pas réintroduire de timer 30s ou autre mécanisme alternatif sans update spec.

### I-8. `isValidContent()` filtre les patterns d'erreur

La fonction privée du store focal qui rejette `"Aucun email trouvé"`, `"Accès non autorisé"`, etc. **doit** rester active. Sa liste peut être étendue (ajout de patterns) — mais retirer un pattern = update spec, pour éviter de réouvrir le canal de pollution.

### I-9. Stage-data mirror pattern

Chaque sous-Stage qui a un état persistant entre re-renders (asset, meeting, kg, simulation) **doit** écrire son snapshot dans `useStageData` via `useEffect`. C'est ce que les `ContextRail*` lisent en read-only.

Source de vérité reste **dans le sous-Stage**, pas dans stage-data. Inverser la dépendance = update spec.

### I-10. STAGE_HOTKEYS figé

Mapping ⌘0..9 → modes figé. Tout changement (ajout, retrait, remap) = update spec + sync `use-global-hotkeys.ts` + `MobileBottomNav.tsx`.

### I-11. `mapFocalObject()` est l'**unique** validateur d'objets focal

Tout objet focal venant d'une API ou d'un store passe par `mapFocalObject()` avant injection dans `useFocalStore`. Pas de bypass (pas de `setFocal({...} as FocalObject)` direct sans validation).

### I-12. Format `FocalObject`

10 types figés (`message_draft`, `message_receipt`, `brief`, `outline`, `report`, `doc`, `watcher_draft`, `watcher_active`, `mission_draft`, `mission_active`).
8 statuts figés (`composing`, `ready`, `awaiting_approval`, `delivering`, `delivered`, `active`, `paused`, `failed`).

Ajouter un type/statut = update spec + update mapper + update FocalContent rendering.

### I-13. Bundle statique des 11 sous-Stages

Choix conscient : pas de code splitting, pas de `React.lazy`. Si ce choix change (perf, Core Web Vitals), update spec.

### I-14. Pas d'animation wrappers

Pas de Framer Motion, pas de transitions CSS sur changement de mode. Si tu veux ajouter (ex: fade), update spec.

### I-15. Cytoscape `ssr: false`

`KnowledgeStage` utilise `dynamic(() => import("react-cytoscapejs"), { ssr: false })`. C'est la **seule** exception au "bundle statique". Cytoscape est WebGL-incompatible avec SSR — ne pas tenter de l'inclure dans le bundle statique.

## Évolutions autorisées sans spec

- Ajout d'un nouveau type/statut focal **dans la liste des fallbacks** de `mapFocalObject()` (mais pas dans les types officiels — ça reste invariant)
- Polish CSS / spacing / tokens dans n'importe quel sous-Stage
- Ajout d'un endpoint consommé par un sous-Stage (extension de scope, pas modification structurelle)
- Refactor interne d'un sous-Stage (split en sous-composants, extract primitives) tant que les props publiques restent identiques
- Ajout d'un test
- Ajout d'un nouveau pattern d'erreur dans `isValidContent()`
- Câblage d'orphelins (composants UI préfetched non encore rendus)
- Ajout d'une variante mineure dans `stage-data` (ex: nouveau champ dans une slice existante) tant qu'elle reste optionnelle pour les consommateurs

## Risques & modes de défaillance

| Risque | Impact | Mitigation actuelle |
|--------|--------|---------------------|
| Mode invalide arrive (corrupted state, tool malicieux) | Rendu vide (white screen) | `default: return null` ; pas de throw ; user peut faire `back()` ou `reset()` |
| Tool override guard contourné (un dev appelle `setMode` au lieu de `setModeFromTool`) | Téléportation user non sollicitée | Aucune mitigation — discipline appel + code review |
| Pin lock bloqué (focal pinné mais source disparaît) | Focal stale | `clearFocal()` libère le pin manuellement ; pas de TTL automatique |
| `stage-data` désync vs sous-Stage | Rails affichent données obsolètes | `useEffect` doit fire à chaque update — discipline ; pas de mécanisme de réconciliation |
| History overflow | Aucun (cap 20 FIFO) | Acceptable, pas de mitigation |
| Mount re-init à `cockpit` | Perte du contexte mode au refresh | Choix conscient (pas de persist) — deeplinking serait une feature à part |
| Cytoscape lourd au chargement de KnowledgeStage | First paint lent sur ce mode | `ssr: false` + dynamic — acceptable, mode peu fréquent |
| isValidContent filtre trop large | Vrais focals legitimes rejetés | Liste de patterns conservatrice ; ajouter un pattern reste possible |
| Race condition `hydrateThreadState` (SSE) vs `setFocal` (user) | Pin lock résout, mais edge cases possibles | Pin lock plus robuste que l'ancien timer 30s |

## Tests

### Existants
- [`__tests__/stores/stage.test.ts`](../../__tests__/stores/stage.test.ts) — `setModeFromTool` guard 10s, history stack max 20 FIFO, `lastAssetId`/`lastMissionId` persistance, `lastManualChangeAt` non touché par tool calls, hotkeys mapping
- [`__tests__/stores/focal.test.ts`](../../__tests__/stores/focal.test.ts) — focal store de base (présence)

### Manquants (gap élevé — feature P0 critique)

**Stage routing** :
- Test que `Stage.tsx` rend le bon sous-composant pour chaque mode (11 cas)
- Test que mode invalide rend `null` sans throw
- Test que `initialCockpitData` est bien propagé à `CockpitStage`

**Focal store** :
- Test du pin lock : `pinnedFocalKey` empêche `hydrateThreadState` de remplacer
- Test que `clearFocal()` libère le pin
- Test que nouveau focal matchant le pin update le contenu
- Test `isValidContent()` rejette tous les patterns d'erreur listés
- Test `secondary` historique max 3 FIFO

**Mappers** :
- Test `mapFocalObject()` validation : type invalide → fallback "brief", status → "ready"
- Test fallbacks body / summary / sections
- Test ID manquant → `focal-{ts}`
- Test `missionToFocal()` mapping enabled/disabled, statuses
- Test `assetToFocal()` mapping ASSET_TYPE_MAP

**FocalStage** :
- Test mode `compact` (height fixe, embedded ChatStage)
- Test mode `full` (max-w-4xl centered)
- Test absence focal en compact → `null`
- Test absence focal en full → spinner "Waiting_For_Data"
- Test action primaire (approve, pause, resume, retry) avec mock fetch

**Sous-Stages individuels** :
- Aucun test unitaire dans `__tests__/components/stages/` actuellement
- Au minimum : smoke test rendu par mode, mock des stores, verify pas de crash

**Stage-data** :
- Test que chaque sous-Stage écrit bien dans la slice attendue
- Test que `setMeeting`, `setSimulation`, `setAsset`, `setKg` mergent correctement

**Hotkeys** :
- Test que ⌘0..9 trigger les bons modes via `STAGE_HOTKEYS`
- Test que `MobileBottomNav` mappe les bons modes

**Tool override** :
- E2E : user fait setMode → 5s plus tard tool fait setModeFromTool → no-op
- E2E : 11s plus tard tool fait setModeFromTool → applique

## Code orphelin (code-ready non câblé)

Aucun à ce jour côté Stage System. Les 11 sous-Stages sont tous câblés et atteignables via `setMode()`.

`CockpitHero.tsx` (codé mais non importé dans `CockpitHome`) est tracé dans la spec [cockpit.md](cockpit.md), pas ici.

## Notes & historique

- **Pivot 2026-04-29** — passage shell 3 colonnes → cockpit polymorphe + Stage central + ContextRails dépendants du mode
- **Phase C3** — pin-based focal lock remplace timer 30s (plus robuste contre SSE races)
- **Phase C5** — RSC prefetch CockpitTodayPayload via `initialCockpitData` prop, sync client au mount du sous-Stage
- **Refonte AssetStage 2026-04-29** — fetch direct `/api/v2/assets/[id]`, plus de délégation FocalStage
- **Tool override guard** ajouté après incidents de "téléportation" (agents qui changent de mode pendant que l'utilisateur travaille)
- **`isValidContent()`** filtre étendu progressivement à mesure que de nouveaux patterns d'erreur API ont été observés
