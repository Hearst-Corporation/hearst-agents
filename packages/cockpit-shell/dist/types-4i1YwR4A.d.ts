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

export type { ChatConfig as C, ChatMessage as a, ChatPersistence as b };
