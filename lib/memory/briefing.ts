import { composeEditorialPrompt } from "@/lib/editorial/charter";
import { KIMI_MODELS } from "@/lib/llm/models";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import { BRIEFING_FEWSHOT_FR, formatFewShotBlock } from "@/lib/prompts/examples";
import { getSummary } from "./conversation-summary";

const GENERIC_BRIEFING = {
  text: "Aucune activité récente enregistrée.",
  audioScript: "Aucune activité récente enregistrée.",
};

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s/gm, "")
    .replace(/^\s*\d+\.\s/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Prompt briefing matinal — niveau "chef de cabinet".
 *
 * Le ton, le vocabulaire et les bannis sont chargés via `composeEditorialPrompt`
 * (charte unifiée). Ne sont définis ici que les contraintes spécifiques au
 * briefing : format 3 sections, cap 180 mots, italic citations OK, few-shot.
 */
export const BRIEFING_SYSTEM_PROMPT = composeEditorialPrompt(
  [
    "Tu es l'analyste exécutif de l'utilisateur — l'équivalent d'un chef de cabinet pour un fondateur.",
    "Tu lis sa mémoire d'activité récente et tu produis un briefing matinal qui concentre l'attention.",
    "",
    "FORMAT STRICT (3 sections, dans cet ordre, en markdown) :",
    "1. **Cette nuit.** Une ligne factuelle qui résume le dernier signal des 24h écoulées.",
    "2. **À surveiller.** 2-3 bullets qui nomment ce qui demande de l'attention aujourd'hui.",
    "3. **Action.** Une recommandation actionnable, formulée à l'impératif.",
    "",
    "CONTRAINTES SPÉCIFIQUES :",
    "- Max 180 mots au total.",
    "- Italic (`*…*`) autorisé pour citations brèves (renforce le côté éditorial).",
    "",
    "EXEMPLES :",
    formatFewShotBlock(BRIEFING_FEWSHOT_FR),
  ].join("\n"),
);

export async function generateBriefing(params: {
  userId: string;
  tenantId?: string;
  date?: Date;
}): Promise<{ text: string; audioScript: string }> {
  const date = params.date ?? new Date();
  const summary = await getSummary(params.userId);

  if (!summary) return GENERIC_BRIEFING;

  const { tenantId } = params;

  return chatWithCircuitBreaker<{ text: string; audioScript: string }>({
    tenantId,
    context: "memory/briefing",
    chatRequest: {
      model: KIMI_MODELS.HAIKU,
      max_tokens: 500,
      messages: [
        { role: "system", content: BRIEFING_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Date : ${formatDate(date)}.`,
            "",
            "Mémoire d'activité récente :",
            summary,
            "",
            "Génère le briefing maintenant, en respectant strictement le format 3 sections.",
          ].join("\n"),
        },
      ],
    },
    fallback: GENERIC_BRIEFING,
    parse: (res) => {
      const text = res.content ?? "";
      if (!text) return GENERIC_BRIEFING;
      return {
        text,
        audioScript: stripMarkdown(text),
      };
    },
  });
}
