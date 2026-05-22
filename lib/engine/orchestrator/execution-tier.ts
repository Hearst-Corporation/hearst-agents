/**
 * execution-tier — classification PURE (zéro LLM) de la « voie d'exécution »
 * d'un message, pour BORNER le toolset de l'orchestrateur AVANT l'appel LLM.
 *
 * Tiers (ordre = plan d'imbrication Hearst, SafetyGate géré en amont) :
 *   - action : verbe machine (naviguer / ouvrir une URL / remplir / cliquer…)
 *              → destiné au computer-use distant HEARST.AI core/ (bloc action).
 *   - swarm  : intent complexe (≥80 chars + composition), recherche approfondie,
 *              ou demande explicite de swarm/revue/audit → hive-engine.
 *   - memory : recall pur de mémoire (« qu'est-ce que j'avais noté sur X »).
 *   - direct : défaut — réponse directe en un tour.
 *
 * Le tier NE DÉCIDE PAS à la place du LLM : il GUIDE en cadrant les tools
 * disponibles (cf. gateToolsByTier). En particulier kickoff_swarm (swarm hive
 * 4-8 min, coûteux) n'est proposé que sur un intent assez riche → anti-sur-
 * déclenchement. Fail-soft : tout cas non reconnu retombe sur « direct ».
 *
 * Fonction pure et déterministe → testable sans mock, réutilisable.
 */

import { isResearchIntent } from "./research-intent";
import { isComplexIntent } from "./run-planner-workflow";

export type ExecutionTier = "direct" | "swarm" | "action" | "memory";

export interface TierClassification {
  tier: ExecutionTier;
  reason: string;
}

// Verbes d'action sur machine/navigateur/desktop → tier action. Patterns
// volontairement spécifiques (contexte web/desktop) pour éviter les faux
// positifs sur un « ouvre » ou « clique » employé au sens figuré.
const ACTION_PATTERNS: RegExp[] = [
  /\b(navigue|naviguer|va sur le site|ouvre (?:le site|la page|l'?url)|remplis le formulaire|clique sur|télécharge depuis|connecte-toi (?:à|sur)|réserve sur|commande sur)\b/i,
  /\b(browse to|navigate to|go to the (?:site|page|url)|fill (?:in|out) the form|click (?:on )?the|download from|log ?in to|book on|check ?out on)\b/i,
  /\bhttps?:\/\/\S+/i, // URL explicite = forte intention d'agir sur le web
];

// Demande EXPLICITE de réflexion multi-agent (sans seuil de longueur, contrairement
// à isComplexIntent) — « lance une revue », « fais un audit », etc.
const SWARM_EXPLICIT_PATTERNS: RegExp[] = [
  /\b(swarm|analyse (?:complète|approfondie)|revue (?:de|du|complète)|audit (?:de|complet)|recherche approfondie|étude approfondie)\b/i,
  /\b(deep research|deep dive|full (?:analysis|review|audit)|thorough (?:analysis|review))\b/i,
];

// Recall PUR de mémoire (lecture d'historique, pas synthèse ni action) → tier memory.
// Patterns volontairement apostrophe-agnostiques (frontière \b avant le verbe).
const RECALL_PATTERNS: RegExp[] = [
  // Pas de \b après les mots accentués (noté/décidé/pensé) : en regex JS non-unicode
  // « é » est un non-mot → \b échouerait juste après.
  /\bavais (?:dit|écrit|noté|décidé|pensé)/i, // « (ce que) j'avais noté / dit… »
  /\bmes notes?\b/i,
  /\bmon historique\b/i,
  /\bretrouve\b.{0,20}\bnotes?\b/i,
  /\brappelle[ -]moi\b.{0,25}(?:ce que|note|dit|écrit|décidé)/i,
  /\bwhat did i (?:say|write|note|decide|think)\b/i,
  /\bmy notes? (?:on|about)\b/i,
  /\bmy history\b/i,
  /\bin my notes?\b/i,
];

export function hasActionVerb(message: string): boolean {
  return ACTION_PATTERNS.some((re) => re.test(message));
}

export function isExplicitSwarmRequest(message: string): boolean {
  return SWARM_EXPLICIT_PATTERNS.some((re) => re.test(message));
}

export function isRecallIntent(message: string): boolean {
  return RECALL_PATTERNS.some((re) => re.test(message));
}

/**
 * Classe le message en tier d'exécution. Pure & déterministe.
 */
export function classifyExecutionTier(message: string): TierClassification {
  const msg = (message ?? "").trim();
  if (!msg) return { tier: "direct", reason: "empty" };

  // 1. Action machine (verbe explicite / URL) — priorité haute.
  if (hasActionVerb(msg)) return { tier: "action", reason: "action_verb" };

  // 2. Réflexion multi-agent : demande explicite, OU intent complexe (≥80 chars
  //    + composition), OU recherche approfondie.
  if (isExplicitSwarmRequest(msg)) return { tier: "swarm", reason: "explicit_swarm" };
  if (isComplexIntent(msg)) return { tier: "swarm", reason: "complex_intent" };
  if (isResearchIntent(msg)) return { tier: "swarm", reason: "research_intent" };

  // 3. Recall pur de mémoire.
  if (isRecallIntent(msg)) return { tier: "memory", reason: "recall_intent" };

  // 4. Défaut : réponse directe.
  return { tier: "direct", reason: "default" };
}

// Tools coûteux/asynchrones à ne proposer au LLM que si le tier les justifie.
const TIER_GATED_TOOLS: Record<string, ExecutionTier> = {
  // kickoff_swarm = swarm hive 4-8 min : réservé au tier "swarm".
  kickoff_swarm: "swarm",
};

/**
 * Retire d'`allowedTools` les tools coûteux dont le tier courant ne fait pas
 * partie du tier requis. Anti-sur-déclenchement : évite qu'un swarm cher soit
 * lancé sur une requête simple. cortex_search (mémoire, peu coûteux) n'est PAS
 * gaté → toujours disponible. Idempotent et fail-soft (entrée vide → vide).
 */
export function gateToolsByTier(allowedTools: string[], tier: ExecutionTier): string[] {
  if (!Array.isArray(allowedTools) || allowedTools.length === 0) return allowedTools ?? [];
  return allowedTools.filter((tool) => {
    const requiredTier = TIER_GATED_TOOLS[tool];
    return requiredTier === undefined || requiredTier === tier;
  });
}
