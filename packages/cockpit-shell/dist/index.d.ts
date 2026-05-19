import * as react_jsx_runtime from 'react/jsx-runtime';
import { ReactNode } from 'react';

/**
 * types.ts — Types publics du chat Cockpit.
 *
 * `ChatPersistence` est le point d'extension : les apps qui veulent une
 * persistance Supabase fournissent une implémentation ; sinon le chat reste
 * en mémoire locale.
 */
interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
}
/**
 * Persistance optionnelle du chat. Toutes les méthodes sont async pour ne
 * pas bloquer le rendu. Aucune n'est appelée si `persistence` est absent.
 */
interface ChatPersistence {
    /** Charge l'historique d'une conversation existante. */
    loadMessages(chatId: string): Promise<ChatMessage[]>;
    /** Sauvegarde un message. */
    saveMessage(chatId: string, msg: ChatMessage): Promise<void>;
    /** Crée une nouvelle conversation, retourne l'ID. */
    createChat(): Promise<string>;
}
/**
 * Config passée à `<CockpitShell chatConfig={...}>`.
 * Permet à chaque app d'orienter le chat vers son endpoint custom + d'injecter
 * une persistance + un libellé de contexte produit.
 */
interface ChatConfig {
    apiEndpoint?: string;
    persistence?: ChatPersistence;
    productContext?: string;
}

/**
 * types.ts — Types publics du shell Cockpit.
 *
 * Le shell est *agnostique* du catalogue produit du hub : chaque app passe
 * sa propre liste via la prop `products`. Le shell n'impose qu'une forme
 * minimale (id + name + color + short) — tout le reste reste interne à l'app.
 */

/** Props du CenterPanel — render-prop pour embed produit (hub uniquement). */
interface CenterPanelProps {
    children: ReactNode;
    renderProduct?: (activeId: string) => ReactNode;
}
/**
 * Forme minimale d'un produit attendue par le shell.
 * Les apps peuvent étendre ce type pour leurs besoins internes : on ne
 * lit que ces champs ici.
 */
interface CockpitProduct {
    /** Identifiant stable ; "hub" est conventionnellement le produit hôte. */
    id: string;
    /** Nom commercial complet (tooltip rail, bottom bar). */
    name: string;
    /** Sigle 2 lettres (pastille du rail). */
    short: string;
    /** Accent d'identité (hex). */
    color: string;
}
/**
 * Props du `<CockpitShell>` — point d'entrée unique de tous les apps Hearst.
 */
interface CockpitShellProps {
    children: ReactNode;
    /**
     * Liste des produits affichés dans le lanceur du rail gauche.
     * L'élément avec `id === appId` est traité comme produit hôte : son
     * entrée n'apparaît pas dans le lanceur du rail gauche.
     */
    products: CockpitProduct[];
    /** Id de l'app courante (= produit hôte). */
    appId: string;
    /** Config du chat — endpoint, persistance, contexte produit. */
    chatConfig?: ChatConfig;
    /**
     * Render-prop optionnel : invoqué dans le CenterPanel quand un autre produit
     * que l'app hôte est actif. Utilisé exclusivement par le hub pour embedder
     * les 12 produits en `<webview>` Electron. Les apps produit standalone
     * laissent cette prop vide.
     */
    renderActiveProduct?: (activeId: string) => ReactNode;
}

/**
 * `<CockpitShell>` — point d'entrée unique.
 *
 * Enveloppe l'app : Rail gauche + centre + rail droit (chat Kimi). En mode
 * « immersif » (produit autre que `appId` actif) les rails du hub glissent
 * pour laisser le produit occuper l'écran (transition CSS).
 */
declare function CockpitShell({ children, products, appId, chatConfig, renderActiveProduct, }: CockpitShellProps): react_jsx_runtime.JSX.Element;

/**
 * Rail gauche — accordéon lanceur de la suite Hearst.
 *
 * - Lanceur OUVERT : rail élargi, tous les produits (hache + nom). Clic produit
 *   → on entre dans le produit, le lanceur se replie.
 * - Lanceur REPLIÉ : rail 88px, en haut le badge du produit actif (sa couleur,
 *   son nom) qui sert de toggle ; reclic → le lanceur se redéploie.
 */
declare function RailLeft(): react_jsx_runtime.JSX.Element;

/**
 * CenterPanel — zone centrale de l'app.
 *
 * Comportement par défaut (cas des 12 apps produit) :
 *   - rend `children` dans `.ct-page-area` (= la page courante de l'app).
 *
 * Comportement override (cas du hub agrégateur) :
 *   - si `renderProduct` est fourni : quand l'utilisateur sélectionne un
 *     autre produit que `appId` dans le rail gauche, on délègue à ce
 *     render-prop pour afficher le produit (webview Electron côté hub).
 *
 * Le shell reste donc générique : il ne sait pas embedder un produit, il
 * laisse le hub injecter sa logique d'embed.
 */
declare function CenterPanel({ children, renderProduct }: CenterPanelProps): react_jsx_runtime.JSX.Element;

declare function RailRight(): react_jsx_runtime.JSX.Element;

/**
 * ThemeAccent — recolore tout le chrome Cockpit (chat, bottom bar, anneaux,
 * glow ambiant) à l'accent du produit actif. Pilote l'unique token
 * `--ct-accent` sur `:root` ; les autres accents en dérivent via `color-mix`.
 * `useLayoutEffect` (vs `useEffect`) pour appliquer la couleur avant peinture,
 * évitant le flash de la couleur précédente. Pas de rendu ; effet DOM only.
 */
declare function ThemeAccent(): null;

/**
 * HearstMark — logo officiel Hearst (le « H »).
 * Source : ~/.claude/assets/hearst/hcyan.svg (référence de marque).
 * Mono-path → hérite de `currentColor`, donc teinté à l'accent du produit.
 */
declare function HearstMark({ size }: {
    size?: number;
}): react_jsx_runtime.JSX.Element;

interface CockpitContextValue {
    products: CockpitProduct[];
    appId: string;
    chatConfig: ChatConfig;
    /** Helper : produit par id, fallback sur l'appId si inconnu, sinon premier produit. */
    getProduct: (id: string) => CockpitProduct;
}
declare function useCockpit(): CockpitContextValue;

/**
 * hubBridge.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Relaie les appels IPC d'une `<webview>` produit vers le main process via
 * `window.electron.hubInvoke` (exposé par le preload côté hub Electron).
 *
 * Contrat IPC :
 *   webview → host : événement DOM "ipc-message", e.channel === "hearsthub:req",
 *                    e.args[0] = { reqId, channel, args }
 *   host → webview : webviewEl.send("hearsthub:res", { reqId, ok, result, error })
 *                    webviewEl.send("hearsthub:ctx", { productId, env, accent, theme })
 *   host → main    : window.electron.hubInvoke(channel, { productId, args }) → Promise
 *
 * Export depuis `@hearst/cockpit-shell` pour que le hub agrégateur l'utilise
 * dans son `ProductFrame`. Les apps produit standalone n'en ont pas besoin.
 */
declare global {
    interface Window {
        electron?: {
            getLastEnv?: () => Promise<string>;
            selectEnv?: (env: "local" | "prod") => Promise<void>;
            platform?: string;
            hubInvoke?: (channel: string, payload: {
                productId: string;
                args: unknown;
            }) => Promise<unknown>;
        };
    }
}
interface IpcMessageEvent extends Event {
    channel: string;
    args: unknown[];
}
interface HubContext {
    productId: string;
    env: string;
    accent: string;
    theme: string;
}
interface WebviewElement {
    send(channel: string, ...args: unknown[]): void;
    addEventListener(type: string, handler: (e: IpcMessageEvent) => void): void;
    removeEventListener(type: string, handler: (e: IpcMessageEvent) => void): void;
}
declare function attachHubBridge(webviewEl: WebviewElement, getProductId: () => string): () => void;
declare function pushContext(webviewEl: WebviewElement, ctx: HubContext): void;

interface ChatKimiProps {
    /** Nom du produit en cours, pour le placeholder/contexte. */
    productName?: string;
    /** Accent du produit, pour la pastille + bouton envoyer. */
    productColor?: string;
}
declare function ChatKimi({ productName, productColor }?: ChatKimiProps): react_jsx_runtime.JSX.Element;

interface ChatSettingsProps {
    productName?: string;
    productColor?: string;
}
declare function ChatSettings({ productName, productColor }?: ChatSettingsProps): react_jsx_runtime.JSX.Element;

interface ChatHistoryProps {
    productColor?: string;
}
declare function ChatHistory({ productColor }?: ChatHistoryProps): react_jsx_runtime.JSX.Element;

/** Message affiché dans la liste (identique à ChatMessage). */
type DisplayMessage = ChatMessage;
interface UseChatOptions {
    /** Endpoint API. Défaut : "/api/cockpit-chat" */
    apiEndpoint?: string;
    /** chatId existant à charger au mount. */
    chatId?: string | null;
    /** Callback appelé quand un nouveau chatId est attribué. */
    onChatId?: (id: string) => void;
    /** Persistance Supabase / autre. */
    persistence?: ChatPersistence;
    /** productId courant à envoyer avec chaque requête. */
    productId?: string | null;
}
interface UseChatReturn {
    messages: DisplayMessage[];
    streaming: boolean;
    error: string | null;
    sendMessage: (text: string) => void;
    reset: () => void;
}
declare function useChat(opts?: UseChatOptions): UseChatReturn;

declare function Eyebrow({ children }: {
    children: ReactNode;
}): react_jsx_runtime.JSX.Element;
declare function Title({ children }: {
    children: ReactNode;
}): react_jsx_runtime.JSX.Element;
declare function Sub({ children }: {
    children: ReactNode;
}): react_jsx_runtime.JSX.Element;
declare function KpiGrid({ children }: {
    children: ReactNode;
}): react_jsx_runtime.JSX.Element;
declare function KpiCard({ label, value, accent, }: {
    label: string;
    value: ReactNode;
    accent?: boolean;
}): react_jsx_runtime.JSX.Element;
declare function Card({ title, children, }: {
    title: string;
    children: ReactNode;
}): react_jsx_runtime.JSX.Element;

/**
 * activeProductStore.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Store externe `useSyncExternalStore` pour le produit actuellement affiché.
 * SSR-safe : `getServerSnapshot` retourne le défaut configuré (cf. `setDefault`).
 *
 * Le store est générique (ne connaît pas la liste des produits du hub) : c'est
 * l'app consommatrice qui définit le défaut au boot via `setDefault("hub")`.
 */
type Listener$2 = () => void;
declare function setDefaultActive(id: string): void;
declare function getSnapshot(): string;
declare function subscribe$2(cb: Listener$2): () => void;
declare function setActive(id: string): void;

/**
 * railOpenStore.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Store externe `useSyncExternalStore` pour l'état ouvert/replié du RailRight.
 * SSR-safe : `getServerSnapshot` retourne `true` (défaut ouvert), zéro mismatch.
 */
type Listener$1 = () => void;
declare function subscribe$1(cb: Listener$1): () => void;
declare function forceOpen(): void;

/**
 * launcherStore.ts
 * ─────────────────────────────────────────────────────────────────────────
 * État ouvert/replié du lanceur du rail gauche (accordéon).
 * Pattern SSR-safe identique à `railOpenStore` : snapshot serveur = ouvert.
 */
type Listener = () => void;
declare function subscribe(cb: Listener): () => void;

export { Card, CenterPanel, type CenterPanelProps, type ChatConfig, ChatHistory, ChatKimi, type ChatMessage, type ChatPersistence, ChatSettings, type CockpitProduct, CockpitShell, type CockpitShellProps, type DisplayMessage, Eyebrow, HearstMark, type HubContext, KpiCard, KpiGrid, RailLeft, RailRight, Sub, ThemeAccent, Title, type UseChatOptions, type UseChatReturn, attachHubBridge, forceOpen as forceOpenRailRight, getSnapshot as getActiveProduct, pushContext, setActive as setActiveProduct, setDefaultActive, subscribe$2 as subscribeActiveProduct, subscribe as subscribeLauncher, subscribe$1 as subscribeRailRight, useChat, useCockpit };
