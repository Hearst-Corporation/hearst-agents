/**
 * navigation-truth.ts — Source unique de vérité Hearst OS.
 * Auditée v2 — Correction off-by-one ⌘N→Stage + verbes Commandeur exhaustifs.
 * Dernière mise à jour : 2026-05-15 par scan exhaustif (stores + hotkeys + routes + Commandeur).
 */

export type StageId =
  | "cockpit"
  | "chat"
  | "asset"
  | "asset_compare"
  | "mission"
  | "browser"
  | "meeting"
  | "kg"
  | "voice"
  | "simulation"
  | "artifact"
  | "signal";

export interface Stage {
  id: StageId;
  label: string;
  description: string;
  trigger: "default" | "cmd-k" | "selection" | "hotkey";
  hotkey?: string;
  dataShape: string;
  persistedFields: string[];
  fileRef: string;
}

export const STAGES: Stage[] = [
  {
    id: "cockpit",
    label: "Cockpit",
    description: "Vue d'accueil polymorphe — briefing du jour, agenda, missions, KPIs.",
    trigger: "default",
    hotkey: "⌘1",
    dataShape: "{ mode: 'cockpit' }",
    persistedFields: [],
    fileRef: "stores/stage.ts:24,181-182",
  },
  {
    id: "chat",
    label: "Conversation",
    description: "Échange libre avec l'agent — messages + ChatDock.",
    trigger: "selection",
    hotkey: "⌘2",
    dataShape: "{ mode: 'chat', threadId?: string }",
    persistedFields: [],
    fileRef: "stores/stage.ts:25,183",
  },
  {
    id: "asset",
    label: "Asset",
    description: "Inspection d'un asset (fichier, contact, projet, doc) avec variants tabs.",
    trigger: "selection",
    hotkey: "⌘3",
    dataShape: "{ mode: 'asset', assetId: string, variantKind?: string }",
    persistedFields: ["lastAssetId"],
    fileRef: "stores/stage.ts:26,64,184",
  },
  {
    id: "asset_compare",
    label: "Comparaison",
    description: "Diff entre 2+ assets — split view + sémantique.",
    trigger: "selection",
    hotkey: undefined,
    dataShape: "{ mode: 'asset_compare', assetIds: string[] }",
    persistedFields: [],
    fileRef: "stores/stage.ts:27,42",
  },
  {
    id: "mission",
    label: "Mission",
    description: "Exécution d'une mission par un agent — plan + steps + approval.",
    trigger: "selection",
    hotkey: "⌘9",
    dataShape: "{ mode: 'mission', missionId: string }",
    persistedFields: ["lastMissionId"],
    fileRef: "stores/stage.ts:28,67,190",
  },
  {
    id: "browser",
    label: "Navigateur",
    description: "Session browser live co-pilotable (Browserbase).",
    trigger: "cmd-k",
    hotkey: "⌘4",
    dataShape: "{ mode: 'browser', sessionId: string }",
    persistedFields: [],
    fileRef: "stores/stage.ts:29,185",
  },
  {
    id: "meeting",
    label: "Réunion",
    description: "Meeting bot live + transcript + action items extraits.",
    trigger: "cmd-k",
    hotkey: "⌘5",
    dataShape: "{ mode: 'meeting', meetingId: string }",
    persistedFields: [],
    fileRef: "stores/stage.ts:30,186",
  },
  {
    id: "kg",
    label: "Knowledge Graph",
    description: "Explorer de la mémoire structurée (Cytoscape).",
    trigger: "cmd-k",
    hotkey: "⌘6",
    dataShape: "{ mode: 'kg', entityId?: string, query?: string }",
    persistedFields: [],
    fileRef: "stores/stage.ts:31,187",
  },
  {
    id: "voice",
    label: "Voix ambient",
    description: "Overlay voix ambient temps réel — WebRTC full-duplex.",
    trigger: "hotkey",
    hotkey: "⌘7",
    dataShape: "{ mode: 'voice', sessionId?: string }",
    persistedFields: [],
    fileRef: "stores/stage.ts:32,188",
  },
  {
    id: "simulation",
    label: "Chambre de Simulation",
    description: "DeepSeek scenarios chiffrés — scénarios de modélisation.",
    trigger: "cmd-k",
    hotkey: "⌘8",
    dataShape: "{ mode: 'simulation', scenario?: string }",
    persistedFields: [],
    fileRef: "stores/stage.ts:33,189",
  },
  {
    id: "artifact",
    label: "Artifact",
    description: "Éditeur code (Python/Node) + sandbox E2B runtime.",
    trigger: "selection",
    hotkey: "⌘0",
    dataShape:
      "{ mode: 'artifact', artifactId?: string, code?: string, language?: 'python'|'node' }",
    persistedFields: [],
    fileRef: "stores/stage.ts:34,191",
  },
  {
    id: "signal",
    label: "Signal Board",
    description: "Drill-down des signaux ambient — alertes, push, news (Q3-B).",
    trigger: "selection",
    hotkey: undefined,
    dataShape: "{ mode: 'signal', selectedSignalId?: string }",
    persistedFields: [],
    fileRef: "stores/stage.ts:35,50",
  },
];

export interface StoreShape {
  name: string;
  file: string;
  fields: string[];
  persisted: boolean;
  purpose: string;
  hotkey?: string;
}

export const STORES: StoreShape[] = [
  {
    name: "useStageStore",
    file: "stores/stage.ts:100",
    fields: [
      "current",
      "history",
      "lastAssetId",
      "lastMissionId",
      "commandeurOpen",
      "commandeurPrefilledQuery",
      "setMode",
      "back",
      "reset",
      "toggleCommandeur",
    ],
    persisted: false,
    purpose: "Pilote le Stage courant + hotkey→mode mapping (⌘1-9, ⌘0). Reset au mount.",
  },
  {
    name: "useNavigationStore",
    file: "stores/navigation.ts:66",
    fields: ["surface", "threads", "activeThreadId", "messages", "leftCollapsed", "leftDrawerOpen"],
    persisted: true,
    purpose:
      "Threads et surface courante. Métadonnées seulement (messages PII-cleared à chaque login).",
  },
  {
    name: "useFocalStore",
    file: "stores/focal.ts:126",
    fields: [
      "focal",
      "secondary",
      "pinnedFocalKey",
      "isVisible",
      "isFocused",
      "hasContent",
      "setFocal",
      "hydrateThreadState",
    ],
    persisted: false,
    purpose:
      "Objet focal du Stage actif (brief, report, message, mission). Pin explicite vs SSE updates.",
  },
  {
    name: "useSelectionStore",
    file: "stores/selection.ts:37",
    fields: ["current", "select", "clear"],
    persisted: false,
    purpose:
      "Sélection single (agent/mission/asset/report). Affiche la Strate 5 du ContextRail en cockpit.",
  },
  {
    name: "useRuntimeStore",
    file: "stores/runtime.ts:95",
    fields: [
      "connected",
      "coreState",
      "currentRunId",
      "lastRunId",
      "currentPlan",
      "events",
      "abortController",
    ],
    persisted: false,
    purpose: "Runs en cours (missions/browser/simulation) + plan lifecycle + SSE event stream.",
  },
  {
    name: "useActiveSpace",
    file: "stores/active-space.ts:78",
    fields: ["activeSpaceId", "spaces"],
    persisted: true,
    purpose: "Espace de travail courant (personal/side-project/venture) + cookie sync server-side.",
  },
  {
    name: "useFocusMode",
    file: "stores/focus-mode.ts:40",
    fields: ["enabled", "toggle"],
    persisted: true,
    purpose: "Mode plein-écran (⌘⇧F) — masque PulseBar + TimelineRail + ContextRail.",
    hotkey: "⌘⇧F",
  },
  {
    name: "useChatContext",
    file: "stores/chat-context.ts:31",
    fields: ["chips", "addChip", "removeChip", "clearChips"],
    persisted: true,
    purpose:
      "Context sources épinglées (topic/asset/mission/report) — Thinking Canvas du ChatDock.",
  },
  {
    name: "useWorkingDocumentStore",
    file: "stores/working-document.ts:47",
    fields: ["current", "isOpen", "open", "close", "updateContent"],
    persisted: false,
    purpose: "Document de travail expandé à droite (Lot C). Brouillon volatile.",
    hotkey: "⌘B",
  },
  {
    name: "useVideoQuickLaunchStore",
    file: "stores/video-quick-launch.ts:24",
    fields: ["open", "toggle", "openLauncher", "close"],
    persisted: false,
    purpose: "Panel ⌘G (S2-A) — génération vidéo Runway text-to-video.",
    hotkey: "⌘G",
  },
  {
    name: "useVoiceStore",
    file: "stores/voice.ts:63",
    fields: ["phase", "sessionId", "transcript", "audioLevel", "voiceActive", "error"],
    persisted: false,
    purpose: "Pipeline WebRTC voix — transcript + audio level + function calling (Composio).",
    hotkey: "⌘⇧V",
  },
];

export interface Hotkey {
  combo: string;
  action: string;
  scope: "global" | "input-override" | "modal";
  file: string;
  line: number;
}

export const HOTKEYS: Hotkey[] = [
  {
    combo: "⌘1",
    action: "setMode({ mode: 'cockpit' })",
    scope: "global",
    file: "stores/stage.ts",
    line: 181,
  },
  {
    combo: "⌘2",
    action: "setMode({ mode: 'chat' })",
    scope: "global",
    file: "stores/stage.ts",
    line: 183,
  },
  {
    combo: "⌘3",
    action: "setMode({ mode: 'asset', assetId: lastAssetId })",
    scope: "global",
    file: "stores/stage.ts",
    line: 184,
  },
  {
    combo: "⌘4",
    action: "setMode({ mode: 'browser', sessionId: '' })",
    scope: "global",
    file: "stores/stage.ts",
    line: 185,
  },
  {
    combo: "⌘5",
    action: "setMode({ mode: 'meeting', meetingId: '' })",
    scope: "global",
    file: "stores/stage.ts",
    line: 186,
  },
  {
    combo: "⌘6",
    action: "setMode({ mode: 'kg' })",
    scope: "global",
    file: "stores/stage.ts",
    line: 187,
  },
  {
    combo: "⌘7",
    action: "setMode({ mode: 'voice' })",
    scope: "global",
    file: "stores/stage.ts",
    line: 188,
  },
  {
    combo: "⌘8",
    action: "setMode({ mode: 'simulation' })",
    scope: "global",
    file: "stores/stage.ts",
    line: 189,
  },
  {
    combo: "⌘9",
    action: "setMode({ mode: 'mission', missionId: lastMissionId })",
    scope: "global",
    file: "stores/stage.ts",
    line: 190,
  },
  {
    combo: "⌘0",
    action: "setMode({ mode: 'artifact' })",
    scope: "global",
    file: "stores/stage.ts",
    line: 191,
  },
  {
    combo: "⌘K",
    action: "toggleCommandeur()",
    scope: "input-override",
    file: "app/hooks/use-global-hotkeys.ts",
    line: 84,
  },
  {
    combo: "⌘B",
    action: "useWorkingDocumentStore.toggle()",
    scope: "global",
    file: "app/hooks/use-global-hotkeys.ts",
    line: 93,
  },
  {
    combo: "⌘G",
    action: "useVideoQuickLaunchStore.toggle()",
    scope: "input-override",
    file: "app/hooks/use-global-hotkeys.ts",
    line: 102,
  },
  {
    combo: "⌘⇧F",
    action: "useFocusMode.toggle()",
    scope: "global",
    file: "app/hooks/use-global-hotkeys.ts",
    line: 66,
  },
  {
    combo: "⌘⇧V",
    action: "useVoiceStore.setVoiceActive(); setMode({ mode: 'voice' })",
    scope: "global",
    file: "app/hooks/use-global-hotkeys.ts",
    line: 49,
  },
  {
    combo: "⌘⌫",
    action: "useStageStore.back()",
    scope: "global",
    file: "app/hooks/use-global-hotkeys.ts",
    line: 170,
  },
  {
    combo: "Escape",
    action: "useFocusMode.disable() (si enabled)",
    scope: "global",
    file: "app/hooks/use-global-hotkeys.ts",
    line: 76,
  },
];

export interface CommandAction {
  id: string;
  label: string;
  category: "navigation" | "selection" | "creation" | "system";
  route?: string;
  sideEffect?: string;
  hotkey?: string;
  file: string;
  line: number;
}

export const COMMANDS: CommandAction[] = [
  {
    id: "nav-reports",
    label: "Voir les rapports",
    category: "navigation",
    route: "/reports",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 47,
  },
  {
    id: "nav-missions",
    label: "Mes missions",
    category: "navigation",
    route: "/missions",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 57,
  },
  {
    id: "nav-runs",
    label: "Mes exécutions",
    category: "navigation",
    route: "/runs",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 68,
  },
  {
    id: "nav-notifications",
    label: "Voir les notifications",
    category: "navigation",
    route: "/notifications",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 77,
  },
  {
    id: "nav-apps",
    label: "Voir les apps connectées",
    category: "navigation",
    route: "/apps",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 86,
  },
  {
    id: "nav-marketplace",
    label: "Marketplace",
    category: "navigation",
    route: "/marketplace",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 97,
  },
  {
    id: "nav-settings",
    label: "Réglages",
    category: "navigation",
    route: "/settings",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 107,
  },
  {
    id: "nav-settings-alerting",
    label: "Paramètres alerting",
    category: "navigation",
    route: "/settings/alerting",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 117,
  },
  {
    id: "open-archive",
    label: "Voir l'archive",
    category: "navigation",
    route: "/archive",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 127,
  },
  {
    id: "open-hospitality",
    label: "Hospitality Mode",
    category: "navigation",
    route: "/hospitality",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 137,
  },
  {
    id: "open-admin",
    label: "Console admin",
    category: "navigation",
    route: "/admin",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 147,
  },
  {
    id: "action-new-mission",
    label: "Nouvelle mission",
    category: "creation",
    route: "/missions?new=1",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 157,
  },
  {
    id: "action-launch-report",
    label: "Lancer un rapport",
    category: "creation",
    route: "/reports/studio",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 167,
  },
  {
    id: "action-compare-assets",
    label: "Comparer 2 assets",
    category: "selection",
    sideEffect: "onCompareOpen()",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 279,
  },
  {
    id: "go-cockpit",
    label: "Ouvrir le Cockpit",
    category: "system",
    sideEffect: "setMode({ mode: 'cockpit' })",
    hotkey: "⌘1",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 177,
  },
  {
    id: "go-chat",
    label: "Aller au Chat",
    category: "system",
    sideEffect: "setMode({ mode: 'chat' })",
    hotkey: "⌘2",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 188,
  },
  {
    id: "go-asset",
    label: "Ouvrir le dernier asset",
    category: "system",
    sideEffect: "setMode({ mode: 'asset', assetId: lastAssetId })",
    hotkey: "⌘3",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 199,
  },
  {
    id: "go-browser",
    label: "Browser Stage",
    category: "system",
    sideEffect: "setMode({ mode: 'browser', sessionId: '' })",
    hotkey: "⌘4",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 212,
  },
  {
    id: "go-meeting",
    label: "Meeting Stage",
    category: "system",
    sideEffect: "setMode({ mode: 'meeting', meetingId: '' })",
    hotkey: "⌘5",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 223,
  },
  {
    id: "go-kg",
    label: "Knowledge Graph",
    category: "system",
    sideEffect: "setMode({ mode: 'kg' })",
    hotkey: "⌘6",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 234,
  },
  {
    id: "go-voice",
    label: "Mode voix ambient",
    category: "system",
    sideEffect: "setMode({ mode: 'voice' })",
    hotkey: "⌘7",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 245,
  },
  {
    id: "go-simulation",
    label: "Chambre de Simulation",
    category: "system",
    sideEffect: "setMode({ mode: 'simulation' })",
    hotkey: "⌘8",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 257,
  },
  {
    id: "go-artifact",
    label: "Artifact (code + E2B)",
    category: "system",
    sideEffect: "setMode({ mode: 'artifact' })",
    hotkey: "⌘0",
    file: "app/(user)/components/use-commandeur-actions.ts",
    line: 268,
  },
];

export interface Route {
  path: string;
  label: string;
  tier: "core" | "periph" | "admin" | "public" | "rd";
  layout: string;
  file: string;
}

export const ROUTES: Route[] = [
  {
    path: "/",
    label: "Cockpit / Accueil",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/page.tsx",
  },
  {
    path: "/briefing",
    label: "Briefing du jour",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/briefing/page.tsx",
  },
  {
    path: "/assets",
    label: "Galerie assets",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/assets/page.tsx",
  },
  {
    path: "/assets/[id]",
    label: "Détail asset",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/assets/[id]/page.tsx",
  },
  {
    path: "/missions",
    label: "Missions (templates + runs)",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/missions/page.tsx",
  },
  {
    path: "/missions/[id]",
    label: "Détail mission",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/missions/[id]/page.tsx",
  },
  {
    path: "/missions/builder",
    label: "Mission builder (drawer)",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/missions/builder/page.tsx",
  },
  {
    path: "/reports",
    label: "Rapports (historique)",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/reports/page.tsx",
  },
  {
    path: "/reports/studio",
    label: "Report studio (création)",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/reports/studio/page.tsx",
  },
  {
    path: "/reports/editor",
    label: "Éditeur rapports",
    tier: "core",
    layout: "(user)",
    file: "app/(user)/reports/editor/page.tsx",
  },
  {
    path: "/runs",
    label: "Exécutions (historique runs)",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/runs/page.tsx",
  },
  {
    path: "/runs/[id]",
    label: "Détail exécution",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/runs/[id]/page.tsx",
  },
  {
    path: "/notifications",
    label: "Centre signaux et alertes",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/notifications/page.tsx",
  },
  {
    path: "/apps",
    label: "Apps connectées (OAuth)",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/apps/page.tsx",
  },
  {
    path: "/archive",
    label: "Archive (threads/assets > 7j)",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/archive/page.tsx",
  },
  {
    path: "/marketplace",
    label: "Marketplace (templates communautaires)",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/marketplace/page.tsx",
  },
  {
    path: "/marketplace/[id]",
    label: "Détail template marketplace",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/marketplace/[id]/page.tsx",
  },
  {
    path: "/hospitality",
    label: "Hospitality Mode (cockpit vertical hôtellerie)",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/hospitality/page.tsx",
  },
  {
    path: "/personas",
    label: "Personas (gestion agents)",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/personas/page.tsx",
  },
  {
    path: "/settings",
    label: "Réglages utilisateur",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/settings/page.tsx",
  },
  {
    path: "/settings/alerting",
    label: "Config alerting (seuils + canaux)",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/settings/alerting/page.tsx",
  },
  {
    path: "/onboarding/vertical",
    label: "Onboarding industrie",
    tier: "periph",
    layout: "(user)",
    file: "app/(user)/onboarding/vertical/page.tsx",
  },
  {
    path: "/admin",
    label: "Console admin",
    tier: "admin",
    layout: "admin",
    file: "app/admin/page.tsx",
  },
  {
    path: "/admin/agents",
    label: "Gestion agents",
    tier: "admin",
    layout: "admin",
    file: "app/admin/agents/page.tsx",
  },
  {
    path: "/admin/agents/new",
    label: "Créer agent",
    tier: "admin",
    layout: "admin",
    file: "app/admin/agents/new/page.tsx",
  },
  {
    path: "/admin/agents/[id]",
    label: "Détail agent",
    tier: "admin",
    layout: "admin",
    file: "app/admin/agents/[id]/page.tsx",
  },
  {
    path: "/admin/agent-driven-dev",
    label: "Gouvernance ADD (batch + fixer)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/agent-driven-dev/page.tsx",
  },
  {
    path: "/admin/agent-driven-dev/[id]",
    label: "Détail batch ADD",
    tier: "admin",
    layout: "admin",
    file: "app/admin/agent-driven-dev/[id]/page.tsx",
  },
  {
    path: "/admin/analytics",
    label: "Analytics (événements + cohortes)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/analytics/page.tsx",
  },
  {
    path: "/admin/audit",
    label: "Audit log (actions utilisateurs)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/audit/page.tsx",
  },
  {
    path: "/admin/health",
    label: "Santé système (checks)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/health/page.tsx",
  },
  {
    path: "/admin/metrics",
    label: "Métriques (Prometheus + Grafana)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/metrics/page.tsx",
  },
  {
    path: "/admin/pipeline",
    label: "Configuration pipeline LLM",
    tier: "admin",
    layout: "admin",
    file: "app/admin/pipeline/page.tsx",
  },
  {
    path: "/admin/runs",
    label: "Runs (vue admin omnisciente)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/runs/page.tsx",
  },
  {
    path: "/admin/runs/[id]",
    label: "Détail run admin",
    tier: "admin",
    layout: "admin",
    file: "app/admin/runs/[id]/page.tsx",
  },
  {
    path: "/admin/settings",
    label: "Config système (workspace, OAuth)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/settings/page.tsx",
  },
  {
    path: "/admin/themes",
    label: "Gestion themes visuels",
    tier: "admin",
    layout: "admin",
    file: "app/admin/themes/page.tsx",
  },
  {
    path: "/admin/orchestrator",
    label: "Orchestrator (B-series)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/page.tsx",
  },
  {
    path: "/admin/orchestrator/overview",
    label: "Vue d'ensemble orchestrator",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/overview/page.tsx",
  },
  {
    path: "/admin/orchestrator/agents",
    label: "Agents orchestrator",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/agents/page.tsx",
  },
  {
    path: "/admin/orchestrator/command-center",
    label: "Command center (pilotage direct)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/command-center/page.tsx",
  },
  {
    path: "/admin/orchestrator/drift",
    label: "Détection drift agents",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/drift/page.tsx",
  },
  {
    path: "/admin/orchestrator/quarantine",
    label: "Quarantine agents (isolation)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/quarantine/page.tsx",
  },
  {
    path: "/admin/orchestrator/registry",
    label: "Registry agents (versioning)",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/registry/page.tsx",
  },
  {
    path: "/admin/orchestrator/release",
    label: "Release notes agents",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/release/page.tsx",
  },
  {
    path: "/admin/orchestrator/runs",
    label: "Runs orchestrator",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/runs/page.tsx",
  },
  {
    path: "/admin/orchestrator/runs/[id]",
    label: "Détail run orchestrator",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/runs/[id]/page.tsx",
  },
  {
    path: "/admin/orchestrator/telemetry",
    label: "Telemetry agents",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/telemetry/page.tsx",
  },
  {
    path: "/admin/orchestrator/trust",
    label: "Trust scoring agents",
    tier: "admin",
    layout: "admin",
    file: "app/admin/orchestrator/trust/page.tsx",
  },
  {
    path: "/login",
    label: "Connexion",
    tier: "public",
    layout: "none",
    file: "app/login/page.tsx",
  },
  {
    path: "/public/approvals/[token]",
    label: "Lien approbation public",
    tier: "public",
    layout: "none",
    file: "app/public/approvals/[token]/page.tsx",
  },
  {
    path: "/public/reports/[token]",
    label: "Rapport partagé public",
    tier: "public",
    layout: "none",
    file: "app/public/reports/[token]/page.tsx",
  },
  {
    path: "/public/hearst-card/[token]",
    label: "Hearst card public",
    tier: "public",
    layout: "none",
    file: "app/public/hearst-card/[token]/page.tsx",
  },
  {
    path: "/hearst-card/[userId]/[yearMonth]",
    label: "Hearst card utilisateur",
    tier: "periph",
    layout: "(user)",
    file: "app/hearst-card/[userId]/[yearMonth]/page.tsx",
  },
  {
    path: "/spatial",
    label: "Spatial 3D (prototype — orphelin)",
    tier: "rd",
    layout: "none",
    file: "app/spatial/page.tsx",
  },
  {
    path: "/spatial-safe",
    label: "Spatial backup (read-only absolu)",
    tier: "rd",
    layout: "none",
    file: "app/spatial-safe/page.tsx",
  },
  {
    path: "/spatial-rnd",
    label: "Spatial R&D (expérimental)",
    tier: "rd",
    layout: "none",
    file: "app/spatial-rnd/page.tsx",
  },
];

export const SHELL_COMPONENTS = {
  topBar: "PulseBar (état système + notifications + credits)",
  leftRail: "LeftPanelShell (TimelineRail — threads + surfaces)",
  centerStage: "Stage polymorphe (cockpit/chat/asset/mission/etc.)",
  rightRail: "RightPanel (ContextRail — Strate 5 sélection ou focal)",
  bottomBar: "StageFooter (flowLabel + coût + état run)",
  overlayPalette: "Commandeur (Cmd+K palette de commandes)",
  overlayPanel: "VideoQuickLaunch (⌘G — génération vidéo S2-A)",
  floatingBadge: "FocusBadge (Mode Focus actif · Échap pour sortir)",
  webrtcPipeline: "VoicePulse (WebRTC + OpenAI Realtime — voix ambient)",
  mobileNav: "MobileBottomNav (navigation mobile < md)",
  file: "app/(user)/layout.tsx:86-207",
} as const;

export const KNOWN_GAPS: string[] = [
  "Stage non URL-synced — reload retombe sur cockpit (perte de contexte). useStageStore non persisté.",
  "Pas de deep-link /assets/[id] direct vers asset depuis URL — assets non-bookmarkables, sharing impossible.",
  "Thread messages non rechargés depuis API au changement de activeThreadId — vide à l'ouverture. F-077 délibéré (PII).",
  "/spatial orphelin — zéro lien depuis cockpit ou Commandeur. Prototype R&D sans intégration.",
  "Escape ne cascade pas sémantiquement (modale → Commandeur → désélection → Stage back).",
  "asset_compare mode non routé — accessible uniquement via Commandeur, pas de deeplink.",
  "Commandeur sections dynamiques — pas de registry JSON centralisé, useMemo local au composant.",
  "useWorkingDocumentStore (⌘B) non documenté en v1 — feature C-lot nova sans test exhaustif.",
];
