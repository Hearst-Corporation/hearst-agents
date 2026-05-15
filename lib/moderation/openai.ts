/**
 * Content moderation via OpenAI Moderation API.
 *
 * Endpoint : `POST /v1/moderations` (modèle `omni-moderation-latest`).
 * Gratuit, sans rate limit strict (cf. https://platform.openai.com/docs/guides/moderation).
 *
 * Utilisé en pré-enqueue par les tools génératifs (image-gen, audio-gen,
 * video-gen) pour refuser des prompts qui violent les guidelines fournisseurs
 * (NSFW, violence, hate, self-harm) avant d'engager un coût provider et de
 * stocker un asset traçable côté tenant (cf. audit P0-5).
 *
 * Fail-soft par défaut : si `OPENAI_API_KEY` est absente ou si l'API est down,
 * on RETOURNE { flagged: false } pour ne pas bloquer un système qui marchait
 * sans modération. L'erreur est logguée, mais la production passe.
 *
 * ⚠️ Pour les environnements à haute sensibilité, configurer
 * `MODERATION_HARD_FAIL=true` — dans ce mode, toute indisponibilité de la
 * modération bloque le contenu au lieu de le laisser passer.
 */

const MODERATION_ENDPOINT = "https://api.openai.com/v1/moderations";
const MODERATION_MODEL = "omni-moderation-latest";
const MODERATION_TIMEOUT_MS = 5000;
const HARD_FAIL = process.env.MODERATION_HARD_FAIL === "true";

export interface ModerationResult {
  flagged: boolean;
  /** Catégories ayant déclenché un flag (ex: ["sexual", "violence"]). */
  categories: string[];
  /** Score max parmi les catégories flaggées (0-1). null si non-flagged. */
  maxScore: number | null;
  /** Source — utile pour debug et observabilité. */
  source: "openai" | "skipped" | "error";
  /** Message d'erreur si source = "error" ou "skipped". */
  reason?: string;
}

const OK_RESULT: ModerationResult = {
  flagged: false,
  categories: [],
  maxScore: null,
  source: "skipped",
};

interface OpenAIModerationResponse {
  id: string;
  model: string;
  results: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }>;
}

/**
 * Modère un texte (prompt utilisateur, script TTS, etc.) via OpenAI.
 * Retourne { flagged: false, source: "skipped" } si la clé est absente —
 * permet aux environnements de test/dev de tourner sans config.
 */
export async function moderateContent(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (HARD_FAIL) {
      return {
        flagged: true,
        categories: ["moderation_unavailable"],
        maxScore: 1,
        source: "error",
        reason: "no_api_key",
      };
    }
    return { ...OK_RESULT, reason: "no_api_key" };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ...OK_RESULT, reason: "empty_input" };
  }

  try {
    const res = await fetch(MODERATION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input: trimmed }),
      signal: AbortSignal.timeout(MODERATION_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(
        `[moderation] OpenAI HTTP ${res.status} — ${HARD_FAIL ? "HARD FAIL" : "fail-soft, content allowed"}`,
      );
      if (HARD_FAIL) {
        return {
          flagged: true,
          categories: ["moderation_unavailable"],
          maxScore: 1,
          source: "error",
          reason: `http_${res.status}`,
        };
      }
      return { ...OK_RESULT, source: "error", reason: `http_${res.status}` };
    }

    const data = (await res.json()) as OpenAIModerationResponse;
    const result = data.results[0];
    if (!result) {
      return { ...OK_RESULT, source: "error", reason: "no_result" };
    }

    if (!result.flagged) {
      return { flagged: false, categories: [], maxScore: null, source: "openai" };
    }

    const flaggedCategories = Object.entries(result.categories)
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    const scores = flaggedCategories.map((cat) => result.category_scores[cat] ?? 0);
    const maxScore = scores.length > 0 ? Math.max(...scores) : null;

    return {
      flagged: true,
      categories: flaggedCategories,
      maxScore,
      source: "openai",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[moderation] OpenAI call failed: ${msg} — ${HARD_FAIL ? "HARD FAIL" : "fail-soft, content allowed"}`,
    );
    if (HARD_FAIL) {
      return {
        flagged: true,
        categories: ["moderation_unavailable"],
        maxScore: 1,
        source: "error",
        reason: msg.slice(0, 100),
      };
    }
    return { ...OK_RESULT, source: "error", reason: msg.slice(0, 100) };
  }
}

/**
 * Helper pour les tools génératifs : retourne un message user-facing si le
 * contenu est flaggé, null sinon. Compose avec ensureCreditsOrMessage.
 */
export async function ensureContentAllowed(text: string): Promise<string | null> {
  const result = await moderateContent(text);
  if (result.flagged) {
    const cats = result.categories.join(", ");
    return `Contenu refusé : la modération a détecté ${cats}. Reformule sans ce contenu.`;
  }
  return null;
}
