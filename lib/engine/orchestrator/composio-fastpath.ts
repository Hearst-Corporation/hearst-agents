/**
 * Composio fast-path — détection regex des 5 intentions de lecture les plus
 * fréquentes, sans tour LLM.
 *
 * POURQUOI : pour les reads simples (boîte mail, agenda, drive, Slack, GitHub),
 * le pipeline complet paie ~2-2.5s pour l'injection des schémas Composio + le
 * tour LLM de routing. Or l'intention est explicite et non ambiguë → on peut
 * détecter par regex et exécuter l'action directement.
 *
 * GARDE-FOUS :
 * - Fonction PURE, zéro effet de bord.
 * - Retourne null si intent d'écriture détecté.
 * - Retourne null si référence au contexte (hier, réunion précédente, etc.) →
 *   ce fast-path n'a ni mémoire ni KG.
 * - Retourne null si aucun match → fall-through pipeline complet.
 *
 * FEATURE FLAG : ce module n'est actif que si
 * `process.env.HELM_COMPOSIO_FASTPATH === "1"` (vérifié dans index.ts).
 * Par défaut OFF → comportement identique à avant sur tous les envs.
 */

export interface FastPathAction {
  /** Slug Composio réel (vérifié dans SLUG_ALIASES / discovery.ts le 2026-06-01). */
  slug: string;
  args: Record<string, unknown>;
}

// ── Garde-fous prioritaires ─────────────────────────────────────────────────

/**
 * Signaux d'intent d'ÉCRITURE — retourner null immédiatement.
 * Le fast-path ne fait JAMAIS d'opération destructive.
 */
const WRITE_SIGNALS =
  /\b(envoi[er]?|envoie|send|compose|compos[er]?|crée[r]?|create|supprimer?|delete|répond[sr]?|reply|draft|brouillon|archive[rz]?|transfèr[er]?|forward|modifi[er]?|update|édite[r]?|ajoute[r]?|add|planifie[r]?|schedule|réserve[r]?|book)\b/i;

/**
 * Signaux de CONTEXTE (mémoire conversationnelle ou KG requis).
 * Le fast-path n'a accès ni à l'historique ni au vault → null.
 */
const CONTEXT_SIGNALS =
  /\b(hier|yesterday|précédent|precedent|previous|avant|d'après|based on|la réunion|the meeting|le mail précédent|tout à l'heure|l'autre jour|ce matin|ce soir|cette nuit|l'email dont|ce dont|on a parlé|nous avons décidé|que j'ai (envoyé|reçu|écrit|dit)|I (sent|received|wrote|said)|ce mail|cet email|this email|that email)\b/i;

// ── Patterns de détection par service ──────────────────────────────────────
//
// Slugs vérifiés dans discovery.ts le 2026-06-01 :
//   GMAIL_FETCH_EMAILS          (index 102)
//   GOOGLECALENDAR_EVENTS_LIST  (index 90)
//   GOOGLEDRIVE_LIST_FILES      (index 96)
//   SLACK_LIST_ALL_CHANNELS     (index 69)
//   GITHUB_FIND_REPOSITORIES    (index 65)

interface FastPathRule {
  pattern: RegExp;
  slug: string;
  args: Record<string, unknown>;
}

const FAST_PATH_RULES: FastPathRule[] = [
  // Gmail — lis / montre / check / fetch / affiche mes mails / inbox
  {
    pattern:
      /(lis|lire|montre|affiche|check|fetch|read|show|consulte|ouvre|voir|vois).{0,20}(mail|email|inbox|boîte|courriel|message)/i,
    slug: "GMAIL_FETCH_EMAILS",
    args: { max_results: 10 },
  },
  // Google Calendar — agenda / calendrier / réunions / planning
  {
    pattern:
      /(agenda|calendrier|calendar|réunion|meeting|rendez-vous|rdv|planning|évènement|événement|event).{0,30}(aujourd|today|demain|tomorrow|semaine|week|prochain|cette|ce)?/i,
    slug: "GOOGLECALENDAR_EVENTS_LIST",
    args: { maxResults: 10 },
  },
  // Google Drive — liste / montre / cherche fichiers / documents / drive
  // \b sur "doc" pour éviter les faux positifs : "documentation", "docteur", etc.
  {
    pattern:
      /(liste|montre|affiche|cherche|list|show|find|trouve|voir|vois).{0,20}(fichier|file|\bdocuments?\b|\bdoc\b|drive|dossier|folder)/i,
    slug: "GOOGLEDRIVE_LIST_FILES",
    args: { page_size: 20 },
  },
  // Slack — canaux / channels / messages Slack (slack peut être avant ou après le mot-clé)
  {
    pattern: /\bslack\b.{0,40}(canal|canaux|channel|message|conversation|workspace|équipe|team)/i,
    slug: "SLACK_LIST_ALL_CHANNELS",
    args: {},
  },
  // Slack — mot-clé avant "slack" (ex: "mes conversations slack")
  {
    pattern: /(canal|canaux|channel|message|conversation|workspace|équipe|team).{0,40}\bslack\b/i,
    slug: "SLACK_LIST_ALL_CHANNELS",
    args: {},
  },
  // GitHub — repos / repositories
  {
    pattern:
      /(liste|montre|affiche|list|show|find|trouve|mes).{0,20}(repo|repos|repository|repositories|dépôt|dépôts|github)/i,
    slug: "GITHUB_FIND_REPOSITORIES",
    args: { limit: 20 },
  },
];

/**
 * Détecte si le message correspond à une intention de lecture Composio
 * connue et retourne le slug + les args à passer directement.
 *
 * Retourne `null` si :
 * - intent d'écriture détecté (jamais de write en fast-path)
 * - référence au contexte conversationnel (hier, précédent, etc.)
 * - aucun pattern ne matche
 *
 * Fonction PURE — aucun effet de bord, testable sans dépendances.
 */
export function detectFastPathAction(message: string): FastPathAction | null {
  const m = message.trim();
  if (!m) return null;

  // Priorité 1 : guard écriture — retour immédiat sans même tester les patterns
  if (WRITE_SIGNALS.test(m)) return null;

  // Priorité 2 : guard contexte conversationnel
  if (CONTEXT_SIGNALS.test(m)) return null;

  // Parcours des règles dans l'ordre
  for (const rule of FAST_PATH_RULES) {
    if (rule.pattern.test(m)) {
      return { slug: rule.slug, args: rule.args };
    }
  }

  return null;
}
