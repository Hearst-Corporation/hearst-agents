/**
 * cockpitChatPersistence.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Implémentation de `ChatPersistence` (@hearst/cockpit-shell) pour Supabase :
 * persiste les conversations ChatKimi dans cockpit_chats + cockpit_messages.
 *
 * Utilise un client Supabase sans générique Database car les tables cockpit
 * ne sont pas encore dans lib/database.types.ts (elles le seront après
 * `supabase gen types typescript --local` une fois la migration 0090 appliquée).
 *
 * Le service_role contourne le RLS côté API — les politiques RLS protègent
 * l'accès éventuel depuis le browser.
 *
 * userId est résolu côté route handler via getUserId() (NextAuth) et injecté
 * à la construction.
 */

import type { ChatMessage, ChatPersistence } from "@hearst/cockpit-shell";
import { createClient } from "@supabase/supabase-js";

// ── Client Supabase non typé pour les tables cockpit (pre-regen types) ──────

function getCockpitSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // Client non-générique : contourne la vérification stricte des noms de tables
  // avant la régénération de database.types.ts.
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Types inline cockpit (temporaires jusqu'à regen des types) ───────────────

interface CockpitChatInsert {
  user_id: string;
}

interface CockpitMessageInsert {
  id: string;
  chat_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface CockpitMessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface CockpitChatIdRow {
  id: string;
}

/**
 * Crée une instance de `ChatPersistence` liée à un `userId` (UUID NextAuth/public.users).
 * Retourne `null` si Supabase n'est pas configuré (env manquant) — le handler
 * tombe alors en mode in-memory sans erreur.
 */
export function createCockpitChatPersistence(userId: string): ChatPersistence | null {
  const sb = getCockpitSupabase();
  if (!sb) return null;

  return {
    /**
     * Crée une nouvelle conversation et retourne son UUID.
     */
    async createChat(): Promise<string> {
      const insert: CockpitChatInsert = { user_id: userId };
      const { data, error } = await sb.from("cockpit_chats").insert(insert).select("id").single();

      if (error || !data) {
        throw new Error(`[CockpitPersistence] createChat failed: ${error?.message ?? "no data"}`);
      }

      return (data as CockpitChatIdRow).id;
    },

    /**
     * Charge l'historique d'une conversation (ordre chronologique).
     */
    async loadMessages(chatId: string): Promise<ChatMessage[]> {
      const { data, error } = await sb
        .from("cockpit_messages")
        .select("id, role, content, created_at")
        .eq("chat_id", chatId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(`[CockpitPersistence] loadMessages failed: ${error.message}`);
      }

      return ((data ?? []) as CockpitMessageRow[]).map((row) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        content: row.content,
        createdAt: new Date(row.created_at).getTime(),
      }));
    },

    /**
     * Persiste un message (user ou assistant) dans la conversation.
     * Met à jour updated_at du chat parent (best-effort).
     */
    async saveMessage(chatId: string, msg: ChatMessage): Promise<void> {
      const insert: CockpitMessageInsert = {
        id: msg.id,
        chat_id: chatId,
        user_id: userId,
        role: msg.role,
        content: msg.content,
      };

      const { error: msgError } = await sb.from("cockpit_messages").insert(insert);

      if (msgError) {
        throw new Error(`[CockpitPersistence] saveMessage failed: ${msgError.message}`);
      }

      // Mise à jour best-effort de updated_at sur le chat parent.
      await sb
        .from("cockpit_chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId)
        .eq("user_id", userId);
    },
  };
}
