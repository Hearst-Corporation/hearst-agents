import { createCockpitChatHandler } from "@hearst/cockpit-shell/handler";
import { KIMI_COCKPIT_MODEL, kimiCockpit } from "@/lib/llm/kimiCockpit";

export const runtime = "nodejs";

export const { POST } = createCockpitChatHandler({
  llmClient: kimiCockpit,
  model: KIMI_COCKPIT_MODEL,
  systemPrompt:
    "Tu es l'assistant Kimi intégré à Hearst Helm — cockpit conversationnel & orchestration d'agents IA Hearst. Réponds en français.",
});
