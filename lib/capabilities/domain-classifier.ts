/**
 * domain-classifier.ts — Routing cognitif (classification LLM légère du domaine).
 *
 * PROBLÈME : `resolveDomain` (taxonomy.ts) route par scoring de mots-clés. Rapide
 * (O(1), 0 IA) mais grossier : un message sans mot-clé fort tombe en "general"
 * (toolset large, pas de pré-filtre) et un message ambigu peut mal scorer.
 *
 * SOLUTION : on garde le chemin mots-clés pour les cas CLAIRS (le LLM coûte de la
 * latence sur le chemin critique). On n'appelle le classifieur LLM QUE pour les
 * cas ambigus (mots-clés non concluants → "general"), avec :
 *   - cache LRU process-local (même message normalisé → 0 appel)
 *   - fail-soft strict : LLM down/timeout/réponse invalide → fallback "general"
 *   - modèle rapide (Kimi K2.5) via le circuit-breaker existant
 *
 * Résultat : routing cognitif sur l'ambigu, sans pénaliser les 90% de cas clairs.
 */

import { KIMI_MODELS } from "@/lib/llm/models";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import { logger } from "@/lib/observability/logger";
import type { Domain } from "./taxonomy";

const DOMAINS: Domain[] = [
  "communication",
  "productivity",
  "finance",
  "research",
  "developer",
  "design",
  "crm",
  "media",
  "analysis",
  "documents",
  "general",
];

const DOMAIN_HINTS: Record<Domain, string> = {
  communication: "emails, messages, Slack, notifications, envoi/lecture de courriers",
  productivity: "calendrier, tâches, notes, Notion, organisation, agenda",
  finance: "paiements, Stripe, comptabilité, revenus, factures, métriques business",
  research: "recherche web, veille, comparaison de sources, état de l'art",
  developer: "code, GitHub, PR, issues, Jira, Linear, CI, debugging",
  design: "Figma, maquettes, UI, visuels, design system",
  crm: "contacts, leads, pipeline commercial, HubSpot, Salesforce",
  media: "images, vidéos, audio, génération de média",
  analysis: "analyse de données, synthèse, comparaison, raisonnement structuré",
  documents: "fichiers, Drive, documents longs, rapports, mémos",
  general: "conversation libre, question simple, salutation, aucun domaine clair",
};

// ── Cache LRU minimal (process-local, sans dépendance) ───────────────────────
const CACHE_MAX = 500;
const cache = new Map<string, Domain>();

function cacheGet(key: string): Domain | undefined {
  const v = cache.get(key);
  if (v !== undefined) {
    cache.delete(key); // refresh recency
    cache.set(key, v);
  }
  return v;
}
function cacheSet(key: string, val: Domain): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, val);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function normalize(message: string): string {
  return message.toLowerCase().trim().slice(0, 400);
}

const SYSTEM_PROMPT = `Tu es un classifieur de domaine. On te donne un message utilisateur et tu réponds PAR UN SEUL MOT : le domaine le plus pertinent parmi cette liste exacte :
${DOMAINS.map((d) => `- ${d} : ${DOMAIN_HINTS[d]}`).join("\n")}

Règles : réponds UNIQUEMENT le slug du domaine (ex: "developer"), rien d'autre, pas de phrase, pas de ponctuation. Si aucun domaine ne s'applique clairement, réponds "general".`;

/**
 * Classifie le domaine d'un message via un appel LLM léger. Fail-soft :
 * retourne `fallback` (par défaut "general") sur toute erreur/invalidité.
 * Met le résultat en cache. À n'appeler QUE sur les cas ambigus (cf. router).
 */
export async function classifyDomainLLM(
  message: string,
  opts: { tenantId: string; fallback?: Domain } = { tenantId: "" },
): Promise<Domain> {
  const fallback = opts.fallback ?? "general";
  const key = normalize(message);
  if (!key) return fallback;

  const cached = cacheGet(key);
  if (cached) return cached;

  const result = await chatWithCircuitBreaker<Domain>({
    tenantId: opts.tenantId,
    context: "domain-classifier",
    chatRequest: {
      // max_tokens large : Kimi insère un bloc <think>…</think> même pour une
      // classification triviale (mesuré). Avec un budget trop petit (8), le
      // thinking consomme tout et `content` revient VIDE → fallback systématique.
      // On laisse de la marge puis on strippe le <think> au parse.
      model: KIMI_MODELS.HAIKU, // rapide
      max_tokens: 512,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message.slice(0, 2000) },
      ],
    },
    fallback,
    parse: (res) => {
      let txt = res.content ?? "";
      // Strip le reasoning <think>…</think> (Kimi/Hypercli) avant d'extraire le slug.
      txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, "");
      const raw = txt.toLowerCase().replace(/[^a-z]/g, "");
      // match exact OU domaine contenu dans la sortie (robuste si Kimi ajoute un mot).
      const match = DOMAINS.find((d) => d === raw) ?? DOMAINS.find((d) => raw.includes(d));
      if (!match) {
        logger.warn({ raw: txt.slice(0, 40) }, "domain_classifier_invalid_output");
        return fallback;
      }
      return match;
    },
  });

  cacheSet(key, result);
  return result;
}
