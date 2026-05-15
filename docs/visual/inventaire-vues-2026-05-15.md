# Inventaire des surfaces visuelles — Hearst OS
_Généré le 2026-05-15 | 58 routes page.tsx recensées (dont /spatial-safe figé)_

---

## 1. Vues utilisateur principales — Stages cockpit + routes `(user)`

### Cockpit (Hub)
- **Route/Trigger** : `/` — Stage mode `"cockpit"` (default)
- **Intent** : Tableau de bord temps réel — KPIs, agenda, briefing auto, activity feed, watchlist
- **Composant racine** : `app/(user)/components/stages/CockpitStage.tsx`
- **État** : existe (verrouillé v1.5)
- **Composants clés** : `CockpitHeader`, `KPIStrip`, `ActivityStrip`, `CockpitAgenda`, `QuickActionsGrid`
- **États couverts** : loading (skeleton), error (fail-soft), live refresh
- **Priorité design** : P0
- **Note** : RSC prefetch via `/api/v2/cockpit/today` côté serveur (C5). Hub central — premier écran après login.

---

### Chat / Thread
- **Route/Trigger** : Stage mode `"chat"` — déclenché par sidebar, Cmd+K, clic thread
- **Intent** : Conversation multiturns avec LLM — orchestration tools, approvals inline, SSE stream
- **Composant racine** : `app/(user)/components/stages/ChatStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `ChatMessages`, `ChatDock`, `ContextRail`, `ApprovalInline`, `SourceCitation`
- **États couverts** : empty (nouveau thread), loading (agent busy), tool pending, approval awaiting, error
- **Priorité design** : P0
- **Note** : Sanctuaire du produit — tous les workflows y passent comme fallback. ChatDock persiste 10 derniers messages.

---

### Mission Runner
- **Route/Trigger** : Stage mode `"mission"` — `/missions/[id]` deep-link → redirect Stage
- **Intent** : Injection de variables + exécution manuelle + historique des runs d'une mission
- **Composant racine** : `app/(user)/components/stages/MissionStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `MissionHeader`, `MissionVariablesPanel`, `MissionRunHistory`, `ApprovalInline`
- **États couverts** : loading, running (polling), error, approval pending
- **Priorité design** : P1
- **Note** : `/missions/[id]` deep-link → `missionToFocal()` → Stage redirect. Drift alert si dérive.

---

### Asset Inspector
- **Route/Trigger** : Stage mode `"asset"` — clic depuis asset library ou ContextRail
- **Intent** : Inspecteur d'assets (vidéos, images, PDFs, audios) avec variants et timeline d'édition
- **Composant racine** : `app/(user)/components/stages/asset-stage/AssetStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `AssetStageHeader`, `AssetVariantTabs`, `AssetStageToast`, `VideoPlayer/PDFViewer`
- **États couverts** : loading, variant generating (polling), error (E2B 503), empty variants
- **Priorité design** : P1
- **Note** : Hotkey ⌘Enter pour generate. Variants versionnés. ExecResult stocké R2/Supabase.

---

### Asset Compare
- **Route/Trigger** : Stage mode `"asset_compare"` — clic "Comparer" depuis multi-select
- **Intent** : Comparaison split-screen A/B ou multi-variant (max 4)
- **Composant racine** : `app/(user)/components/stages/AssetCompareStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `ComparisonGrid`, `VariantCard`, `MetricsOverlay`
- **États couverts** : loading, empty (asset unique), error
- **Priorité design** : P2
- **Note** : Output naturel du Cmd+G (Video Quick Launch). Mode A/B tight sur 2–4 variants.

---

### Browser / Web Control
- **Route/Trigger** : Stage mode `"browser"` — déclenché par tool `browser_take_over` en chat
- **Intent** : Viewport Browserbase + debug inspector + Stagehand live actions
- **Composant racine** : `app/(user)/components/stages/BrowserStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `BrowserViewport`, `DebuggerPanel`, `ActionInspector`, `ScreenshotTimeline`
- **États couverts** : loading, awaiting user control, agent running, error (clé API manquante)
- **Priorité design** : P1
- **Note** : Polling `debugViewerUrl` 2s × 30 max. Playwright-core fallback stub si absent.

---

### Meeting / Transcription
- **Route/Trigger** : Stage mode `"meeting"` — outil chat `start_meeting`
- **Intent** : Transcript Zoom/Meet/Teams + bot polling + debrief post-run
- **Composant racine** : `app/(user)/components/stages/MeetingStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `MeetingHeader`, `MeetingTranscript`, `DebriefPanel`, `ActionItemsList`, `BotStatus`
- **États couverts** : loading bot, running (polling 5s), completed, error (Recall API manquante)
- **Priorité design** : P2
- **Note** : 3 validateurs URL (Zoom/Meet/Teams). Asset placeholder kind=event persist pre-worker.

---

### Knowledge Graph
- **Route/Trigger** : Stage mode `"kg"` — lookup chat ou deep-link
- **Intent** : Entity card + graphe relationnel (Cytoscape) + context fetch bidirectionnel
- **Composant racine** : `app/(user)/components/stages/KnowledgeStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `EntityCard`, `RelationshipsGraph` (Cytoscape SSR:false), `ContextPanel`, `EmbeddingSearch`
- **États couverts** : loading, error (Supabase/pgvector down), empty relations
- **Priorité design** : P1
- **Note** : pgvector 1536-dim, cache retrieval 30s, max 1500 chars. Canvas Cytoscape client-only.

---

### Voice / Réaltime
- **Route/Trigger** : Stage mode `"voice"` — Cmd+7, Cmd+⇧V, ou Commandeur
- **Intent** : Session WebRTC OpenAI Realtime — transcription, tools voice-first, confirmations
- **Composant racine** : `app/(user)/components/stages/VoiceStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `VoicePulse` (monté au root layout), `TranscriptPanel`, `ToolCallPanel`, `ConfirmationOverlay`
- **États couverts** : connecting, recording, processing, tool pending, confirmation (actions destructives)
- **Priorité design** : P2
- **Note** : Singleton WebRTC session. API OpenAI ne quitte jamais le serveur. VoicePulse vit au root layout (pas dans VoiceStage) pour éviter accumulation sessions.

---

### Simulation / DeepSeek
- **Route/Trigger** : Stage mode `"simulation"` — via chat ou UI
- **Intent** : Raisonnement "what-if" avec DeepSeek R1 — variables filtrées, réponse FR obligatoire
- **Composant racine** : `app/(user)/components/stages/SimulationStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `SimulationInput`, `ReasoningDisplay`, `ResultsPanel`
- **États couverts** : loading, processing, error
- **Priorité design** : P2
- **Note** : Appel synchrone (pas queue worker). Asset persisté systématiquement. Modèle figé DeepSeek R1.

---

### Artifact / Code Editor
- **Route/Trigger** : Stage mode `"artifact"` — outil chat `artifact_create`
- **Intent** : Éditeur de code in-canvas avec preview live (exécution E2B) et historique versions
- **Composant racine** : `app/(user)/components/stages/ArtifactStage.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `ArtifactEditor`, `CodePreview`, `VersionHistory`, `RunButton`
- **États couverts** : loading, running (polling 1.5s × 80 max), completed, error (E2B 503)
- **Priorité design** : P2
- **Note** : Hotkey ⌘Enter. Timeout 30s default (max 120s). Variants versionnées.

---

### Signal Board
- **Route/Trigger** : Stage mode `"signal"` — icône PulseBar ou shortcut
- **Intent** : Dashboard anomalies système — drift missions, perf dips, signaux critiques
- **Composant racine** : `app/(user)/components/stages/SignalBoardStage.tsx`
- **État** : WIP (in_progress)
- **Composants clés** : `SignalGrid`, `SignalCard`, `FilterTabs`
- **États couverts** : loading (cache 60s), error (fail-soft), empty
- **Priorité design** : P2
- **Note** : 5 kinds figés. Severity sourde. TTL 30min par signal. Whisper dans PulseBar uniquement.

---

### Missions — Liste
- **Route/Trigger** : `/missions` (standalone page, hors Stage central)
- **Intent** : Catalogue des missions du tenant — liste, filtres, accès rapide exécution
- **Composant racine** : `app/(user)/missions/page.tsx`
- **État** : existe
- **Composants clés** : `MissionCard`, `MissionFilters`, `Action` (CTA)
- **États couverts** : loading, empty, error
- **Priorité design** : P1
- **Note** : Clic → deep-link `/missions/[id]` → redirect Stage mission. Lien entre liste et Stage.

---

### Mission Builder
- **Route/Trigger** : `/missions/builder` — canvas plein écran
- **Intent** : Éditeur drag-drop de workflow — palette nodes, inspector, validation, publish
- **Composant racine** : `app/(user)/missions/builder/page.tsx` → `WorkflowCanvas`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `WorkflowCanvas`, `NodePalette`, `Inspector` (ContextRail), `BuilderToolbar`, `PublishModal`
- **États couverts** : editing, validating, publishing, draft recovery (localStorage 24h TTL)
- **Priorité design** : P1
- **Note** : Builder store Zustand in-memory. Validation obligatoire avant exécution. Templates hospitality.

---

### Assets — Bibliothèque
- **Route/Trigger** : `/assets`
- **Intent** : Bibliothèque média — liste, filtres (kind, status), accès rapide à l'inspecteur
- **Composant racine** : `app/(user)/assets/page.tsx`
- **État** : existe
- **Composants clés** : `AssetCard`, `AssetFilters`, `LibraryTabs`
- **États couverts** : loading (skeleton), empty, error
- **Priorité design** : P1
- **Note** : Clic → deep-link `/assets/[id]` → redirect Stage asset. Grille responsive.

---

### Asset Détail
- **Route/Trigger** : `/assets/[id]` — redirect vers Stage mode `"asset"` probable
- **Intent** : Page de destination deep-link pour un asset spécifique
- **Composant racine** : `app/(user)/assets/[id]/page.tsx`
- **État** : existe
- **Composants clés** : (redirect vers Stage asset ou render inline)
- **États couverts** : loading, notFound
- **Priorité design** : P1
- **Note** : Pattern deep-link → Stage cohérent avec `/missions/[id]`.

---

### Reports — Discovery
- **Route/Trigger** : `/reports`
- **Intent** : Catalogue des rapports disponibles — prédéfinis (9) + templates personnalisés, filtrage par domaine
- **Composant racine** : `app/(user)/reports/page.tsx`
- **État** : existe
- **Composants clés** : `ReportCard`, `ReportCardSkeleton`, `LibraryTabs`, `Action`, `EmptyState`, `ScreenShell`
- **États couverts** : loading (skeleton 3×3), error (retry), empty filtré, empty total
- **Priorité design** : P1
- **Note** : Filtres : Tous / Prêts / À connecter / Personnalisés. Domaine dropdown. Tokens uniquement.

---

### Report Studio
- **Route/Trigger** : `/reports/studio` — depuis `/reports` (bouton Créer ou ?clone=specId)
- **Intent** : Block editor visuel pour custom report specs — 3 colonnes (palette / preview / config)
- **Composant racine** : `app/(user)/reports/studio/page.tsx`
- **État** : existe
- **Composants clés** : `BlockPalette`, `PreviewPane`, `SpecOutline`, `BlockConfigPanel`, `StudioToolbar`, `PublishTemplateModal`
- **États couverts** : vierge, clone depuis spec, loading spec, error validation
- **Priorité design** : P1
- **Note** : Actions toolbar : Save / Sample / Schedule / Share. Mode clone charge spec catalog puis clone.

---

### Report Editor (Démo)
- **Route/Trigger** : `/reports/editor` — démo prototype
- **Intent** : Démo `ReportSpecEditor` — toggle visibilité blocks, Apply → JSON preview
- **Composant racine** : `app/(user)/reports/editor/page.tsx`
- **État** : démo/prototype
- **Composants clés** : `ReportSpecEditor`, `PageHeader`
- **États couverts** : editing, applied
- **Priorité design** : P2
- **Note** : Page démo avec spec founder-cockpit hardcodé. À clarifier si surface user finale ou dev tool.

---

### Briefing
- **Route/Trigger** : `/briefing` — auto-trigger 6h–10h via layout + accès direct
- **Intent** : Daily briefing audio + PDF — dernier brief généré + historique
- **Composant racine** : `app/(user)/briefing/page.tsx`
- **État** : existe
- **Composants clés** : `PageHeader`, `PdfViewer`, `AudioPlayer`, `BriefHistoryList`
- **États couverts** : loading, polling audio (max 60 tentatives / 5min), error, empty (pas de brief)
- **Priorité design** : P1
- **Note** : Polling audio 5s × 60 max. BriefingAutoTrigger dans layout déclenche POST `/api/briefing` entre 6h et 10h.

---

### Personas / Brand Voice
- **Route/Trigger** : `/personas`
- **Intent** : Gestion Brand Voice — liste + création + édition + A/B test inline
- **Composant racine** : `app/(user)/personas/page.tsx`
- **État** : existe
- **Composants clés** : `PersonaCard`, `PersonaABTestPanel`, `PublishTemplateModal`, `ConfirmModal`, `EmptyState`
- **États couverts** : loading, empty, création, édition inline, A/B test, focus (param `?focus=id`)
- **Priorité design** : P1
- **Note** : 5 surfaces enum (chat/inbox/simulation/voice/cockpit). Publish vers marketplace. `?focus=id` déroule la card en édition.

---

### Sources / Connexions
- **Route/Trigger** : `/apps`
- **Intent** : Hub de connexion aux intégrations — Slack, Gmail, Google Calendar, CRMs, etc.
- **Composant racine** : `app/(user)/apps/page.tsx`
- **État** : existe
- **Composants clés** : `ConnectionsHub`, `ScreenShell`
- **États couverts** : loading, connected, error (OAuth fail)
- **Priorité design** : P1
- **Note** : `ScreenShell` générique. Auth OAuth + token rotation gérée par NextAuth adapters.

---

### Marketplace
- **Route/Trigger** : `/marketplace`
- **Intent** : Browse templates publics — workflows, report_specs, personas, packs créatifs
- **Composant racine** : `app/(user)/marketplace/page.tsx`
- **État** : existe
- **Composants clés** : `MarketplaceTemplateCard`, `ScreenShell`, filtres KindFilter
- **États couverts** : loading, empty filtré, error
- **Priorité design** : P2
- **Note** : 5 kinds de filtres. Grille responsive 1/2/3 colonnes. Featured flag.

---

### Marketplace Détail
- **Route/Trigger** : `/marketplace/[id]`
- **Intent** : Page détail d'un template — preview, import dans workspace, attribution
- **Composant racine** : `app/(user)/marketplace/[id]/page.tsx`
- **État** : existe
- **Composants clés** : (à vérifier — probablement `MarketplaceTemplateDetail`)
- **États couverts** : loading, notFound, error
- **Priorité design** : P2
- **Note** : Surface découverte — potentiellement orpheline si pas de link depuis `/marketplace`. À vérifier.

---

### Notifications
- **Route/Trigger** : `/notifications`
- **Intent** : Centre notifications plein écran — filtres sévérité + type, mark-read, mark-all
- **Composant racine** : `app/(user)/notifications/page.tsx`
- **État** : existe
- **Composants clés** : `EmptyState`, `RowSkeleton`, `ScreenShell`, `NotificationRow`
- **États couverts** : loading, empty, error, filtres (critical/warning/info × signal/report_ready/etc)
- **Priorité design** : P2
- **Note** : Badge count hydraté dès le layout via `NotificationsHydrate`. Filtres kind + severity.

---

### Runs Utilisateur
- **Route/Trigger** : `/runs`
- **Intent** : Historique des runs personnels — status, kind, tokens, coût, latence
- **Composant racine** : `app/(user)/runs/page.tsx`
- **État** : existe
- **Composants clés** : `ScreenShell`, `Action`, `ConfirmModal`, `RelativeTime`, `RowActions`
- **États couverts** : loading, empty, error, delete confirm
- **Priorité design** : P2
- **Note** : Actions ligne : voir dans Stage, supprimer. Filtres basiques.

---

### Run Détail Utilisateur
- **Route/Trigger** : `/runs/[id]`
- **Intent** : Détail d'un run — traces, étapes, assets produits, métriques
- **Composant racine** : `app/(user)/runs/[id]/page.tsx`
- **État** : existe
- **Composants clés** : (à confirmer — probablement `RunDetailView`)
- **États couverts** : loading, error, notFound
- **Priorité design** : P2
- **Note** : Mirror lite de `/admin/runs/[id]` mais filtré sur le tenant/user courant.

---

### Archive
- **Route/Trigger** : `/archive` — lien depuis TimelineRail + Commandeur
- **Intent** : Historique plein écran — tous les threads avec recherche locale (v1), assets/missions/KG (v2)
- **Composant racine** : `app/(user)/archive/page.tsx`
- **État** : existe (v1 threads uniquement)
- **Composants clés** : `ScreenShell`, recherche locale, groupement temporel
- **États couverts** : loading, empty (0 threads), error, recherche vide
- **Priorité design** : P2
- **Note** : V2 prévoit assets + missions + KG entries unifiés dans vue temporelle.

---

### Settings Hub
- **Route/Trigger** : `/settings`
- **Intent** : Hub des réglages utilisateur — liste les sections disponibles
- **Composant racine** : `app/(user)/settings/page.tsx`
- **État** : existe
- **Composants clés** : `PageHeader`, liste `SettingsEntry` (Link cards)
- **États couverts** : static (RSC)
- **Priorité design** : P2
- **Note** : 1 seule section active pour l'instant : Alerting.

---

### Settings — Alerting
- **Route/Trigger** : `/settings/alerting`
- **Intent** : Préférences de notification — canaux (email/slack/in-app), severity floor, throttle
- **Composant racine** : `app/(user)/settings/alerting/page.tsx`
- **État** : existe
- **Composants clés** : `AlertingPanel`, `ChannelToggle`, `SeveritySelector`
- **États couverts** : loading, display, toggle, save feedback
- **Priorité design** : P2
- **Note** : Clé preferences `integrations.alerting.preferences` via settings API. Fail-soft par canal.

---

### Hospitality Hub
- **Route/Trigger** : `/hospitality`
- **Intent** : Hub vertical hôtellerie — reports recommandés (3), workflow templates (2), lien persona Concierge
- **Composant racine** : `app/(user)/hospitality/page.tsx`
- **État** : existe (démo MVP — IDs fictifs)
- **Composants clés** : `PageHeader`, cards reports + templates (hardcodé)
- **États couverts** : static (données hardcodées)
- **Priorité design** : P2
- **Note** : IDs fictifs — TODO remplacer par `/api/v2/reports/specs?vertical=hospitality`. Surface verticale, pas universelle.

---

## 2. Overlays & command surfaces

### PulseBar
- **Route/Trigger** : Fixed top bar dans `app/(user)/layout.tsx` — toujours monté
- **Intent** : Système nerveux central — connections meter, signal whisper, credits, voice indicator, offline badge
- **Composant racine** : `app/(user)/components/PulseBar.tsx`
- **État** : existe (verrouillé v1.1)
- **Composants clés** : `ConnectionsMeter`, `SignalWhisper`, `CreditsDisplay`, `VoiceStatus`, `OfflineStatus`, `CommandeurButton`
- **États couverts** : online, offline (fail-soft), credits depleting, connections failing
- **Priorité design** : P0
- **Note** : Hauteur fixe `--height-pulsebar`. Halo accent uniquement états intentionnels actifs. Refresh connections 60s.

---

### Commandeur (Cmd+K)
- **Route/Trigger** : Overlay global — keyboard Cmd+K, déclenche `setCommandeurOpen(true)`
- **Intent** : Palette de commande unifiée — semantic search (Claude Haiku), lexical fallback, historique
- **Composant racine** : `app/(user)/components/Commandeur.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `CommandeurPalette` (cmdk), `SearchInput`, `ResultsList`, prefilled query consumer
- **États couverts** : empty query (reset immédiat), debounce 200ms, abort on new query, fail-soft par source
- **Priorité design** : P1
- **Note** : LRU cache 10 queries (module scope). Max 5 résultats par type. OPENAI absente → lexical seul. Query 1–120 chars.

---

### Timeline Rail (Left Panel)
- **Route/Trigger** : Always mounted dans `app/(user)/layout.tsx` (sidebar gauche)
- **Intent** : Historique conversation groupé par jour — quick access, lien archive
- **Composant racine** : `app/(user)/components/LeftPanelShell.tsx` → `TimelineRail`
- **État** : existe (verrouillé v1.1)
- **Composants clés** : `TimelineRail`, `ThreadRow`, `RailHeader`, `ArchiveButton`
- **États couverts** : empty (première visite), loading, max 12 tiles, mobile hidden
- **Priorité design** : P1
- **Note** : Sélection = ouvre thread + passe Stage en chat. Clic logo → cockpit. Nouveau thread → chat mode.

---

### Context Rail (Right Panel)
- **Route/Trigger** : Always mounted dans `app/(user)/layout.tsx` (sidebar droite)
- **Intent** : Panel droit polymorphe — vue différente selon Stage actif (chat, mission, KG, cockpit...)
- **Composant racine** : `app/(user)/components/RightPanel.tsx` → `ContextRail`
- **État** : existe (verrouillé v1.1)
- **Composants clés** : `ContextRailShell`, sous-composants par mode (`CockpitChatBody`, `FocalObjectDisplay`, etc.)
- **États couverts** : loading, empty (pas de focal), error, mobile drawer mode
- **Priorité design** : P1
- **Note** : Largeur par token CSS. Pin-based focal lock. SSE thread actif ou fetch parallèle sans thread.

---

### ChatDock (Input Widget)
- **Route/Trigger** : Monté dans layout, visible dans ChatStage — `Suspense` wrapper
- **Intent** : Soumission message + attachment assets + context chips + historique picker
- **Composant racine** : `app/(user)/components/ChatDock.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `ChatInput`, `AttachmentPreview`, `ContextChips`, `HistoryPicker`
- **États couverts** : idle, composing, sending, error, approval blocking
- **Priorité design** : P0
- **Note** : Injecte `attached_asset_ids` dans payload. Stage mode override guard 10s. SSE tool stream dedupe par stepId.

---

### Approval Inline
- **Route/Trigger** : Injecté dans ChatStage + MissionStage lors d'actions write
- **Intent** : Two-step write-guard — preview action, confirm/reject inline avant exécution
- **Composant racine** : `app/(user)/components/ApprovalInline.tsx`
- **État** : existe (verrouillé v1.0 — `chat.md I-18`)
- **Composants clés** : `ApprovalCard`, `PreviewFormatter`, `ConfirmButton`, `RejectButton`
- **États couverts** : showing, awaiting user decision, error (preview formatter fail)
- **Priorité design** : P0
- **Note** : Obligatoire pour toutes les writes. WRITE_SEGMENTS + WRITE_PREFIXES figés. Composio actions never throw.

---

### VoicePulse (WebRTC Mount)
- **Route/Trigger** : Monté conditionnellement au root layout si `voiceActive === true`
- **Intent** : Singleton WebRTC OpenAI Realtime — jamais deux sessions concurrentes
- **Composant racine** : `app/(user)/components/voice/VoicePulse.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `WebRTCManager`, `TranscriptBuffer`, `ToolCallHandler`
- **États couverts** : connecting, active (recording), error (API down), disconnecting
- **Priorité design** : P2
- **Note** : Vit au root layout (pas dans VoiceStage) pour éviter 14 sessions accumulées lors de navigation.

---

### Video Quick Launch (Cmd+G)
- **Route/Trigger** : Overlay global — hotkey ⌘G (Mac) / Ctrl+G (Windows), monté dans layout
- **Intent** : Batch video generation rapide — max 4 variants, SSE QueueEvents + polling 2s fallback
- **Composant racine** : `app/(user)/components/VideoQuickLaunch.tsx` → `VideoQuickLaunchPanel`
- **État** : WIP (in_progress)
- **Composants clés** : `VideoQuickLaunchPanel`, `BatchForm`, `ProgressIndicator`
- **États couverts** : idle, queued, processing, comparing, error
- **Priorité design** : P1
- **Note** : Output → AssetCompareStage. Store session-only. Max 4 variants par batch.

---

### Focus Badge
- **Route/Trigger** : Badge flottant — toggle ⌘⇧F (hotkey)
- **Intent** : Masque tous les rails, concentre le canvas — état persisté localStorage
- **Composant racine** : `app/(user)/components/FocusBadge.tsx`
- **État** : WIP (in_progress)
- **Composants clés** : `Badge`, `EscapeHint`
- **États couverts** : visible (mode focus), hidden
- **Priorité design** : P2
- **Note** : Rails masqués (pas démontés). ESC pour quitter (jamais activer). CSS transition via tokens.

---

### Stage Footer
- **Route/Trigger** : Footer bas du Stage central, monté dans layout
- **Intent** : Zone d'actions contextuelles basse — hotkeys, actions secondaires selon Stage actif
- **Composant racine** : `app/(user)/components/StageFooter.tsx`
- **État** : existe
- **Composants clés** : `StageActionBar`
- **États couverts** : vide (modes sans actions), peuplé (chat, asset...)
- **Priorité design** : P2
- **Note** : Surface légère. À auditer — rôle exact selon Stage actif à préciser.

---

### Mobile Bottom Nav
- **Route/Trigger** : Fixed bottom bar mobile (breakpoint < lg) — monté dans layout
- **Intent** : Navigation rapide entre les 7 Stages principaux sur mobile
- **Composant racine** : `app/(user)/components/MobileBottomNav.tsx`
- **État** : existe
- **Composants clés** : `NavButton` (par stage), `PulseIndicator`
- **États couverts** : stage actif highlighted, pulse on activity
- **Priorité design** : P2
- **Note** : Déclenche `useStageStore.setMode({mode: ...})`. Affiche lastAssetId/lastMissionId.

---

### Toast Container
- **Route/Trigger** : Global, monté dans `ToastProvider` du layout
- **Intent** : Notifications éphémères — succès, erreurs, avertissements
- **Composant racine** : `app/components/ToastContainer.tsx`
- **État** : existe
- **Composants clés** : `ToastItem`, `DismissButton`
- **États couverts** : visible, dismiss
- **Priorité design** : P1
- **Note** : `useToast()` hook partagé. Fail-soft sur tous les services tiers s'appuie dessus.

---

### Confirm Modal
- **Route/Trigger** : Overlay — déclenché programmatiquement (`<ConfirmModal>` dans consumers)
- **Intent** : Dialogue de confirmation pour actions destructives (delete run, delete mission, etc.)
- **Composant racine** : `app/(user)/components/ConfirmModal.tsx`
- **État** : existe
- **Composants clés** : (dialog primitif — libellés, confirm/cancel)
- **États couverts** : open, closed
- **Priorité design** : P1
- **Note** : Utilisé dans `/runs`, `/personas`, probablement `/missions`. Pattern réutilisable.

---

### Welcome Panel
- **Route/Trigger** : Affiché dans Stage central quand aucun thread/focal — premier lancement
- **Intent** : Écran d'accueil vide — suggestions, CTA pour commencer
- **Composant racine** : `app/(user)/components/WelcomePanel.tsx`
- **État** : existe
- **Composants clés** : suggestions tiles, CTA
- **États couverts** : empty state cockpit/chat
- **Priorité design** : P1
- **Note** : État zéro de l'app — première impression post-onboarding. Important pour la rétention.

---

## 3. Auth & Onboarding

### Login
- **Route/Trigger** : `/login`
- **Intent** : Entrée OAuth — boutons Google + Azure AD, gestion erreurs, redirect post-auth
- **Composant racine** : `app/login/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `LoginContent`, `ProviderButton` (2 providers), `SessionProvider`
- **États couverts** : loading, authenticated (redirect), error (OAuthCallback, retry link)
- **Priorité design** : P0
- **Note** : Callback URL safety (relatif only, no absolute/js:). Micro-copy FR. NextAuth PKCE S256 obligatoire.

---

### Onboarding — Sélection Vertical
- **Route/Trigger** : `/onboarding/vertical` — accès direct ou post-login première fois
- **Intent** : Sélection de l'industrie (6 cartes) → POST `/api/onboarding/set-industry` → redirect `/`
- **Composant racine** : `app/(user)/onboarding/vertical/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `PageHeader`, `IndustryCard` × 6, `Action`
- **États couverts** : loading (submit), error (toast), success (redirect)
- **Priorité design** : P1
- **Note** : 6 industries enum figé (general/hospitality/saas/ecommerce/finance/healthcare). Hospitality → persona concierge. Persistance Supabase.

---

## 4. Admin

### Admin Home
- **Route/Trigger** : `/admin`
- **Intent** : Health snapshot système — checks Supabase, KPIs runs récents, log 8 derniers runs
- **Composant racine** : `app/admin/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `HealthCard`, `KPICard`, `RunsTable`
- **États couverts** : loading, health good/degraded/offline, error
- **Priorité design** : P2
- **Note** : force-dynamic RSC. Sidebar admin collapsible localStorage.

---

### Admin Health
- **Route/Trigger** : `/admin/health`
- **Intent** : 10 sections tiers — LLM providers, DB, cache, search, media gen, docs, lead, email, obs, security
- **Composant racine** : `app/admin/health/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `ServiceSection`, `HealthIndicator`, `LatencyGauge`
- **États couverts** : loading, healthy, degraded, offline
- **Priorité design** : P2
- **Note** : Auto-refresh 30s. Couvre Sentry, Langfuse, Axiom. Ping léger si endpoint gratuit.

---

### Admin Metrics
- **Route/Trigger** : `/admin/metrics`
- **Intent** : Métriques LLM providers (tps, tokens, coût, état circuit breaker) + webhooks list
- **Composant racine** : `app/admin/metrics/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `ProviderMetricsCard`, `CircuitBreakerStatus`, `WebhooksTable`
- **États couverts** : idle, throttled, tripped, recovering
- **Priorité design** : P2
- **Note** : Auto-refresh 30s. Agrégats provider (latency p95, cache hit, headroom).

---

### Admin Analytics
- **Route/Trigger** : `/admin/analytics`
- **Intent** : Vue cross-tenant — runs, coût USD, missions, assets, users, top 10 tenants drill-down
- **Composant racine** : `app/admin/analytics/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `KPICard`, `TimeSeriesChart`, `TenantsTable`
- **États couverts** : loading, date range filters (7d/30d/90d), drill-down
- **Priorité design** : P2

---

### Admin Audit Log
- **Route/Trigger** : `/admin/audit`
- **Intent** : Logs d'accès — qui, quoi, quand, sévérité
- **Composant racine** : `app/admin/audit/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `LogEntry`, `SeverityBadge`, `FilterPanel`
- **États couverts** : loading, empty, error
- **Priorité design** : P3
- **Note** : 50 logs paginés. Severity color-coded (info/warning/error/critical).

---

### Admin Settings
- **Route/Trigger** : `/admin/settings`
- **Intent** : Settings système CRUD + feature flags toggle
- **Composant racine** : `app/admin/settings/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `SettingRow`, `ToggleSwitch`, feedback validation Zod
- **États couverts** : loading, display par catégorie, edit inline
- **Priorité design** : P2
- **Note** : Hiérarchie system < tenant < user. Cache 60s serveur.

---

### Admin Themes
- **Route/Trigger** : `/admin/themes`
- **Intent** : Sélecteur de theme registry — switch immédiat, persistence DB
- **Composant racine** : `app/admin/themes/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `ThemePicker`, `ThemeCard`, `PreviewCanvas`
- **États couverts** : loading, selected highlighted, error
- **Priorité design** : P2
- **Note** : Registry statique (`themes/_registry.ts`). Préférence user persiste DB.

---

### Admin Agents — Liste
- **Route/Trigger** : `/admin/agents`
- **Intent** : Répertoire agents LLM — liste, état runtime
- **Composant racine** : `app/admin/agents/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `AgentCard`
- **États couverts** : loading, empty, error
- **Priorité design** : P2

---

### Admin Agents — Détail
- **Route/Trigger** : `/admin/agents/[id]`
- **Intent** : Config LLM agent (model, temperature, max_tokens) + historique runs + chat replay
- **Composant racine** : `app/admin/agents/[id]/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `AgentForm` (Zod), `RunsTable`, `ChatReplay`
- **États couverts** : loading, editing, error (validation)
- **Priorité design** : P2

---

### Admin Agents — Création
- **Route/Trigger** : `/admin/agents/new`
- **Intent** : Formulaire création agent LLM
- **Composant racine** : `app/admin/agents/new/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `AgentForm` (Zod)
- **États couverts** : editing, error, success (redirect)
- **Priorité design** : P3

---

### Admin Runs — Liste
- **Route/Trigger** : `/admin/runs`
- **Intent** : Historique global des runs — status, kind, tokens, coût, latence
- **Composant racine** : `app/admin/runs/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `RunsTable`, filtres
- **États couverts** : loading, empty, error
- **Priorité design** : P2

---

### Admin Runs — Détail
- **Route/Trigger** : `/admin/runs/[id]`
- **Intent** : Traces détaillées d'un run — timeline, étapes colorisées, métriques, erreur stacktrace
- **Composant racine** : `app/admin/runs/[id]/page.tsx`
- **État** : existe (verrouillé v1.0)
- **Composants clés** : `RunDetail`, `TracesTimeline`, `ErrorDetail`
- **États couverts** : loading, error detail, trace drill-down
- **Priorité design** : P2
- **Note** : Traces colorisées par kind (llm_call/tool_call/memory_read/...).

---

### Admin Pipeline
- **Route/Trigger** : `/admin/pipeline`
- **Intent** : Canvas SSE live + replay du pipeline d'exécution
- **Composant racine** : `app/admin/pipeline/page.tsx` → `CanvasShell`
- **État** : existe
- **Composants clés** : `CanvasShell`, sous-composants `_canvas/`
- **États couverts** : live stream, replay, idle
- **Priorité design** : P2
- **Note** : Entièrement client (CanvasShell). Layout admin gère auth + KPI strip.

---

### Admin Agent-Driven Dev (Gouvernance)
- **Route/Trigger** : `/admin/agent-driven-dev`
- **Intent** : Interface de gouvernance ADD — verrou agent, manifest features, statuts
- **Composant racine** : `app/admin/agent-driven-dev/page.tsx`
- **État** : existe
- **Composants clés** : `AgentLockCard`, `RefreshManifestButton`, `FeatureEntry` list
- **États couverts** : locked/unlocked, loading manifest, error
- **Priorité design** : P3
- **Note** : Seul point de déverrouillage des agents. Lecture `docs/AGENT-LOCK.json`.

---

### Admin Agent-Driven Dev — Détail Feature
- **Route/Trigger** : `/admin/agent-driven-dev/[id]`
- **Intent** : Détail d'une spec feature versionnée — invariants, statut, historique
- **Composant racine** : `app/admin/agent-driven-dev/[id]/page.tsx`
- **État** : existe
- **Composants clés** : (à confirmer)
- **États couverts** : loading, notFound
- **Priorité design** : P3

---

### Admin Orchestrator — Overview (HOM)
- **Route/Trigger** : `/admin/orchestrator` → redirect `/admin/orchestrator/overview`
- **Intent** : Dashboard maître HOM — scores trust, drift, CC state, runs récents, quarantine
- **Composant racine** : `app/admin/orchestrator/overview/page.tsx` — `HomShell`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `MetricCell`, `StatusPill`, `StartRunButton`
- **États couverts** : loading, healthy, degraded, error (fail Supabase)
- **Priorité design** : P2
- **Note** : RSC force-dynamic. Parallel fetch 7 sources. HOM = Hearst Orchestration Master.

---

### Admin Orchestrator — Agents Contracts
- **Route/Trigger** : `/admin/orchestrator/agents`
- **Intent** : Capability contracts agents — scope, état runtime, quarantaine
- **Composant racine** : `app/admin/orchestrator/agents/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `StatusPill`
- **États couverts** : loading, quarantined, active
- **Priorité design** : P2

---

### Admin Orchestrator — Command Center
- **Route/Trigger** : `/admin/orchestrator/command-center`
- **Intent** : Pilotage live du mesh — état temps réel via SSE
- **Composant racine** : `app/admin/orchestrator/command-center/page.tsx` → `CommandCenterLive`
- **État** : existe
- **Composants clés** : `CommandCenterLive`, `HomShell`
- **États couverts** : loading, live SSE stream, error
- **Priorité design** : P2

---

### Admin Orchestrator — Drift
- **Route/Trigger** : `/admin/orchestrator/drift`
- **Intent** : Log de drift — par type et par fichier, top files dérivants
- **Composant racine** : `app/admin/orchestrator/drift/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `MetricCell`
- **États couverts** : loading, empty, error
- **Priorité design** : P3

---

### Admin Orchestrator — Quarantine
- **Route/Trigger** : `/admin/orchestrator/quarantine`
- **Intent** : Agents mis en quarantaine ou suspects — restore possible
- **Composant racine** : `app/admin/orchestrator/quarantine/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `RestoreAgentButton`, `StatusPill`
- **États couverts** : loading, empty (aucun en quarantaine), quarantined list
- **Priorité design** : P3

---

### Admin Orchestrator — Registry
- **Route/Trigger** : `/admin/orchestrator/registry`
- **Intent** : Registre des artifacts — filtrage par kind (all / sous-types)
- **Composant racine** : `app/admin/orchestrator/registry/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `MetricCell`
- **États couverts** : loading, view all/filtered
- **Priorité design** : P3

---

### Admin Orchestrator — Release Gates
- **Route/Trigger** : `/admin/orchestrator/release`
- **Intent** : Évaluation release gates — trust scores, drift, runs, go/no-go
- **Composant racine** : `app/admin/orchestrator/release/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `MetricCell`, `evaluateReleaseGates` output
- **États couverts** : loading, gates passed, gates failed
- **Priorité design** : P2

---

### Admin Orchestrator — Runs Liste
- **Route/Trigger** : `/admin/orchestrator/runs`
- **Intent** : Historique des runs du mesh HOM — décisions, signatures, séparé des runs user `/admin/runs`
- **Composant racine** : `app/admin/orchestrator/runs/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `PageHeader`, `listRuns()`
- **États couverts** : loading, empty, liste runs
- **Priorité design** : P2

---

### Admin Orchestrator — Run Détail
- **Route/Trigger** : `/admin/orchestrator/runs/[id]`
- **Intent** : Détail d'un run HOM — spans telemetry, décision signée, snapshot replay, bundle complet
- **Composant racine** : `app/admin/orchestrator/runs/[id]/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `MetricCell`, `StatusPill`, `readRunBundle()`, `readRunSpans()`
- **États couverts** : loading, notFound, détail spans + décision
- **Priorité design** : P2

---

### Admin Orchestrator — Telemetry
- **Route/Trigger** : `/admin/orchestrator/telemetry`
- **Intent** : Logs de télémétrie journaliers par agent, filtrable par day + agent
- **Composant racine** : `app/admin/orchestrator/telemetry/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `MetricCell`
- **États couverts** : loading, empty day, error
- **Priorité design** : P3

---

### Admin Orchestrator — Trust
- **Route/Trigger** : `/admin/orchestrator/trust`
- **Intent** : 7 dimensions de confiance — historique 30 derniers runs, trust gate
- **Composant racine** : `app/admin/orchestrator/trust/page.tsx`
- **État** : existe
- **Composants clés** : `HomShell`, `Card`, `MetricCell`, `trustGate` output
- **États couverts** : loading, passing, failing gate
- **Priorité design** : P2

---

## 5. Modules R&D

### Spatial / Cinema Mode
- **Route/Trigger** : `/spatial`
- **Intent** : Cockpit 3D immersif — scène R3F/Spline, KPI bento, overlays HTML, interactions caméra
- **Composant racine** : `app/spatial/page.tsx` → `components/spatial/core/SpatialRoot.tsx`
- **État** : WIP (en cours de migration Spline → R3F natif)
- **Composants clés** : `SpatialLayout`, `SpatialRoot`, `KPIBento`, `InteractionLayer`
- **États couverts** : loading Spline, error (render fail), overlay dégradé
- **Priorité design** : P2
- **Note** : Hors-DS, hors-ADD. RSC prefetch cockpit data best-effort. Style `spatial.css` isolé. Toggle in-app expert 2D ⇄ 3D (même stores/services).

---

### Spatial R&D
- **Route/Trigger** : `/spatial-rnd`
- **Intent** : Branche R&D parallèle du spatial — itérations expérimentales hors production
- **Composant racine** : `app/spatial-rnd/page.tsx` → `SpatialRndRoot`
- **État** : WIP
- **Composants clés** : `SpatialLayout`, `SpatialRndRoot`
- **États couverts** : loading, error (fail-soft)
- **Priorité design** : P2 (R&D interne)
- **Note** : Pattern identique à `/spatial`. Layout isolé `app/spatial-rnd/layout.tsx`. Serveur de test pour nouvelles scènes.

---

### `/spatial-safe` — LECTURE SEULE ABSOLUE
- **Route/Trigger** : `/spatial-safe` — sauvegarde figée, ne jamais modifier
- **Intent** : Backup de référence de la scène Spatial qui fonctionne (Spline + panels HTML)
- **Composant racine** : `app/spatial-safe/` (LECTURE SEULE)
- **État** : figé (sauvegarde)
- **Priorité design** : N/A — ne pas toucher
- **Note** : Filet de sécurité si `/spatial` casse pendant R&D. Aucune modification autorisée sans accord explicite d'Adrien.

---

## 6. Pages publiques (tokenisées — sans auth session)

### Approvals Public
- **Route/Trigger** : `/public/approvals/[token]`
- **Intent** : Page d'approbation collaborative — contexte mission + Approuver/Rejeter (HMAC token, sans session)
- **Composant racine** : `app/public/approvals/[token]/page.tsx`
- **État** : existe
- **Composants clés** : `ApprovalCard`, `VoteButton` × 2, logo Hearst
- **États couverts** : loading, vote possible, déjà voté, token expiré/invalide
- **Priorité design** : P1
- **Note** : Server component. HMAC token TTL 7j. `?action=approve|reject` pré-sélectionne bouton (pas vote auto — CSRF-safe). Dark mode, "silent luxury".

---

### Hearst Card Public
- **Route/Trigger** : `/public/hearst-card/[token]`
- **Intent** : Partage public d'une Hearst Card — image PNG ou render HTML, CTA PLG
- **Composant racine** : `app/public/hearst-card/[token]/page.tsx`
- **État** : existe
- **Composants clés** : `MonthlyCardView`, `CopyLinkButton`, `PLG CTA`
- **États couverts** : loading, card avec image, card sans image (HTML render), token invalide
- **Priorité design** : P1
- **Note** : Open Graph metadata avec og:image PNG. CTA "Créer mon Hearst OS →" (PLG).

---

### Reports Public
- **Route/Trigger** : `/public/reports/[token]`
- **Intent** : Rapport partagé en lecture seule — header sticky + rapport + CTA PLG + footer
- **Composant racine** : `app/public/reports/[token]/page.tsx`
- **État** : existe
- **Composants clés** : `ReportView`, header branded, `PLG CTA`
- **États couverts** : loading, valid, token invalide/expiré, robots noindex
- **Priorité design** : P1
- **Note** : Vitrine produit branded Hearst OS. Dark mode "silent luxury". `robots: noindex`.

---

### Hearst Card Interne (Rendu/Preview)
- **Route/Trigger** : `/hearst-card/[userId]/[yearMonth]`
- **Intent** : Rendu interne de la card — cible Playwright screenshotter (mode render bypass auth) + preview utilisateur loggé
- **Composant racine** : `app/hearst-card/[userId]/[yearMonth]/page.tsx`
- **État** : existe
- **Composants clés** : `MonthlyCardView`
- **États couverts** : screenshot (chrome stripped), preview user, token invalide, notFound
- **Priorité design** : P2
- **Note** : Double mode : HMAC token `mode=render` (Playwright) vs session NextAuth (user). Format `YYYY-MM` strict.

---

## 7. Vues planifiées / non implémentées visuellement

### Focus Mode (complet)
- **Route/Trigger** : Hotkey ⌘⇧F — composant `FocusBadge` existe mais incomplète
- **Intent** : Masquer rails, concentrer Stage canvas, badge dismiss ESC
- **État** : in_progress
- **Note** : `FocusBadge.tsx` existe, store `focus-mode` existe. Implémentation à finaliser.

---

### Daily Briefing — Trigger Auto
- **Route/Trigger** : Cron + `BriefingAutoTrigger` dans layout (6h–10h)
- **Intent** : Génération automatique briefing matinal — asset audio + PDF
- **État** : in_progress (feature `daily-brief`)
- **Note** : UI `/briefing` existe. Trigger auto dans layout existe. Worker BullMQ/Inngest à valider.

---

### Hearst Card Cron + Génération
- **Route/Trigger** : Cron `0 9 1 * *` → génération card + upload PNG + notification
- **Intent** : Card mensuelle auto-générée par Playwright, partageable via token HMAC
- **État** : in_progress (feature `hearst-card`)
- **Note** : Pages render + partage public existent. Cron + screenshotter Playwright (`screenshot.mjs`) à finaliser.

---

### Mission Approvals — Voting System
- **Route/Trigger** : `/public/approvals/[token]` (page existe) + email link + scheduler gate
- **Intent** : Flux approbation multi-utilisateur — modes all/any/majority, gate scheduler
- **État** : in_progress (feature `mission-approvals`)
- **Note** : Page publique existe. Scheduler gate + email dispatch à valider.

---

### Mission Budget / Spend Caps
- **Route/Trigger** : Injecté dans `/missions/[id]` (MissionStage) et mission run validator
- **Intent** : Enforcement cap mensuel de dépense — UI spend progress + éditeur cap
- **État** : in_progress (feature `mission-budget`)
- **Note** : Pas d'UI visible aujourd'hui. Backend `checkBudget()` existe. UI à construire.

---

### Pre-meeting Intel
- **Route/Trigger** : ContextRail durant fenêtre 25–35min avant event calendar
- **Intent** : Brief pré-réunion — entités KG, décisions récentes, historique participants
- **État** : in_progress (feature `pre-meeting-intel`)
- **Note** : Cron `*/5 * * * *`. Fail-soft Calendar + KG. Asset kind=pre_meeting_intel. Dedup 30min.

---

### Planner
- **Route/Trigger** : ? (Stage ou route dédiée non précisée)
- **Intent** : Planification des missions — draft-first flow, timeline, slots
- **État** : planifié (feature `planner`)
- **Note** : Store Zustand existe. Stage TBD. Pas de page.tsx visible.

---

### Spaces Phase 3
- **Route/Trigger** : ? (phases 1 & 2 live, phase 3 TBD)
- **Intent** : Workspaces collaboratifs partagés — perms, member roles, thread grouping
- **État** : in_progress phase 3 (feature `spaces`)
- **Note** : Phases 1 & 2 lisibles. Phase 3 scope non défini.

---

### Datasets
- **Route/Trigger** : ? (feature `datasets` dans manifest)
- **Intent** : Gestion datasets pour missions — upload, indexing, retrieval
- **État** : planifié (feature `datasets`)
- **Note** : Pas de page.tsx visible. Feature listée dans manifest.

---

### Webhooks (Interface)
- **Route/Trigger** : ? (feature `webhooks` — backend dans admin/metrics)
- **Intent** : Configuration webhooks sortants — liste, création, test
- **État** : partiel (feature `webhooks` — UI admin/metrics liste, mais pas de page dédiée CRUD)
- **Note** : `WebhooksTable` dans `/admin/metrics`. Pas de page de gestion dédiée.

---

### Connections détail / OAuth flows
- **Route/Trigger** : `/apps` (existe) + callbacks OAuth implicites
- **Intent** : Flux OAuth détaillés par provider — reconnexion, token refresh, status
- **État** : partiel (feature `connections`)
- **Note** : Hub `/apps` existe. Callbacks OAuth via NextAuth. Pas de page détail par provider.

---

## Synthèse

### Totaux par catégorie

| Catégorie | Nombre |
|---|---|
| Stages cockpit (modes polymorphes) | 12 |
| Routes utilisateur `(user)` hors Stages | 17 |
| Overlays & command surfaces | 12 |
| Auth & onboarding | 2 |
| Admin | 25 |
| Modules R&D (spatial) | 3 |
| Pages publiques tokenisées | 4 |
| **Total routes page.tsx** | **58** |
| Vues planifiées / in_progress | 10 |
| **Total surfaces visuelles** | **~85** |

---

### Top 5 priorités P0 — à designer en premier

1. **Cockpit Stage** — premier écran après login, KPIs, hub central. Complexité max.
2. **Chat Stage + ChatDock** — sanctuaire produit, tous les workflows y transitent. Fréquence quotidienne.
3. **PulseBar** — système nerveux visible en permanence en haut. Moindre erreur = visible partout.
4. **Login** — première impression absolue. Conversion directe.
5. **ApprovalInline** — gate de confiance critique sur toute action write. Mal designé = friction ou clic aveugle.

---

### Top 5 candidats refonte visionOS

1. **Cockpit Stage** — KPI bento + ambient data = surface idéale pour spatial layers
2. **Chat Stage** — conversation vocale + text naturellement transposable en visionOS chat overlay
3. **Knowledge Graph Stage** — graphe Cytoscape 3D natif, entités spatiales, depth réel
4. **Voice Stage + VoicePulse** — interface vocale zero-UI, parfaite pour RV (pas d'écran = voice-first)
5. **Mission Runner Stage** — workflow multi-étapes visualisé en timeline spatiale, status en temps réel

---

### Surfaces orphelines / à clarifier

- **`/reports/editor`** — page démo `ReportSpecEditor` avec données hardcodées. Dev tool ou surface user ? À décider.
- **`/marketplace/[id]`** — lien depuis `/marketplace` à vérifier. Détail template — implémentation à confirmer.
- **`/hospitality`** — IDs fictifs hardcodés. Surface MVP ou dead-end ? À migrer vers API catalog vertical ou supprimer.
- **`/spatial-rnd`** — branche R&D interne. Pas de navigation user vers cette route. Usage dev only.
- **`StageFooter`** — rôle exact selon Stage actif à préciser. Peut-être vide dans la majorité des cas.
- **Planner, Datasets** — features dans manifest sans page.tsx visible. Scope à définir avant design.
- **Webhooks CRUD** — `WebhooksTable` dans metrics admin mais pas de page dédiée gestion.
