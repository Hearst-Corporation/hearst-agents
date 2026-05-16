/**
 * Video Prompt Enricher — Enrichissement automatique des prompts utilisateurs
 * pour la génération vidéo (Runway, principalement).
 *
 * Contrairement à `fal-prompt-enricher` (heuristique stylistique pour images
 * Flux), cet enricher utilise Kimi pour réécrire le prompt brut en
 * direction cinématographique : palette, mouvement caméra, lumière, ambiance,
 * focale, format. Runway répond beaucoup mieux à un prompt structuré
 * "shot description" qu'à une description plate.
 *
 * API minimaliste :
 *   - input  : `rawPrompt: string`
 *   - output : `{ enriched: string, diff: string[] }`
 *
 * Le `diff` est un tableau de fragments ajoutés par l'enrichisseur, surface
 * pour l'UI qui veut afficher un highlight type "delta" inline.
 *
 * Fallback : si l'API Kimi est indisponible (pas de clé, erreur réseau),
 * on retombe sur un enrichissement heuristique léger pour ne pas bloquer la
 * génération vidéo.
 */

import { KIMI_MODELS } from "@/lib/llm/models";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";

export interface VideoPromptEnrichment {
  /** Prompt enrichi prêt à envoyer à Runway. */
  enriched: string;
  /** Fragments ajoutés (suffixes cinématographiques, mouvements caméra…)
   *  utilisés par l'UI pour un highlight diff inline. */
  diff: string[];
}

const HAIKU_MODEL = KIMI_MODELS.HAIKU;

const SYSTEM_PROMPT = [
  "Tu es un directeur photo qui réécrit des prompts vidéo pour le modèle Runway Gen-3.",
  "Objectif : transformer une description utilisateur brute en prompt cinématographique structuré.",
  "",
  "RÈGLES :",
  "- Garde l'intention originale intacte (sujet, action, ambiance générale).",
  "- Ajoute en cascade : palette de couleurs, qualité de lumière, mouvement caméra, focale, ambiance.",
  "- Pas de gimmick, pas de listes : un paragraphe fluide, dense, en anglais (Runway répond mieux).",
  "- Maximum 80 mots.",
  "- Aucune mention de marque, de personnalité publique, ou d'élément générant un refus du modèle.",
  "",
  "FORMAT DE SORTIE :",
  '- Retourne UNIQUEMENT le prompt enrichi, sans préfixe ("Prompt:", "Voici…"), sans guillemets.',
].join("\n");

const HEURISTIC_SUFFIX =
  "cinematic lighting, anamorphic lens, smooth camera movement, shallow depth of field, golden hour, 35mm film grain";

/**
 * Enrichit un prompt vidéo brut. Tente Kimi, retombe sur heuristique.
 *
 * Provider-agnostique : le module ne dépend pas de Runway directement, on
 * pourra le réutiliser pour HeyGen / Veo si besoin (mêmes principes
 * cinématographiques s'appliquent).
 *
 * @param tenantId - Optionnel. Propagé au circuit breaker pour isolation per-tenant.
 */
export async function enrichVideoPrompt(
  rawPrompt: string,
  tenantId?: string,
): Promise<VideoPromptEnrichment> {
  const trimmed = rawPrompt.trim();
  if (!trimmed) {
    throw new Error("[video-prompt-enricher] rawPrompt is empty");
  }

  if (!process.env.KIMI_API_KEY) {
    return heuristicFallback(trimmed);
  }

  const fallback = heuristicFallback(trimmed);

  return chatWithCircuitBreaker<VideoPromptEnrichment>({
    tenantId,
    context: "video-prompt-enricher",
    chatRequest: {
      model: HAIKU_MODEL,
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Prompt brut : "${trimmed}"\n\nRéécris-le en direction cinématographique pour Runway.`,
        },
      ],
    },
    fallback,
    parse: (res) => {
      const enriched = res.content.trim();
      if (!enriched || enriched.length < trimmed.length / 2) {
        return fallback;
      }
      return {
        enriched,
        diff: computeDiff(trimmed, enriched),
      };
    },
  });
}

/**
 * Heuristique simple : append les suffixes cinématographiques manquants au
 * prompt brut. Utilisé en fallback (pas de clé API, erreur réseau, réponse
 * suspecte). Le résultat reste une amélioration utilisable côté Runway.
 */
function heuristicFallback(rawPrompt: string): VideoPromptEnrichment {
  const lower = rawPrompt.toLowerCase();
  const fragments = HEURISTIC_SUFFIX.split(",").map((f) => f.trim());
  const missing = fragments.filter((frag) => {
    const fragLower = frag.toLowerCase();
    // On considère un fragment comme déjà présent si un de ses mots-clés
    // (le premier token significatif) figure dans le prompt brut.
    const firstWord = fragLower.split(" ")[0];
    return firstWord.length > 0 && !lower.includes(firstWord);
  });

  if (missing.length === 0) {
    return { enriched: rawPrompt, diff: [] };
  }

  const suffix = missing.join(", ");
  return {
    enriched: `${rawPrompt}, ${suffix}`,
    diff: missing,
  };
}

/**
 * Calcule un diff approximatif : les fragments (séparés par virgules) qui
 * apparaissent dans `enriched` mais pas dans `original`. Permet à l'UI de
 * surligner les ajouts.
 *
 * Volontairement naïf : on ne fait pas de tokenisation NLP, juste un split
 * par virgules + dédup contre l'original. Suffisant pour un highlight inline.
 */
function computeDiff(original: string, enriched: string): string[] {
  const originalLower = original.toLowerCase();
  const fragments = enriched
    .split(/[,.;]/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  return fragments.filter((frag) => {
    const fragLower = frag.toLowerCase();
    if (fragLower.length < 4) return false;
    return !originalLower.includes(fragLower);
  });
}
