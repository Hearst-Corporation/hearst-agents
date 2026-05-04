# Right Panel Dashboard — Spec

> **Statut** : Phase 2 — spec en validation. Pas de code avant validation Adrien.
> **Date** : 2026-05-04 (révisée après pivot Niveau 2 — visualisation système 3D)
> **Scope** : refonte du ContextRail en mode `cockpit` et `chat`. Les sub-rails Stage (asset / mission / browser / meeting / kg / voice / simulation / artifact / asset_compare) et admin (runs / missions / apps / reports) ne sont **pas** touchés par cette spec.

## 1. Objectif

Transformer le panneau droit en **observatoire système** premium : on voit l'OS travailler en temps réel, on agit dessus, on comprend ce qui se passe. Pas un menu, pas une barre latérale décorative.

Aujourd'hui (5 zones) : Now / Today / Recent activity / Suggestion + 6 quick tiles.

Cible (5 strates verticales) :
- **Strate 1 — Services sollicités** *(haut)* — 3D des services Composio qui apparaissent au tool_call
- **Strate 2 — Constellation système** *(haut-milieu)* — 6 rôles agents en lentille sur les phases d'exécution réelles, connexions visibles entre rôles co-actifs
- **Strate 3 — Actions rapides** — 4 CTA sobres
- **Strate 4 — Statut** — état live + alerte + dernière activité
- **Strate 5 — Contexte sélectionné** *(bas)* — change selon ce qu'on regarde / ce qu'on a sélectionné

## 2. Pattern d'interaction (Option C hybride, validée 2026-05-04)

| Surface active | Comportement Strate 5 |
|---|---|
| Cockpit (mode `cockpit`) | **Select-then-act** : clic sur un rôle dans la Strate 2 (constellation) ou sur une mission/asset dans le KPIStrip / agenda du centre alimente `useSelectionStore`. Strate 5 affiche le contexte. Pas de switch Stage automatique. |
| Chat (mode `chat`) | **Context-follows-nav** : Strate 5 lit `useFocalStore.focal` (asset/mission/report/brief actif du thread). |

Le switch Stage explicite reste : bouton `Ouvrir →` dans la Strate 5, hotkey ⌘1-9, Commandeur Cmd+K.

## 3. Lentille honnête — 6 rôles ↔ phases d'exécution

Décision validée 2026-05-04 (Niveau 2). Les 6 "agents" sont une **projection sémantique** des events SSE de l'orchestrateur unique, pas un système multi-agents. Documentation obligatoire.

| Rôle | Phase / event source | Mapping concret |
|---|---|---|
| `pilot` | Exécution actions externes (Composio writes) | tool_call sur `*_SEND`, `*_CREATE`, `*_UPDATE` (Slack send, Linear create, Notion write, Gmail send, etc.) |
| `scribe` | Research / draft / report | step_started avec capability `research` ; asset_generated kind=report ; text_delta volumineux |
| `delve` | Retrieval / RAG / Composio reads | tool_call sur `*_SEARCH`, `*_LIST`, `*_GET` (Gmail search, Drive list, HubSpot search) ; events retrieval/* |
| `cortex` | Knowledge Graph | events `kg_*` (kg/graph, kg/ingest, kg/search, kg/path, kg/timeline) |
| `pulse` | Notifications / monitoring | events watchlist anomaly, briefing, notifications realtime ; `useNotificationsStore` updates |
| `warden` | Auth / permissions / quotas | events 401 / 402 / 403 ; `request_connection` ; auth scope errors ; payment_required |

**Ligne entre 2 rôles** : tracée quand 2 phases sont actives **dans la même run** (même `runId`) à intervalle ≤ 2s. Exemple concret : research (scribe) + KG ingest (cortex) dans une run de rapport → ligne scribe↔cortex pulse 2s puis fade.

**Aucune ligne décorative** : si pas de co-activation réelle, pas de ligne. C'est la règle d'honnêteté.

## 4. Structure du panneau (verticale, ~280px largeur)

```
┌───────────────────────────────────┐
│  STRATE 1 — Services sollicités     │  ~12% h, 56px min
│  3D row : [G·Slack·Lin·Notion·Stripe·HubSpot] │  fade-in/out 800ms après tool_call
├───────────────────────────────────┤
│                                     │
│  STRATE 2 — Constellation système    │  ~28% h
│  6 rôles en cercle ou disposition    │
│  fixe, lignes inter-rôles co-actifs  │
│                                     │
├───────────────────────────────────┤
│  STRATE 3 — Actions rapides           │  ~14% h
│  · Nouvelle mission                   │
│  · Nouveau rapport                    │
│  · Ajouter une source                 │
│  · Lancer analyse                     │
├───────────────────────────────────┤
│  STRATE 4 — Statut                    │  ~16% h
│  · État + heure                       │
│  · Session active (si présente)       │
│  · Alerte (si présente)               │
│  · Dernière activité (1 ligne)        │
├───────────────────────────────────┤
│  STRATE 5 — Contexte sélectionné       │  ~30% h, flex-1
│  Cockpit : objet sélectionné           │
│  Chat    : focal du thread             │
│  Empty   : "Sélectionne un objet"      │
└───────────────────────────────────┘
```

Une seule colonne, scroll uniquement dans Strate 5 si débordement.

## 5. Strates détaillées

### Strate 1 — Services sollicités

**Composant** : `<SystemServicesRow>` (nouveau, R3F + dynamic ssr:false).

Représentation 3D **discrète** : bandeau horizontal scroll x si débordement. Chaque service = une primitive 3D légère (sphère ou cube de 24×24px) avec le logo monochrome devant. Quand un `tool_call` est émis pour un service :
- Le service **apparaît** (fade-in 200ms) si pas déjà présent
- **Pulse** 800ms (scale 1.05 → 1.0)
- Reste visible 30s puis fade-out (sauf si re-sollicité)

Lecture : `useRuntimeStore.events` filtré sur events `tool_call` + extraction service via mapping `tool_name` → `service_id` (table de correspondance dans `lib/cockpit/agents.ts`).

Empty state : barre vide, hauteur préservée. Hint mute : "Aucun service sollicité"

Performance : R3F single canvas, BufferGeometry réutilisée, max 8 services visibles simultanément.

### Strate 2 — Constellation système

**Composant** : `<SystemConstellation>` (nouveau, R3F + dynamic ssr:false).

6 nodes (= les 6 rôles) disposés en cercle ou en hexagone fixe. Chaque node = primitive 3D simple (icosaèdre low-poly, ~32 faces). Position **fixe**, pas de mouvement parasite.

États par node :
- **Idle** : couleur `--text-faint`, scale 1.0, respiration douce ±2% sur 4s
- **Active** (rôle en cours) : couleur `--cykan`, scale 1.08, glow émissif léger (intensité tirée de `--cykan`, pas hardcodée)
- **Ligne inter-nodes** : tracée uniquement quand 2 nodes co-actifs dans la même run, hairline 1px, opacité 0.6 → 0 sur 2s

Click sur un node : `useSelectionStore.select({ kind: "agent", id: nodeId })` → Strate 5 affiche fiche rôle + actions associées (cf. §6).

Lecture : `useRuntimeStore.events` SSE → mapping events → rôle actif (table dans `lib/cockpit/agents.ts`).

Performance : R3F single canvas, partagé avec Strate 1 si possible. Frame rate cap à 30fps en idle, 60fps si activité détectée. Auto-pause si tab pas focus.

### Strate 3 — Actions rapides

4 boutons `<Action variant="ghost" tone="neutral" size="md">`, alignés verticalement, séparés par `var(--space-2)`. Texte gauche + chevron droit, pas de tile, pas de halo.

| Label | Câblage |
|---|---|
| Nouvelle mission | `router.push("/missions/builder")` |
| Nouveau rapport | `router.push("/reports")` |
| Ajouter une source | `router.push("/apps")` |
| Lancer analyse | `useStageStore.setCommandeurOpen(true, { prefilledQuery: "Analyser " })` |

États : default / hover (`--text`) / active (scale 0.98) / focus-visible (ring `--cykan` 1px).

### Strate 4 — Statut

4 lignes max, ligne par ligne. Empty state interne par ligne (jamais skip).

| Ligne | Contenu | Source |
|---|---|---|
| ① État | `BulletDot tone="cykan" pulse` + label voix régulière FR + heure | `useRuntimeStore.coreState` + clock 30s |
| ② Session | "voice / browser / meeting / mission" + label + bouton `Ouvrir →` | `useVoiceStore.voiceActive` + `useStageStore.mode` + `runningMissions[0]` |
| ③ Alerte | 1 notification ≥ warn (ou empty hint "Aucune alerte") | `useNotificationsStore.notifications.filter(level: warn/error)[0]` |
| ④ Dernière activité | 1 ligne : asset généré OU mission run terminée la plus récente | `useRuntimeStore.events` + `useRightPanelData.assets` |

Voix éditoriale FR :
- `idle` → "En ligne" / `streaming` → "En cours" / `processing` → "Traitement" / `awaiting_approval` → "Validation requise" / `awaiting_clarification` → "Précision requise" / `error` → "Erreur"

### Strate 5 — Contexte sélectionné

Header de zone : label `Contexte` t-13 medium + bouton `×` pour clear si selection active.

#### En mode `cockpit`

Lit `useSelectionStore.current`. 5 vues possibles :

| kind | Contenu affiché | Action primaire |
|---|---|---|
| `agent` | nom rôle + tagline (ex: "Pilot — exécute tes actions externes") + 2 derniers events SSE liés à ce rôle | `Ouvrir →` selon rôle (pilot → /missions, scribe → /reports, delve → /apps, cortex → kg stage, pulse → notifications, warden → /apps#auth) |
| `mission` | nom + opsStatus + lastRunAt + summary | `Ouvrir →` → `setMode({ mode: "mission", missionId })` |
| `asset` | nom + kind + createdAt + provider | `Ouvrir →` → `setMode({ mode: "asset", assetId })` |
| `report` | nom + specId + dernier run | `Ouvrir →` → `setMode({ mode: "chat", threadId })` |
| `null` | empty hint : "Sélectionne un rôle ou un objet pour voir son contexte" | — |

#### En mode `chat`

Lit `useFocalStore.focal`. Si focal présent : affiche infos selon `FocalType`. Si null : "Aucun focal actif sur ce thread".

## 6. Triggers — mapping complet

| Trigger | Source | Effet |
|---|---|---|
| Click rôle dans constellation | `<SystemConstellation>` onClick | `useSelectionStore.select({ kind: "agent", id })`. Aucun side-effect Stage. |
| Click mission dans CockpitHome | KPIStrip ou agenda | `useSelectionStore.select({ kind: "mission", id })` |
| Click asset dans CockpitHome | (à câbler — actuellement KPIStrip clic = navigation /assets) | `useSelectionStore.select({ kind: "asset", id })` |
| Click action Strate 3 | `<Action>` onClick | `router.push()` ou `setCommandeurOpen()` selon action |
| Click `Ouvrir →` Strate 5 | bouton dédié | `setMode()` ou `router.push()` selon kind |
| Click `×` Strate 5 | bouton dédié | `useSelectionStore.clear()` |
| Hotkey ⌘1-9 | `STAGE_HOTKEYS` global | `setMode()` (inchangé) |
| Cmd+K Commandeur | [Commandeur.tsx](../../app/(user)/components/Commandeur.tsx) | inchangé |
| Changement Stage cockpit→autre | `useStageStore.setMode()` | Strates 1+2 toujours rendues (utiles cross-mode) ; Strate 5 bascule cockpit→chat ou autre logique |
| SSE `tool_call` | `useRuntimeStore.events` | Strate 1 : service apparaît + pulse. Strate 2 : rôle correspondant pulse. |
| SSE `step_started` / `step_completed` | idem | Strate 2 : rôle pulse selon mapping. |
| SSE `asset_generated` | idem | Strate 4 ligne ④ refresh. Si correspond à `useSelectionStore.current` → enrichit Strate 5. |
| Notification realtime | `useNotificationsStore` | Strate 4 ligne ③ refresh. |

## 7. Nouveaux fichiers

### `stores/selection.ts`
```ts
type SelectionKind = "agent" | "mission" | "asset" | "report";
interface Selection {
  kind: SelectionKind;
  id: string;
  label?: string;
  meta?: Record<string, unknown>;
}
interface SelectionState {
  current: Selection | null;
  select: (sel: Selection) => void;
  clear: () => void;
}
```
~50 lignes, pas de persistance, pas de SSE direct.

### `lib/cockpit/agents.ts`
Single source of truth pour la lentille rôles ↔ events.
```ts
export const AGENT_ROLES = ["pilot", "scribe", "delve", "pulse", "warden", "cortex"] as const;

export const AGENT_METADATA: Record<AgentRoleId, AgentMeta> = {
  pilot: { label: "Pilot", tagline: "Exécute tes actions externes", openTarget: { kind: "route", path: "/missions" } },
  // ...
};

// Event SSE → rôle actif
export function deriveActiveRolesFromEvents(events: StreamEvent[]): AgentRoleId[] { ... }

// tool_name → service id
export function mapToolToService(toolName: string): ServiceId | null { ... }
```

### `app/(user)/components/right-panel/SystemConstellation.tsx`
R3F canvas. ~150 lignes. Reads `useRuntimeStore.events`. ErrorBoundary local (R3F crash ne casse pas le rail).

### `app/(user)/components/right-panel/SystemServicesRow.tsx`
R3F + logos services. ~100 lignes.

## 8. Fichiers modifiés

- [app/(user)/components/right-panel/GeneralDashboard.tsx](../../app/(user)/components/right-panel/GeneralDashboard.tsx) — refonte complète : 5 strates au lieu des 4 sections actuelles
- [app/(user)/components/ContextRail.tsx](../../app/(user)/components/ContextRail.tsx) — `CockpitChatBody` : retrait des 6 quick tiles bas (déplacés en Strate 3 avec libellés différents)

**Pas modifié** :
- [app/(user)/components/cockpit/HearstLogo3D.tsx](../../app/(user)/components/cockpit/HearstLogo3D.tsx) — invariant I-6 préservé, le H 3D reste hero du Stage cockpit
- [app/(user)/components/cockpit/HaloAgentCore.tsx](../../app/(user)/components/cockpit/HaloAgentCore.tsx) — orphelin depuis pivot 1.2, on **ne le câble pas** dans cette spec (pourra être supprimé plus tard)
- [app/(user)/components/cockpit/CockpitHome.tsx](../../app/(user)/components/cockpit/CockpitHome.tsx) — inchangé
- Stores existants ([stage.ts](../../stores/stage.ts), [focal.ts](../../stores/focal.ts), etc.)
- Le pipeline IA, les routes API, les schémas DB

## 9. Données connectées

Toutes déjà disponibles, zéro nouveau endpoint :

| Donnée | Source |
|---|---|
| `coreState` | `useRuntimeStore.coreState` |
| Heure live | `setInterval(30s)` local |
| Session active | `useVoiceStore.voiceActive` + `useStageStore.mode` + `useRightPanelData.missions` |
| Notifications | `useNotificationsStore.notifications` |
| Assets récents | `useRightPanelData.assets` |
| Missions actives | `useRightPanelData.missions` |
| Events SSE temps réel | `useRuntimeStore.events` |
| Focal (mode chat) | `useFocalStore.focal` |
| Sélection (mode cockpit) | `useSelectionStore.current` (nouveau) |
| Mapping rôles ↔ events | constants `lib/cockpit/agents.ts` (nouveau) |

## 10. États UI

| État | Strate 1 | Strate 2 | Strate 3 | Strate 4 | Strate 5 |
|---|---|---|---|---|---|
| **Loading** | barre vide | nodes idle | CTA actifs | skeleton 1 ligne par row | skeleton 3 lignes |
| **Empty** | "Aucun service" | nodes idle (état nominal) | n/a | "Aucune alerte" / "Pas d'activité" | "Sélectionne un rôle ou un objet" |
| **Error R3F** | fallback ASCII row (mute) | fallback grid 6 puces typo | n/a | n/a | n/a |
| **Hover** | service tooltip | node tooltip | texte → `--text` | n/a | item underline |
| **Focus** | n/a | ring sur node sélectionné | ring 1px `--cykan` | n/a | ring sur boutons |
| **Mobile** | hors scope (rail caché < lg) | idem | idem | idem | idem |
| **Tab pas focus** | canvas pause | canvas pause | n/a | clock pause | n/a |

## 11. Critères d'acceptation

1. Rail droit en mode `cockpit` ou `chat` affiche les **5 strates** dans l'ordre.
2. **Strate 1** : un `tool_call` SSE fait apparaître le service correspondant en moins de 200ms.
3. **Strate 2** : un événement mappé à un rôle fait pulser ce rôle pendant 800ms ; la couleur revient à idle après inactivité.
4. **Strate 2** : ligne entre 2 rôles tracée uniquement si co-activation réelle dans la même `runId`. Vérifié par test unit sur `deriveActiveRolesFromEvents()`.
5. Click sur un rôle dans constellation : `useSelectionStore.current.kind === "agent"` ; mode Stage **inchangé**.
6. Click `Ouvrir →` Strate 5 : navigue selon le mapping rôle → target.
7. Click `×` Strate 5 : `useSelectionStore.current === null`, empty hint visible.
8. Mode `chat` : Strate 5 reflète `useFocalStore.focal` ; `useSelectionStore` ignoré.
9. Strate 3 contient exactement 4 actions, dans l'ordre.
10. Strate 4 affiche toujours 4 lignes, empty state interne.
11. Voix éditoriale FR appliquée partout.
12. Tokens uniquement, lint visuel pass.
13. R3F : canvas pause si tab pas focus, frame rate cap respecté, ErrorBoundary isole les crash.
14. Aucun fichier hors §8 modifié.
15. Aucune modification backend, aucune nouvelle route API.
16. `pinnedFocalKey` non régressé.

## 12. Tests à lancer

**Bloquants** :
- `npx tsc --noEmit`
- `npm run lint` (eslint + lint:visual)
- Test unit `__tests__/cockpit/agents.test.ts` — `deriveActiveRolesFromEvents()` + `mapToolToService()` (à créer)
- Test unit `__tests__/stores/selection.test.ts` — store transitions (à créer)
- Capture Playwright manuelle cockpit + chat dashboard (avant/après)

**Optionnels recommandés** :
- `e2e/right-panel-dashboard.spec.ts` — login → cockpit → simule SSE event → vérifie strate active + selection flow
- Visual regression Playwright sur les 5 strates

## 13. Risques / décisions à confirmer avant Phase 3

1. **Cockpit verrouillé v1.2** ([docs/features/cockpit.md](../features/cockpit.md)) — la spec actuelle ne touche **pas** au hero 3D ni aux composants cockpit câblés (CockpitHome, KPIStrip, etc.). Donc invariants I-1 à I-7 préservés. **Aucun bump de version cockpit nécessaire**, sauf si on décide finalement de câbler des clics depuis le KPIStrip ou l'agenda vers `useSelectionStore` — auquel cas update spec cockpit obligatoire.

2. **Performance R3F dans un rail 280px** — non vérifiée. Risque : 2 canvas R3F (Strates 1+2) + le H 3D dans le centre = 3 canvas WebGL simultanés. À tester avant merge. Mitigation : fusion Strates 1+2 en un seul canvas, frame rate cap, fallback HTML/SVG si lighthouse score < seuil.

3. **Mapping events → rôles** — `lib/cockpit/agents.ts` doit être exhaustif et testé. Risque : un event non mappé → aucun rôle ne pulse → utilisateur croit que l'OS ne fait rien. Mitigation : log dev en `unmappedEventTypes`, alimente une todo de mapping continue.

4. **Suppression des 6 quick tiles bas** : décision finale prise — tiles supprimés. L'accès aux fonctions reste via Cmd+K + hotkeys ⌘1-9 + Strate 3 actions.

5. **HaloAgentCore orphelin** ([HaloAgentCore.tsx](../../app/(user)/components/cockpit/HaloAgentCore.tsx)) — non câblé depuis pivot 1.2, et cette spec ne le câble pas. À supprimer dans une PR séparée si Adrien valide qu'on n'y revient pas.

6. **Sélection persistée cross-mode** : oui (store en mémoire, pas persisté disk). Si user sélectionne agent puis switch mode, sélection préservée pour son retour cockpit. Reset au reload SPA.

## 14. Plan d'implémentation (Phase 3)

1. **Stores** — `stores/selection.ts`.
2. **Mapping rôles ↔ events** — `lib/cockpit/agents.ts` + tests unit.
3. **R3F primitives** — `SystemConstellation.tsx` + `SystemServicesRow.tsx` (fusion canvas si possible).
4. **GeneralDashboard refonte** — 5 strates dans l'ordre.
5. **Retrait quick tiles** dans `ContextRail.CockpitChatBody`.
6. **Tests + lint + tsc + screenshots**.
7. **Validation visuelle** Adrien sur Playwright captures cockpit + chat.

Chaque step → commit séparé, message FR Conventional Commits.

---

## Historique

| Date | Événement |
|---|---|
| 2026-05-04 | Phase 1 analyse — mapping triggers, stores, APIs |
| 2026-05-04 | Décision Option C (hybride select-then-act au cockpit, context-follows-nav ailleurs) |
| 2026-05-04 | Décision Niveau 2 — lentille honnête 6 rôles ↔ phases d'exécution réelles |
| 2026-05-04 | Décision géométrie (b) rail conserve sa largeur, divisé verticalement |
| 2026-05-04 | Décision : H 3D du centre Stage cockpit conservé (pivot 1.2 préservé) |
| 2026-05-04 | Spec rédigée — en attente validation Adrien pour Phase 3 |
