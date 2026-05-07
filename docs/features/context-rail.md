# Context Rail — `context-rail`

## Métadonnées
| **id** | `context-rail` |
| **statut** | `verrouillé v1.0` |
| **owner** | Adrien |
| **dernière revue** | 2026-05-08 |
| **version spec** | 1.0 |
| **niveau** | P2 |

## Description

Rail droit polymorphe introduit lors du pivot 2026-04-29. Chaque Stage actif (`useStageStore.current.mode`) détermine un sous-rail dédié avec ses propres sections. Il n'y a pas de navigation à onglets ni de composant orchestrateur intermédiaire : le dispatch est un `switch(mode)` direct dans `ContextRail`. Pour les pages admin standalone (`/runs`, `/missions`, `/apps`, `/reports`), le pathname override le mode Stage et affiche un sous-rail contextuel dédié.

Le rail droit est wrappé par `RightPanel` qui gère le responsive drawer mobile (bouton flottant bottom-right + overlay).

## Surface publique

- `app/(user)/components/ContextRail.tsx` — composant principal + tous les sous-rails inline
- `app/(user)/components/RightPanel.tsx` — shell responsive
- `app/(user)/components/ContextRailForMission.tsx` — sous-rail Stage "mission" (fetch dédié)
- `app/(user)/components/ContextRailForAdmin.tsx` — sous-rails pages admin
- `app/(user)/components/right-panel/GeneralDashboard.tsx` — strates 3/4/5 cockpit/chat
- `app/(user)/components/right-panel/useRightPanelData.ts` — hook SSE + fetch données
- `app/(user)/components/right-panel/useRunReportSuggestion.ts` — exécution suggestions
- `app/api/v2/right-panel/route.ts` — snapshot GET
- `app/api/v2/right-panel/stream/route.ts` — SSE live (event `panel`, ping toutes les 25s)
- `lib/ui/right-panel/aggregate.ts` — buildRightPanelData (server-side)
- `lib/ui/right-panel/manifestation.ts` — plans/missions/assets → FocalObject
- `lib/ui/right-panel/objects.ts` — types FocalObject concrets
- `lib/ui/right-panel/types.ts` — types view model RightPanelData

## Types clés
```ts
// lib/ui/right-panel/types.ts
interface RightPanelData {
  currentRun?: RightPanelCurrentRun;
  recentRuns: RightPanelRun[];
  assets: RightPanelAsset[];
  missions: RightPanelMission[];
  reportSuggestions?: RightPanelReportSuggestion[];
  connectorHealth?: RightPanelConnectorHealth;
  scheduler?: RightPanelSchedulerSummary;
  missionOpsSummary?: RightPanelMissionOpsSummary;
  focalObject?: FocalObjectView | Record<string, unknown>;
  secondaryObjects?: (FocalObjectView | Record<string, unknown>)[];
}

interface FocalObjectView {
  objectType: string;   // "report" | "brief" | "doc" | "outline" | "message_draft" |
                        // "message_receipt" | "mission_draft" | "mission_active" |
                        // "watcher_draft" | "watcher_active"
  id: string;
  title: string;
  status: string;       // "composing" | "ready" | "awaiting_approval" | "delivering" |
                        // "delivered" | "active" | "paused" | "failed"
  summary?: string;
  sections?: Array<{ heading?: string; body: string }>;
  primaryAction?: { kind: string; label: string };
  morphTarget?: string | null;
  // ... champs contextuels selon objectType
}
```

## Invariants verrouillés

### I-1. Structure fixe par Stage
Chaque sous-rail rend ses sections **inconditionnellement**, avec empty state interne. Jamais de `{section.length > 0 && <SectionBlock>}` autour d'un bloc complet de section. La silhouette du rail ne doit pas changer selon la présence de données.

### I-2. Dispatch par mode, pas par URL (sauf pages admin)
Le `switch(mode)` dans `ContextRail` est la source de vérité pour les routes cockpit/chat/asset/mission/browser/meeting/kg/voice/simulation/artifact/asset_compare. Les overrides pathname (`/runs`, `/missions`, `/apps`, `/reports`) sont traités **avant** le switch et ont priorité absolue.

### I-3. SSE sur thread actif, fetch parallèle sans thread
`useRightPanelData` : si `activeThreadId` est défini → `EventSource` sur `/api/v2/right-panel/stream?thread_id=`. Si null → double fetch parallel `/api/v2/missions` + `/api/v2/assets`. Les deux branches sont mutuellement exclusives et se reset à chaque changement de `activeThreadId`.

### I-4. SSE cadence et ping
Le stream SSE pousse un event `panel` toutes les **1 000 ms**. Un ping (`:` keepalive) est envoyé toutes les **25 000 ms**. Pas de retry client explicite — EventSource gère la reconnexion native. Pas de TTL côté serveur sur le stream.

### I-5. Manifestation : priorité d'affichage focal
`resolveFocalObject` dans `manifestation.ts` applique cet ordre strict :
1. Plan `awaiting_approval`
2. Plan `executing`
3. Dernier asset (index le plus élevé)
4. Mission active
5. `null` (état idle)

### I-6. Largeur par token
Largeur : `var(--width-context)`. Background : `var(--rail)`. Pas de valeur numérique inline pour la largeur.

### I-7. ContextRailShell : onClose uniquement mobile
Le bouton fermeture dans `ContextRailShell` n'apparaît que si `onClose` est défini (drawer mobile). En desktop, pas de bouton fermeture dans le rail.

### I-8. CockpitChatBody : 5 strates dans l'ordre
Pour les modes `cockpit` et `chat`, la structure est toujours :
1. `SystemServicesRow` (shrink-0)
2. `SystemConstellation` (shrink-0)
3. `GeneralDashboard` strates 3+4+5 (flex-1, overflow-y-auto)
Jamais de réordonnancement ni d'ajout de strate sans mise à jour de spec.

### I-9. ContextRailForMission : fetch point-in-time, pas SSE
`ContextRailForMission` utilise des fetches REST ponctuels (`/api/v2/missions`, `/api/v2/runs?limit=50`) avec filtrage client. Il ne partage pas le SSE de `useRightPanelData`. 5 derniers runs filtrés par `missionId`.

### I-10. Labels statuts en voix régulière FR
Statuts affichés : "En cours" / "Réussi" / "Échec" / "En attente" / "Annulé" / "Actif" / "En pause". Jamais "RUNNING" / "OK" / "FAIL" en mono caps dans le JSX rendu.

### I-11. Sections Section primitive
La primitive `<Section label count>` dans `ContextRail.tsx` est le seul pattern autorisé pour les headers de section du rail droit. Labels en `t-13 font-medium`, compteurs en `t-11 font-mono tabular-nums`. Pas de tracking-display, pas de uppercase forcé.

### I-12. buildRightPanelData : Supabase canonical + fallback mémoire
L'agrégateur server-side tente d'abord Supabase (`getPersistedRuns`, `getPersistedMissions`, `getPersistedAssets`). Si le résultat est vide, fallback vers les stores in-memory. Ne jamais supprimer le fallback mémoire sans migration complète.

## Tests
Existants :
- Aucun test dédié au ContextRail ou useRightPanelData répertorié au 2026-05-08.

Manquants (P0) :
- `resolveFocalObject` : test unitaire des 5 priorités avec fixtures plans/missions/assets
- `manifestPlan` : test des 3 branches (one_shot / mission / monitoring)
- `useRightPanelData` : test SSE branch vs fetch branch selon activeThreadId
- SSE stream : test que l'event `panel` est émis au bon intervalle et que `abort` ferme la connexion
