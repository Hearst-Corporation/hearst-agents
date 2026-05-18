/**
 * @hearst/cockpit-shell — exports publics.
 *
 * Stylesheet à importer une fois dans `app/layout.tsx` :
 *   `import "@hearst/cockpit-shell/tokens.css";`
 *
 * Handler API à utiliser dans `app/api/cockpit-chat/route.ts` :
 *   `import { createCockpitChatHandler } from "@hearst/cockpit-shell/handler";`
 */

// Shell
export { CockpitShell } from "./shell/CockpitShell";
export { RailLeft } from "./shell/RailLeft";
export { CenterPanel } from "./shell/CenterPanel";
export { RailRight } from "./shell/RailRight";
export { ProductBottomBar } from "./shell/ProductBottomBar";
export { ThemeAccent } from "./shell/ThemeAccent";
export { HearstMark } from "./shell/HearstMark";
export { useCockpit } from "./shell/context";
export { attachHubBridge, pushContext } from "./shell/hubBridge";
export type { HubContext } from "./shell/hubBridge";
export type {
  CockpitShellProps,
  CockpitProduct,
  CenterPanelProps,
} from "./shell/types";

// Chat
export { ChatKimi } from "./chat/ChatKimi";
export { useChat } from "./chat/useChat";
export type { UseChatOptions, UseChatReturn, DisplayMessage } from "./chat/useChat";
export type { ChatPersistence, ChatMessage, ChatConfig } from "./chat/types";

// Primitives
export {
  Eyebrow,
  Title,
  Sub,
  KpiGrid,
  KpiCard,
  Card,
} from "./primitives";

// Stores (pour les apps qui veulent piloter l'état du shell depuis l'extérieur)
export {
  subscribe as subscribeActiveProduct,
  setDefaultActive,
  getSnapshot as getActiveProduct,
  setActive as setActiveProduct,
} from "./stores/activeProductStore";
export { subscribe as subscribeRailRight } from "./stores/railOpenStore";
export { subscribe as subscribeLauncher } from "./stores/launcherStore";
