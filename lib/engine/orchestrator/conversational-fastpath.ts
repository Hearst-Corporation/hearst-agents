/**
 * Conversational fast-path — réponse < 1s pour le smalltalk pur.
 *
 * POURQUOI : le pipeline complet (ai-pipeline.ts) paie pour CHAQUE message le
 * pré-fetch mémoire/KG/LTM + la discovery Composio + un system prompt de ~4500
 * tokens, même pour un simple "bonjour" → 1.5-3s. Or un message conversationnel
 * (salutation, remerciement, "qui es-tu") n'a besoin NI de contexte NI de tools.
 *
 * CE PATH : zéro pré-fetch, prompt court (~300 tok), 1 seul appel LLM
 * léger streamé directement. Mesuré : ~0.5-0.7s selon provider.
 *
 * GARDE-FOU : `isPureConversational` est CONSERVATEUR — au moindre signal de
 * données/action/mémoire/recherche, il retourne false et on retombe sur le
 * pipeline complet. Jamais de réponse "à plat" à une vraie question.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { RunEngine } from "@/lib/engine/runtime/engine";
import type { RunEventBus } from "@/lib/events/bus";
import { buildLlmCandidates } from "./llm-candidates";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export interface FastpathModelConfig {
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
}

/**
 * Sélectionne le modèle du fast-path sans toucher au moteur agentique.
 *
 * Le fast-path ne traite QUE du conversationnel pur (isPureConversational),
 * donc la classe de modèle est TOUJOURS "fast" — il consomme la MÊME source de
 * vérité que le pipeline (`buildLlmCandidates`) pour rester cohérent avec le
 * routing tier→modèle. Sans ça, un "bonjour" partait en gpt-4.1-mini hardcodé
 * alors que le routing visait ORCHESTRATOR_MODEL_FAST → incohérence silencieuse.
 *
 * Priorité :
 * 1. Env dédiée `CONVERSATIONAL_FASTPATH_*` pour bench Kimi/MiniMax isolé.
 * 2. Le candidat "fast" du routing unifié (OpenAI primaire → ORCHESTRATOR_MODEL_FAST,
 *    Kimi primaire → son modèle). Provider/model/clé/baseURL alignés sur le pipeline.
 */
export function resolveConversationalFastpathConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): FastpathModelConfig {
  const explicitBaseUrl = env.CONVERSATIONAL_FASTPATH_BASE_URL;
  const explicitApiKey = env.CONVERSATIONAL_FASTPATH_API_KEY;
  const explicitModel = env.CONVERSATIONAL_FASTPATH_MODEL;

  if (explicitApiKey || explicitBaseUrl || explicitModel) {
    const baseURL = explicitBaseUrl ?? env.KIMI_BASE_URL ?? env.OPENAI_BASE_URL ?? OPENAI_BASE_URL;
    const isOpenAI = baseURL === OPENAI_BASE_URL;
    return {
      provider: isOpenAI ? "openai" : "kimi",
      apiKey: explicitApiKey ?? env.KIMI_API_KEY ?? env.OPENAI_API_KEY ?? "",
      baseURL,
      model: explicitModel ?? (isOpenAI ? "gpt-4.1-mini" : "kimi-k2.5"),
    };
  }

  // Conversationnel = classe "fast" → même candidat que le pipeline pour le tier
  // direct/memory. buildLlmCandidates garantit ≥1 candidat (fallback statique).
  const candidate = buildLlmCandidates(env, { modelClass: "fast" })[0];
  return {
    provider: candidate.providerKey,
    apiKey: candidate.apiKey,
    baseURL: candidate.baseURL ?? OPENAI_BASE_URL,
    model: candidate.modelId,
  };
}

// Prompt MINIMAL : identité + langue + ton. Pas de catalogue de tools, pas de
// règles d'orchestration — ce path ne fait jamais d'action.
const FASTPATH_SYSTEM_PROMPT =
  "Tu es Hearst, l'assistant exécutif de l'utilisateur. " +
  "Réponds en français (sauf si l'utilisateur écrit en anglais), en 1-2 phrases courtes, " +
  "ton direct et chaleureux, sans emojis. Tu es là pour aider à orchestrer son travail. " +
  "Ne prétends jamais avoir accès à des données ou outils dans cette réponse — c'est une " +
  "simple réponse conversationnelle. Si l'utilisateur enchaîne sur une vraie demande " +
  "(chercher, agir, mémoriser), tu la traiteras au tour suivant.";

// ── Détection conservatrice ─────────────────────────────────────────────────
// On exige que le message soit COURT et matche un pattern conversationnel franc,
// ET qu'il ne contienne AUCUN signal d'intent réel.
const CONVERSATIONAL_PATTERNS = [
  /^(bonjour|salut|hello|hi|hey|coucou|yo|bonsoir|re)\b/i,
  /^(merci|thanks|thank you|nickel|parfait|super|cool|génial|top|ok|d'accord|ça marche)\b/i,
  /^(qui\s+es-tu|qui\s+êtes-vous|tu\s+es\s+qui|c'est\s+quoi\s+hearst|présente-toi|que\s+sais-tu\s+faire|que\s+peux-tu\s+faire|à\s+quoi\s+tu\s+sers)\b/i,
  /^(comment\s+(ça\s+)?vas?[\s-]?tu|comment\s+allez[\s-]?vous|ça\s+va|tu\s+vas\s+bien|comment\s+ça\s+va)\b/i,
  /^(au\s+revoir|bye|à\s+plus|à\s+bientôt|bonne\s+journée|bonne\s+soirée)\b/i,
  /^(oui|non|yes|no|peut-être|je\s+sais\s+pas|aucune\s+idée)\s*[.!?]*$/i,
];

// Signaux d'intent RÉEL → JAMAIS fast-path (sécurité anti-faux-positif).
const REAL_INTENT_SIGNALS =
  /\b(cherche|recherche|trouve|retrouve|mémorise|rappelle|note|enregistre|montre|affiche|liste|envoie|crée|génère|supprime|analyse|compare|décidé|décision|mes?\s+(notes?|emails?|fichiers?|repos?|déploiements?)|vault|cortex|github|vercel|sentry|slack|gmail|calendar|drive)\b/i;

/**
 * Vrai uniquement si le message est du smalltalk SANS aucun signal d'action.
 * Conservateur par construction : court + pattern franc + zéro signal d'intent.
 */
export function isPureConversational(message: string): boolean {
  const m = message.trim();
  // Borne de longueur : un vrai smalltalk est court. Au-delà, on ne risque pas.
  if (m.length === 0 || m.length > 60) return false;
  // Mot d'intent réel présent → pipeline complet, point.
  if (REAL_INTENT_SIGNALS.test(m)) return false;
  // Doit matcher un pattern conversationnel franc (ancré en début).
  return CONVERSATIONAL_PATTERNS.some((p) => p.test(m));
}

/**
 * Stream une réponse conversationnelle minimale via le modèle "fast" du routing
 * (ORCHESTRATOR_MODEL_FAST quand OpenAI primaire).
 * Émet directement les text_delta sur l'eventBus, puis complète le run.
 * Aucun pré-fetch, aucun tool, aucun gros prompt.
 */
export async function runConversationalFastpath(
  message: string,
  engine: RunEngine,
  eventBus: RunEventBus,
  opts: { history?: Array<{ role: "user" | "assistant"; content: string }>; signal?: AbortSignal },
): Promise<void> {
  const fastpathConfig = resolveConversationalFastpathConfig();
  // Trace explicite du modèle réellement emprunté par le fast-path — sans ça, on
  // ne peut pas vérifier dans les logs que le routing tier→modèle s'applique
  // (le fast-path court-circuite le pipeline qui, lui, logge déjà son candidat).
  console.info("[conversational-fastpath] model_selected", {
    run_id: engine.id,
    provider: fastpathConfig.provider,
    model: fastpathConfig.model,
  });
  const client = createOpenAI({
    apiKey: fastpathConfig.apiKey,
    baseURL: fastpathConfig.baseURL,
  });

  // Historique court (4 derniers tours max) pour la continuité conversationnelle.
  const recentHistory = (opts.history ?? []).slice(-4);

  const result = streamText({
    model: client.chat(fastpathConfig.model),
    system: FASTPATH_SYSTEM_PROMPT,
    messages: [...recentHistory, { role: "user" as const, content: message }],
    temperature: 0.5,
    maxOutputTokens: 200,
    maxRetries: 2,
    abortSignal: opts.signal,
  });

  let any = false;
  for await (const delta of result.textStream) {
    if (delta) {
      any = true;
      eventBus.emit({ type: "text_delta", run_id: engine.id, delta });
    }
  }

  // Garde-fou anti-blanc : si le LLM n'a rien produit (cas rare), on ne laisse
  // pas un run vide — message honnête, pas de faux contenu.
  if (!any) {
    eventBus.emit({
      type: "text_delta",
      run_id: engine.id,
      delta: "Je t'écoute — dis-moi ce que tu veux faire.",
    });
  }

  await engine.complete();
}
