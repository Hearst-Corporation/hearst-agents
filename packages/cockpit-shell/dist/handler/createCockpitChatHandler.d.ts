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
 * createCockpitChatHandler.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Factory : retourne `{ POST }` à exporter depuis une route Next.js
 * (`app/api/cockpit-chat/route.ts`). Chaque app la consomme avec son propre
 * client LLM (OpenAI / Hypercli compatible) + son systemPrompt + sa
 * persistance optionnelle.
 *
 * Inclus :
 *   - validation Zod du body
 *   - rate-limit in-memory (clé IP, fallback si pas d'Upstash configuré
 *     par l'app — celle-ci peut wrapper le handler si elle veut du distribué)
 *   - filtrage stream-safe des blocs `<think>...</think>`
 *   - header `x-chat-id` renvoyé au client
 */

interface LLMStreamChunk {
    choices?: Array<{
        delta?: {
            content?: string | null;
        };
    }>;
}
interface LLMClient {
    chat: {
        completions: {
            create(params: {
                model: string;
                stream: true;
                messages: Array<{
                    role: "user" | "assistant" | "system";
                    content: string;
                }>;
            }, options?: {
                signal?: AbortSignal;
            }): Promise<AsyncIterable<LLMStreamChunk>>;
        };
    };
}
interface CockpitChatHandlerConfig {
    /** Client OpenAI-compatible (Hypercli Kimi 2.6 le plus souvent). */
    llmClient: LLMClient;
    /** Modèle LLM. */
    model: string;
    /**
     * System prompt par défaut (peut être surchargé par requête via `body.system`).
     * Accepte une string statique ou une fonction `(productId: string) => string`
     * pour adapter le prompt au produit actif.
     */
    systemPrompt?: string | ((productId: string) => string);
    /** Persistance optionnelle des messages (Supabase RLS le plus souvent). */
    persistence?: ChatPersistence;
    /** Rate-limit : nombre de requêtes par fenêtre. Défaut : 20. */
    rateLimitMax?: number;
    /** Rate-limit : taille de la fenêtre en ms. Défaut : 60_000. */
    rateLimitWindowMs?: number;
    /**
     * Identifiant utilisateur authentifié. Si fourni, utilisé comme clé du
     * rate-limit au lieu de l'IP (évite les faux positifs en NAT entreprise).
     */
    userId?: string;
}
/**
 * Filtre stream-safe des `<think>...</think>` (raisonnement Kimi privé).
 * Exporté pour les tests unitaires.
 */
declare function makeThinkStripper(): (chunk: string) => string;
declare function createCockpitChatHandler(config: CockpitChatHandlerConfig): {
    POST: (req: Request) => Promise<Response>;
};

export { type CockpitChatHandlerConfig, createCockpitChatHandler, makeThinkStripper };
