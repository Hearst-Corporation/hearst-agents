import { createCockpitChatHandler } from "@hearst/cockpit-shell/handler";
import { createCockpitChatPersistence } from "@/lib/llm/cockpitChatPersistence";
import { KIMI_COCKPIT_MODEL, kimiCockpit } from "@/lib/llm/kimiCockpit";
import { getUserId } from "@/lib/platform/auth/get-user-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // Résolution userId NextAuth — null = non authentifié (le chat reste
  // fonctionnel mais sans persistance, mode in-memory).
  const userId = await getUserId();
  const persistence = userId ? createCockpitChatPersistence(userId) : null;

  const handler = createCockpitChatHandler({
    llmClient: kimiCockpit,
    model: KIMI_COCKPIT_MODEL,
    systemPrompt:
      "Tu es l'assistant Kimi intégré à Hearst Helm — cockpit conversationnel & orchestration d'agents IA Hearst. Réponds en français.",
    // persistence null → handler tombe en mode in-memory (aucun crash).
    ...(persistence ? { persistence } : {}),
  });

  // createCockpitChatHandler retourne { POST } qui attend un NextRequest.
  // On lui passe la req directement (compatible Next.js App Router).
  return handler.POST(req as Parameters<typeof handler.POST>[0]);
}
