import { composeEditorialPrompt } from "@/lib/editorial/charter";
import { defaultCircuitBreaker } from "@/lib/llm/circuit-breaker";
import { getProvider } from "@/lib/llm/router";
import { ACTION_ITEMS_FEWSHOT, formatFewShotBlock } from "@/lib/prompts/examples";

/**
 * Prompt extraction d'action items — analyste de réunion.
 *
 * Transforme un transcript de meeting en plan d'actions JSON exécutable.
 * Détecte le owner via les speakers tagués, extrait la deadline si nommée.
 */
export const ACTION_ITEMS_SYSTEM_PROMPT = composeEditorialPrompt(
  [
    "Tu es l'analyste qui transforme un meeting transcript en plan d'actions exécutable.",
    "",
    "FORMAT STRICT — JSON ARRAY uniquement, sans texte autour, sans markdown fence :",
    '[{ "action": string, "owner": string|null, "deadline": string|null }]',
    "",
    "RÈGLES D'EXTRACTION :",
    "- Une action = un engagement concret (« je m'en occupe », « tu valides », « on prépare pour… »).",
    "- Le owner est extrait du speaker assigné, ou explicitement nommé dans la phrase d'engagement.",
    "- La deadline est extraite littéralement (« mercredi », « avant vendredi », « fin du mois »). Pas de date inventée.",
    "- Si plusieurs speakers et l'owner n'est pas clair, owner = null.",
    "- Une discussion vague (« on devrait regarder… », « il faudrait peut-être… ») n'est PAS une action.",
    "- Si rien d'actionnable, retourne un array vide [].",
    "",
    "EXEMPLES :",
    formatFewShotBlock(ACTION_ITEMS_FEWSHOT),
  ].join("\n"),
);

export async function extractActionItems(
  transcript: string,
  tenantId?: string,
): Promise<
  Array<{
    action: string;
    owner?: string;
    deadline?: string;
  }>
> {
  if (!transcript.trim()) return [];

  if (!process.env.KIMI_API_KEY) return [];

  if (defaultCircuitBreaker.isOpen("kimi", tenantId)) return [];

  try {
    const provider = getProvider("kimi");
    const res = await provider.chat({
      model: "kimi-k2.5",
      max_tokens: 1024,
      messages: [
        { role: "system", content: ACTION_ITEMS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Transcript à analyser :\n\n${transcript}\n\nExtrais les action items maintenant, au format JSON strict.`,
        },
      ],
    });
    defaultCircuitBreaker.recordSuccess("kimi", tenantId);

    const text = res.content.trim();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      action: string;
      owner?: string | null;
      deadline?: string | null;
    }>;

    return parsed.map((item) => ({
      action: item.action,
      ...(item.owner ? { owner: item.owner } : {}),
      ...(item.deadline ? { deadline: item.deadline } : {}),
    }));
  } catch (err) {
    defaultCircuitBreaker.recordFailure(
      "kimi",
      err instanceof Error ? err : new Error(String(err)),
      tenantId,
    );
    return [];
  }
}
