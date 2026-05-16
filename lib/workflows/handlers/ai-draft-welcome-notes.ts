/**
 * Handler `ai_draft_welcome_notes` — génère via Kimi une note de
 * bienvenue personnalisée par guest VIP.
 *
 * Args attendus :
 *  - arrivals: Array<{ guestName, room, specialRequest? }>
 *  - tone?: "warm-professional" | "casual" | "formal"
 *  - includeRoomNumber?: boolean
 *
 * Sortie :
 *  { notes: Array<{ guestName, room, note }> }
 *
 * Sans `KIMI_API_KEY`, on retourne `success: true` avec une note
 * fallback minimaliste — le workflow continue mais l'asset final sera
 * clairement marqué `degraded: true`.
 */

import { composeEditorialPrompt } from "@/lib/editorial/charter";
import { KIMI_MODELS } from "@/lib/llm/models";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import type { WorkflowHandler } from "./types";

interface ArrivalLite {
  guestName: string;
  room?: string;
  specialRequest?: string | null;
  vip?: boolean;
}

/**
 * Voix dérivée "Hospitality" : la charte Hearst s'applique (zéro emoji,
 * vocab sobre, pas de superlatifs creux), avec une dérogation explicite
 * sur le tutoiement → vouvoiement requis pour le contexte concierge VIP.
 */
const SYSTEM_PROMPT = composeEditorialPrompt(
  [
    "Tu es un concierge premium qui rédige des welcome notes courtes et personnalisées pour des guests VIP.",
    "",
    "FORMAT STRICT — JSON ARRAY uniquement, sans markdown fence, sans préambule :",
    '[{ "guestName": string, "room": string, "note": string }]',
    "",
    "RÈGLES SPÉCIFIQUES :",
    "- Chaque note ≤ 80 mots (cap dur).",
    "- Ton chaleureux, jamais obséquieux. Pas de superlatifs creux.",
    "- Si specialRequest est présent, le mentionner discrètement (« nous avons préparé… »).",
    "- DÉROGATION CHARTE : vouvoiement obligatoire ici (contexte hospitality VIP). Le tutoiement par défaut de Hearst ne s'applique pas.",
    "- Pas de phrase générique copiée-collée d'un guest à l'autre.",
  ].join("\n"),
);

function fallbackNote(a: ArrivalLite): string {
  return `Bienvenue ${a.guestName}. Votre chambre ${a.room ?? ""} est prête. La conciergerie reste à votre disposition.`.trim();
}

export const aiDraftWelcomeNotes: WorkflowHandler = async (args, ctx) => {
  const arrivalsRaw = Array.isArray(args.arrivals) ? args.arrivals : [];
  const arrivals: ArrivalLite[] = arrivalsRaw
    .map((a) => (typeof a === "object" && a ? (a as ArrivalLite) : null))
    .filter((a): a is ArrivalLite => a !== null && typeof a.guestName === "string");
  const tenantId = ctx.tenantId;

  if (arrivals.length === 0) {
    return { success: true, output: { notes: [], degraded: false } };
  }

  const tone = typeof args.tone === "string" ? args.tone : "warm-professional";
  const includeRoom = args.includeRoomNumber !== false;

  if (!process.env.KIMI_API_KEY) {
    const notes = arrivals.map((a) => ({
      guestName: a.guestName,
      room: a.room ?? "",
      note: fallbackNote(a),
    }));
    return { success: true, output: { notes, degraded: true, reason: "no_kimi_key" } };
  }

  const fallbackNotes = arrivals.map((a) => ({
    guestName: a.guestName,
    room: a.room ?? "",
    note: fallbackNote(a),
  }));

  const userPrompt = [
    `Tone : ${tone}.`,
    includeRoom ? "Inclus le numéro de chambre dans la note." : "Pas de numéro de chambre.",
    "",
    "Arrivals (JSON) :",
    JSON.stringify(arrivals, null, 2),
  ].join("\n");

  type WelcomeOutput =
    | { notes: Array<{ guestName: string; room: string; note: string }>; degraded: false }
    | {
        notes: Array<{ guestName: string; room: string; note: string }>;
        degraded: true;
        reason: string;
      };

  const fallback: WelcomeOutput = {
    notes: fallbackNotes,
    degraded: true,
    reason: "circuit_open_or_failed",
  };

  const output = await chatWithCircuitBreaker<WelcomeOutput>({
    tenantId,
    context: "workflows/ai-draft-welcome-notes",
    chatRequest: {
      model: KIMI_MODELS.HAIKU,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    },
    fallback,
    parse: (res) => {
      const text = res.content.trim();
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) {
        return { notes: fallbackNotes, degraded: true, reason: "no_json_in_response" };
      }
      try {
        const parsed = JSON.parse(m[0]) as Array<{
          guestName: string;
          room?: string;
          note: string;
        }>;
        const notes = parsed.map((n) => ({
          guestName: String(n.guestName ?? ""),
          room: String(n.room ?? ""),
          note: String(n.note ?? ""),
        }));
        return { notes, degraded: false };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return { notes: fallbackNotes, degraded: true, reason };
      }
    },
  });

  return { success: true, output };
};
