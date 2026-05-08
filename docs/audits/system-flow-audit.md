---
title: System Flow Audit — Hearst OS
date: 2026-05-08
type: read-only audit
scope: flows, navigation, stores, triggers, états UI
modifications: aucune
---

# System Flow Audit

> Audit READ-ONLY de la cohérence globale des flows, navigation, interactions et logique produit. Aucun fichier n'a été modifié. Les findings sont marqués **VU** (observé dans le code), **AMBIGU** (non concluant), ou **INCOHÉRENCE** (deux sources contradictoires).

---

## 1. Architecture générale

### 1.1 Shell 3 colonnes (post-pivot 2026-04-29)

**VU** [`app/(user)/layout.tsx:73-180`](../../app/(user)/layout.tsx#L73-L180) — structure :

```
┌─ PulseBar (fixed top)
├─ Flex row
│  ├─ LeftPanelShell — TimelineRail (collapsed/expanded persistent)
│  ├─ main.stage-cool-paper — <Stage> (router 11 modes) + <ChatDock>
│  └─ RightPanel — <ContextRail> (dispatch par mode + pathname override)
├─ StageFooter
├─ MobileBottomNav (< md)
├─ <Commandeur> — overlay Cmd+K toujours monté
└─ <VoiceMount> — conditionnel
```

### 1.2 Stages polymorphes — 11 modes figés (Invariant I-1 de `stage.md`)

**VU** [`stores/stage.ts:22-33`](../../stores/stage.ts#L22-L33) :
`cockpit | chat | asset | asset_compare | mission | browser | meeting | kg | voice | simulation | artifact`

**VU** [`app/(user)/components/Stage.tsx:37-78`](../../app/(user)/components/Stage.tsx#L37-L78) — router pur (switch sur `mode`), rendu statique des 11 sous-Stages. Seule exception : `KnowledgeStage` utilise `dynamic({ssr:false})` pour Cytoscape (WebGL).

### 1.3 Stores critiques

| Store | Rôle | Persistence |
|---|---|---|
| `stage.ts` | mode actif + history (max 20) + `lastManualChangeAt` (guard 10s) | reset à `cockpit` au mount (Invariant I-5) |
| `focal.ts` | objet en focus (asset/mission/report/brief) + pin lock + secondary (max 3) | non |
| `selection.ts` | cockpit select-then-act (agent/mission/asset) | non |
| `stage-data.ts` | mirror pattern : sous-Stage write, Rail read-only | non |
| `navigation.ts` | threads chat + messages | localStorage |
| `chat-context.ts` | chips de contexte (topic, asset, mission, report) | non |
| `runtime.ts` | events SSE consolidés | non |
| `services.ts` | OAuth providers connectés | localStorage / API cache |

---

## 2. Navigation Map

### 2.1 Coexistence intentionnelle de deux systèmes

**Système A — Stage store** (post-pivot, source canonique du cockpit polymorphe)
- Source : `useStageStore.current.mode`
- Triggers : `setMode()`, hotkeys `⌘1-9`, Commandeur, SSE `stage_request`
- Retour : `back()` (⌘⌫) dépile l'history

**Système B — Next.js router** (legacy admin pages, conservé)
- Routes : `/missions`, `/reports`, `/assets`, `/runs`, `/apps`, `/briefing`, `/settings`, `/planner`, `/marketplace`, `/personas`
- Triggers : `<Link>` / `router.push()`

**Résolution de la collision** : `ContextRail` route d'abord par pathname (`/runs`, `/missions` admin overrident), **puis** par stage mode. Cf. [`ContextRail.tsx:38-146`](../../app/(user)/components/ContextRail.tsx#L38-L146).

**Pattern de retour vers Stage** observé sur `/missions`, `/assets` : clic row → `setMode({mode, id})` → `router.push("/")`. Cf. [`missions/page.tsx:32-37`](../../app/(user)/missions/page.tsx#L32-L37), [`assets/page.tsx:70-77`](../../app/(user)/assets/page.tsx#L70-L77).

### 2.2 Trajets utilisateurs principaux

| Trajet | Mécanisme | Source |
|---|---|---|
| Cockpit → Chat (premier message) | `setMode({mode:"chat", threadId})` dans ChatDock | [`ChatDock.tsx:51`](../../app/(user)/components/chat/ChatDock.tsx#L51) |
| `/missions` (admin) → MissionStage | `setMode({mode:"mission", missionId})` + `router.push("/")` | [`missions/page.tsx:32-37`](../../app/(user)/missions/page.tsx#L32-L37) |
| `/assets` (admin) → AssetStage | `setMode({mode:"asset", assetId})` + `router.push("/")` | [`assets/page.tsx:70-77`](../../app/(user)/assets/page.tsx#L70-L77) |
| Chat → Asset/Mission/Browser | SSE `stage_request` côté backend → `setModeFromTool()` | [`HomePageClient.tsx:281-282`](../../app/(user)/HomePageClient.tsx#L281-L282) |
| `⌘3` reopen dernier asset | `setMode({mode:"asset", assetId: lastAssetId})` | [`stores/stage.ts` STAGE_HOTKEYS:182-193](../../stores/stage.ts#L182-L193) |
| Esc dans FocalStage | `hide()` (ne touche pas focal lui-même) | [`HomePageClient.tsx:315-327`](../../app/(user)/HomePageClient.tsx#L315-L327) |
| `⌘⌫` back | `back()` dépile history Stage | hotkeys |

### 2.3 Dead ends et retours

- **Pas de Breadcrumb visible** dans les Stages — un composant `Breadcrumb.tsx` existe mais usage non tracé. **AMBIGU**.
- **Retour Mission/Asset → Cockpit** : pas de bouton "back" explicite dans MissionStage / AssetStage observé ; user dépend de `⌘⌫` ou clic logo PulseBar. Risque de friction sur mobile (pas de hotkey accessible).

---

## 3. Flows critiques

### 3.1 Flow chat → orchestration → stage_request

**VU** [`HomePageClient.tsx:261-287`](../../app/(user)/HomePageClient.tsx#L261-L287) :

1. User tape dans ChatDock → `fetch("/api/orchestrate")` → SSE reader
2. Buffer parse `data: {...}` ligne par ligne
3. Events :
   - `text_delta` → append `assistantBufferRef`, update message
   - `stage_request` → `setModeFromTool(event.stage)` (guard 10s actif)
   - `run_started` → save `canonicalRunId`
   - tous → `addEvent({...event, run_id})` pour timeline

**Robustesse** : tool override guard 10s respecte intent user récent (Invariant I-3 stage). Pin focal lock (`stores/focal.ts:183-220`) protège contre les races SSE.

### 3.2 Flow focal pin / hydrateThreadState (Phase C3)

**VU** [`stores/focal.ts:183-220`](../../stores/focal.ts#L183-L220) — remplace l'ancien timer 30s `viewRequestedAt` :

- Si user a `pinnedFocalKey` non null **et** payload SSE diffère → on garde focal user, on update juste `secondary`
- Si même pin (asset/mission identique) → update contenu (status, sections), garde le focal
- Sinon → atomic replace

### 3.3 Flow création/lancement mission

`/missions/builder` (route Next.js) → fetch backend → redirect `/missions/{id}` ou retour cockpit avec `setMode({mode:"mission", id})`. Détail non lu intégralement, **AMBIGU** sur le post-création (toast ? FocalStage ? ContextRailForMission ?).

### 3.4 Flow report (catalogue → exécution → rendu)

**INCOHÉRENCE structurelle détectée** : pas de `mode: "report"` dans `StageMode`. Reports rendus via :
- `GeneralDashboard` strate 5 (focal de type `report`)
- `FocalStage` plein écran (sourceAssetId d'un report)
- `/reports` (catalogue admin standalone)

Conséquence : un report long ou complexe occupe la surface FocalStage mais n'a pas de ContextRail dédié — fallback vers `CockpitChatBody` (5 strates génériques) ou `ContextRailForReports` (admin) selon route active. Pas de symétrie avec mission/asset.

---

## 4. Déclencheurs

Carte exhaustive des triggers identifiés dans le code :

| Trigger | Source | Effet | Store(s) impacté(s) | Risques |
|---|---|---|---|---|
| Clic agent (cockpit) | `GeneralDashboard` | `useSelectionStore.select()` | `selection` | aucun (pas de switch Stage) |
| Clic mission card | `GeneralDashboard` / `ContextRailForMission` | `select()` + `setFocal()` éventuel | `selection`, `focal` | FocalStage peut s'ouvrir non-sollicité |
| Clic asset card | `GeneralDashboard` / `AssetGrid` | `setFocal()` + `setMode({mode:"asset"})` | `focal`, `stage` | OK |
| Clic report card | `GeneralDashboard` | `setFocal()` (focal type "report") → FocalStage | `focal` | pas de Stage dédié, cf. §3.4 |
| ⌘K | `useGlobalHotkeys` | `setCommandeurOpen()` | `stage.commandeurOpen` | overlay |
| ⌘1..9 | `useGlobalHotkeys` | `setMode()` | `stage` | reset focal ? AMBIGU |
| ⌘0 | hotkey | mode artifact | `stage` | OK |
| ⌘⇧V | hotkey | toggle voice (WebRTC) | `voice` | side-effect mic/network |
| ⌘B | hotkey | toggle WorkingDocument | `working-document` | OK |
| ⌘⌫ | hotkey | `back()` (history pop) | `stage` | history vide → no-op silencieux |
| Création mission | `QuickActionsGrid` | `router.push("/missions/builder")` | aucun | flow post-création AMBIGU |
| Lancement run | `QuickActions` / `ReportCard` | SSE orchestrate | `runtime` events | backend choisit `stage_request` |
| Changement thread | `TimelineRail` | `setActiveThread()` + fetch `/api/v2/right-panel?thread_id` | `navigation`, `focal` (via `hydrateThreadState`) | pin lock protège |
| SSE `stage_request` | backend | `setModeFromTool()` | `stage` | guard 10s actif |
| Notification clic | `NotificationBell` | `router.push("/notifications")` | aucun | sortie hors Stage |
| OAuth callback | `/apps?connected=X` | `setServices()` | `services` | invalidation cache |
| Esc | hotkey | `hide()` FocalStage | `focal.isVisible` | ne reset pas focal lui-même |

---

## 5. Incohérences détectées

### 5.1 INCOHÉRENCE — Reports sans Stage dédié

**Constat** : `StageMode` contient `asset`, `mission`, `meeting`, `simulation`, `artifact`, mais **pas `report`**. Les reports sont des objets focal de premier ordre (catalogue, sharing HMAC, exports — cf. `docs/features/reports.md`) mais n'ont pas de surface symétrique aux missions/assets.

**Conséquence** : ouvrir un report = `setFocal({type:"report"})` qui rend FocalStage par-dessus le mode courant. ContextRail reste sur `CockpitChatBody` (générique) ou `ContextRailForReports` (admin). Pas de couche de contrôle dédiée (export, sharing, version) en surface.

**Ambiguïté** : voulu (les reports sont des artefacts d'agents, pas des objets éditables) ou gap (manque un `ReportStage`) ? À trancher avec Adrien.

### 5.2 INCOHÉRENCE — Workflows vs Missions

**Constat** : feature `workflows` apparaît dans `docs/features/_manifest.json` (manifest non lu en détail) et feature `missions` (F-04) verrouillée. Les deux concepts coexistent sans clarification visible des frontières dans la doc maître.

**Risque** : duplication de logique côté code (deux scheduler ? deux UI ?). À vérifier.

### 5.3 INCOHÉRENCE MINEURE — Page `/planner`

**Constat** : route `/planner` existe (vue dans `app/(user)/planner/`) sans spec dans `docs/features/_manifest.json` listée comme planner explicite (à vérifier). **AMBIGU** : Gantt hebdo ? builder mission ? overlap avec MissionStage ?

### 5.4 Coexistence des deux systèmes de navigation

**Pas une incohérence** au sens strict (résolution propre par pathname override) mais **friction cognitive** : un user qui clique `/missions` change la route URL **et** déclenche une page admin différente du MissionStage en mode polymorphe. Deux mental models pour deux usages.

---

## 6. Zones dangereuses

### 6.1 SSE polling vs user intent (résolu)
Pin focal lock + tool override 10s — **zone sécurisée**. Pas d'action requise.

### 6.2 History stack et reset
**VU** Invariant I-5 : `stage` reset à `cockpit` au mount → reload navigateur efface l'history. `lastAssetId` / `lastMissionId` aussi (pas persistés). Reload casse les hotkeys de réouverture (⌘3, ⌘9).

**Risque** : confusion user après refresh. Pas critique mais à documenter.

### 6.3 ChatDock et threadId implicite
Messages liés à `threadId` du `useNavigationStore`. Si thread courant est null au moment du submit, ChatDock crée un nouveau thread (`addThread`). **OK** mais aucun affichage de "nouveau thread créé" — silencieux.

### 6.4 OAuth callback `?connected=X`
**VU** services store update + cache invalidation. Si callback arrive sur une route non-/apps (improbable mais possible), comportement non testé. **AMBIGU**.

### 6.5 Voice mode (⌘⇧V)
WebRTC + micro + network. Pas de visualisation explicite "voice active" sur cockpit hors VoiceMount conditionnel. User pourrait oublier que mic est on → fuite confidentialité.

---

## 7. États manquants

Vérifié pour 4 écrans clés ; statut :

| Écran | empty | loading | error | disconnected | partial |
|---|---|---|---|---|---|
| `FocalStage` (report/asset preview) | ✓ Waiting_For_Data | ✓ spinner | ✓ banner | — | — |
| `MissionStage` | AMBIGU | présume oui | AMBIGU | N/A | AMBIGU |
| `AssetStage` | AMBIGU | présume oui | AMBIGU | AMBIGU (provider offline) | — |
| `Planner` | AMBIGU | AMBIGU | AMBIGU | AMBIGU | AMBIGU |
| `ContextRailForMission` | AMBIGU | AMBIGU | AMBIGU | — | — |

**Gaps prioritaires** :
- `AssetStage` : si provider source (Gmail/Slack/Drive) déco, comportement non-vérifié
- `Planner` : aucun état documenté
- error boundaries globales : aucune trouvée au niveau Stage / sous-Stage

---

## 8. Redondances fonctionnelles

### 8.1 Missions / Workflows / Planner
Trois concepts proches :
- **Missions** : automation longue durée (lease, cron, memory) — F-04
- **Workflows** : présent dans manifest, **AMBIGU** vs missions
- **Planner** : route UI, fonction non-documentée

**Recommandation** : clarifier la frontière workflow ⊂ mission ou workflow ≠ mission, et le rôle du planner (constructeur ? viewer Gantt ?).

### 8.2 Reports / Runs / Assets
- **Assets** : artefacts persistés (image/audio/video/code) avec variants — F-09
- **Runs** : historique exécutions (LRU evict, timeline) — F-22
- **Reports** : catalogue + exécution + sharing public HMAC — F-08

**Pas une vraie redondance** : un Report est un Asset spécialisé d'un Run. Mais le **chemin utilisateur** entre les trois est asymétrique (cf. §5.1).

### 8.3 ContextRail / Cockpit / Chat
**Pas de redondance significative**. Chaque surface a un angle différent :
- Cockpit hero = vue d'ensemble (briefing, KPIs, missions actives)
- ContextRail strate 5 = focus objet sélectionné
- Timeline = chronologie events
- ChatMessages = transcript conversation

**Léger overlap** Strate 4 status (roue, dot) vs ActivityStrip cockpit — tolérable.

---

## 9. Flows cassables

### 9.1 Cassable : ⌘3 sans `lastAssetId`
Si `lastAssetId === null` (premier mount, ou reload), ⌘3 set le mode `asset` mais sans payload → `AssetStage` reçoit `undefined` → empty state ou crash silencieux. **AMBIGU** sur le fallback.

### 9.2 Cassable : SSE déconnexion silencieuse
SSE event 1s + ping 25s (Invariant I-4 context-rail). Si réseau drop, `useRightPanelData` doit retry — non vérifié dans cet audit. Risque : focal stale qui ne se met plus à jour, sans signal user.

### 9.3 Cassable : ContextRailForMission fetch point-in-time
**VU** Invariant I-9 : pas de SSE, fetch ponctuel. Si la mission évolue côté backend, le rail montre un état figé tant qu'on ne reclique pas. **Comportement voulu** mais friction si user attend une update temps réel.

### 9.4 Cassable : changement de thread pendant message en cours
ChatDock streame SSE vers `assistantBufferRef.current`. Si user change de thread pendant le stream, le buffer continue d'écrire dans l'ancien thread (référence stable) ou se mélange. **AMBIGU** — à vérifier (probable que `currentAssistantIdRef` capte bien l'ancien thread).

### 9.5 Cassable : Commandeur prefilled query non consommée
`commandeurPrefilledQuery` set par MeetingStage (créer mission depuis action items), consommé par `consumeCommandeurPrefilledQuery()` au mount Commandeur. Si Commandeur jamais ouvert après set, la valeur reste en store. Pas critique mais "fuite" légère d'état.

---

## 10. UX friction

### 10.1 Pas de breadcrumb visible
Les modes profonds (`asset` après chat → `setMode` SSE) n'ont pas de fil d'Ariane. ⌘⌫ marche mais invisible pour user mobile (pas de hotkey accessible).

### 10.2 Switch Stage = perte de scroll
Switch entre modes recreate le sous-Stage (router pur, pas de cache). Tout scroll position perdu. Tolérable pour cockpit mais frustrant pour assets longs.

### 10.3 Pas d'indicateur "tool a changé le stage"
Quand backend SSE déclenche `stage_request`, l'user voit la surface changer sans annonce. Toast / breadcrumb manquant.

### 10.4 Hotkeys non visibles
9 hotkeys actifs (`⌘0-9`, `⌘K`, `⌘B`, `⌘⇧V`, `⌘⌫`) mais pas de cheatsheet visible (Commandeur affiche-t-il les hotkeys ? **AMBIGU**, à vérifier).

### 10.5 Mobile : MobileBottomNav vs hotkeys desktop
Sur mobile, `⌘⌫` impossible. `MobileBottomNav` couvre-t-il `back()` ? **AMBIGU**.

### 10.6 Reports en FocalStage = absence de surface dédiée
Un report long impose FocalStage plein écran, mais le ContextRail reste générique (CockpitChatBody) → pas d'actions report-specific (export, share, version). Friction §5.1.

### 10.7 OAuth flow callback
`/apps?connected=X` invalide cache et set services. Pas de toast "X connecté" observé dans les fichiers lus. **AMBIGU**.

---

## 11. Simplifications proposées

> Propositions, pas décisions. À arbitrer.

1. **Ajouter `mode: "report"`** au StageMode — symétrie avec asset/mission, ContextRailForReport dédié (export, share, versions). Lève §5.1 et §10.6.

2. **Clarifier Workflows vs Missions** dans `AGENT-DRIVEN-DEV.md` — soit fusion (un seul concept), soit doc explicite des frontières (workflow = sous-DAG d'une mission ? préset ?).

3. **Persister `lastAssetId` / `lastMissionId`** en localStorage — survit au reload, lève §6.2 et §9.1.

4. **Toast "stage changé par l'agent"** quand SSE `stage_request` déclenche un switch — lève §10.3, transparence agent.

5. **Cheatsheet hotkeys** dans Commandeur (section "Raccourcis") — lève §10.4.

6. **Mobile back button** dans `MobileBottomNav` — lève §10.5.

7. **Error boundaries au niveau sous-Stage** — au minimum sur AssetStage / MissionStage / FocalStage. Lève §7.

8. **OAuth toast** sur callback `/apps?connected=X` — lève §10.7.

9. **Breadcrumb optionnel dans PulseBar** quand `stage.history.length > 1` — affiche "Cockpit › Mission X › Asset Y" cliquable. Lève §10.1.

10. **SSE retry/fallback visible** : si déconnexion SSE > N secondes, banner "Connexion perdue, reconnexion…". Lève §9.2.

---

## 12. Priorités recommandées

> Ordonnancement par ratio impact / coût.

### P0 — incohérences structurelles (livrables 1-2 sprints)
- **#2** Clarifier Workflows vs Missions (doc avant code)
- **#1** Décider sort des reports : Stage dédié ou rester FocalObject (architecture)
- **#7** Error boundaries sur AssetStage / MissionStage / FocalStage (régression silencieuse)

### P1 — friction utilisateur visible (livrables 1 sprint)
- **#4** Toast / signal visible sur `stage_request` agent-driven
- **#9** Breadcrumb conditionnel dans PulseBar
- **#3** Persister `lastAssetId`/`lastMissionId` localStorage
- **#10** Banner SSE déconnexion

### P2 — polish (livrables 1-3 jours)
- **#5** Cheatsheet hotkeys dans Commandeur
- **#6** Bouton back mobile
- **#8** Toast OAuth callback

### Investigations à mener avant code (≤ 1 jour chacune)
- Vérifier états error / disconnected sur AssetStage et MissionStage (cf. §7)
- Vérifier comportement SSE retry sur perte réseau (cf. §9.2)
- Vérifier scroll preservation entre switch de modes (cf. §10.2)
- Vérifier comportement ChatDock buffer sur changement de thread en cours de stream (cf. §9.4)
- Vérifier rôle exact de `/planner` (cf. §5.3)

---

## 13. Recommandations V1 / V2 / V3

### V1 (court terme — ce que l'audit révèle de mûr à corriger)
- Persister `lastAssetId`/`lastMissionId`
- Error boundaries sur sous-Stages
- Toast sur SSE `stage_request`
- Cheatsheet hotkeys

### V2 (moyen terme — décisions architecture)
- Trancher Workflows vs Missions, mettre à jour AGENT-DRIVEN-DEV.md
- Trancher sort des reports (Stage dédié vs FocalObject only)
- Breadcrumb global PulseBar
- Mobile parity (back button, hotkeys équivalents)

### V3 (long terme — perfectionnement)
- Scroll restoration entre switch de modes
- SSE reconnect logic + visualisation
- Cheatsheet contextuelle (hotkeys disponibles en fonction du mode actif)
- Cohérence "voice active" globale (badge persistant cockpit)

---

## Annexe A — Fichiers source de vérité

| Fichier | Lignes clés | Rôle |
|---|---|---|
| [`stores/stage.ts`](../../stores/stage.ts) | 22-33, 97-165, 182-193 | StageMode, useStageStore, STAGE_HOTKEYS |
| [`stores/focal.ts`](../../stores/focal.ts) | 136-220 | useFocalStore, pin lock, hydrateThreadState |
| [`stores/selection.ts`](../../stores/selection.ts) | 37-41 | useSelectionStore (cockpit) |
| [`app/(user)/components/Stage.tsx`](../../app/(user)/components/Stage.tsx) | 37-78 | Router unique 11 modes |
| [`app/(user)/layout.tsx`](../../app/(user)/layout.tsx) | 73-180 | Shell 3 colonnes |
| [`app/(user)/components/ContextRail.tsx`](../../app/(user)/components/ContextRail.tsx) | 38-146 | Dispatcher mode + pathname override |
| [`app/(user)/components/right-panel/GeneralDashboard.tsx`](../../app/(user)/components/right-panel/GeneralDashboard.tsx) | 52-59 | Strates 3/4/5 cockpit/chat |
| [`app/(user)/components/chat/ChatDock.tsx`](../../app/(user)/components/chat/ChatDock.tsx) | 31-100 | Submit + SSE |
| [`app/(user)/HomePageClient.tsx`](../../app/(user)/HomePageClient.tsx) | 261-287, 281-282, 315-327 | SSE handler, stage_request, Esc handler |
| [`app/hooks/use-global-hotkeys.ts`](../../app/hooks/use-global-hotkeys.ts) | 25-146 | Hotkeys |
| [`docs/features/stage.md`](../features/stage.md) | — | 15 invariants Stage (P0) |
| [`docs/features/context-rail.md`](../features/context-rail.md) | — | 9 invariants ContextRail (P2) |
| [`docs/AGENT-DRIVEN-DEV.md`](../AGENT-DRIVEN-DEV.md) | — | Master features lock |

---

## Annexe B — Findings non concluants (à investiguer)

- Comportement de `ChatDock` lors d'un changement de thread pendant un stream SSE en cours.
- Existence et UX d'un toast "OAuth connecté" sur `/apps?connected=X`.
- Existence d'une cheatsheet hotkeys (Commandeur ou ailleurs).
- Rôle exact de `/planner` (Gantt ? builder mission ? autre ?).
- Workflows : feature distincte de missions, ou alias ?
- Comportement SSE retry après perte réseau (`useRightPanelData`).
- Etats error/disconnected de AssetStage et MissionStage (non lus en détail dans cet audit).
- Comportement de ⌘3 / ⌘9 si `lastAssetId` / `lastMissionId` est null (reload).

---

**Fin du System Flow Audit. Aucun fichier source n'a été modifié.**
