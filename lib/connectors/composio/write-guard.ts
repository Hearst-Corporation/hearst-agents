/**
 * Write Action Guard — preview gate for destructive Composio tools.
 *
 * Write tools (send, create, delete, update …) always go through a
 * two-step pattern:
 *   1. Model calls with `_preview: true`  → returns formatted draft, no side-effect.
 *   2. User confirms → model calls with `_preview: false` → executes via Composio.
 *
 * Read-only tools (list, get, search, fetch …) bypass the gate entirely.
 */

// ── Write-action detection ────────────────────────────────────

const WRITE_SEGMENTS = [
  "_SEND_",
  "_CREATE_",
  "_DELETE_",
  "_UPDATE_",
  "_REPLY_",
  "_ARCHIVE_",
  "_MOVE_",
  "_POST_",
  "_PUBLISH_",
  "_REMOVE_",
  "_WRITE_",
  "_PATCH_",
  "_PUT_",
  "_SUBMIT_",
  "_FORWARD_",
  "_MARK_",
  "_UNSUBSCRIBE_",
  "_INVITE_",
  "_ASSIGN_",
] as const;

// Handles tools that START with a write verb (no leading underscore)
const WRITE_PREFIXES = ["SEND_", "CREATE_", "DELETE_", "UPDATE_", "POST_", "PUBLISH_"] as const;

export function isWriteAction(toolName: string): boolean {
  const upper = toolName.toUpperCase();
  return (
    WRITE_SEGMENTS.some((seg) => upper.includes(seg)) ||
    WRITE_PREFIXES.some((pfx) => upper.startsWith(pfx))
  );
}

// ── App + verb extraction ─────────────────────────────────────

function extractApp(toolName: string): string {
  return toolName.split("_")[0]?.toLowerCase() ?? toolName.toLowerCase();
}

function extractVerb(toolName: string): string {
  const upper = toolName.toUpperCase();
  if (upper.includes("_SEND_") || upper.startsWith("SEND_")) return "Envoyer";
  if (upper.includes("_CREATE_") || upper.startsWith("CREATE_")) return "Créer";
  if (upper.includes("_DELETE_")) return "Supprimer";
  if (upper.includes("_UPDATE_") || upper.includes("_PATCH_")) return "Modifier";
  if (upper.includes("_REPLY_")) return "Répondre";
  if (upper.includes("_ARCHIVE_")) return "Archiver";
  if (upper.includes("_MOVE_")) return "Déplacer";
  if (upper.includes("_POST_") || upper.startsWith("POST_")) return "Publier";
  if (upper.includes("_PUBLISH_")) return "Publier";
  if (upper.includes("_REMOVE_")) return "Supprimer";
  if (upper.includes("_FORWARD_")) return "Transférer";
  if (upper.includes("_INVITE_")) return "Inviter";
  if (upper.includes("_ASSIGN_")) return "Assigner";
  return "Exécuter";
}

// ── Preview formatter ─────────────────────────────────────────

const MAX_PREVIEW_VALUE_LEN = 300;

function formatValue(v: unknown): string {
  if (typeof v === "string")
    return v.length > MAX_PREVIEW_VALUE_LEN ? `${v.slice(0, MAX_PREVIEW_VALUE_LEN)}…` : v;
  if (typeof v === "object" && v !== null) return JSON.stringify(v).slice(0, MAX_PREVIEW_VALUE_LEN);
  return String(v);
}

// Keys shown prominently at the top of the preview
const PROMINENT_KEYS = new Set(["to", "recipient", "channel", "subject", "title", "name", "email"]);

export function formatActionPreview(toolName: string, args: Record<string, unknown>): string {
  const app = extractApp(toolName);
  const verb = extractVerb(toolName);

  const entries = Object.entries(args).filter(([k]) => !k.startsWith("_"));

  const prominent = entries.filter(([k]) => PROMINENT_KEYS.has(k.toLowerCase()));
  const rest = entries.filter(([k]) => !PROMINENT_KEYS.has(k.toLowerCase())).slice(0, 4);

  const lines = [...prominent, ...rest].map(([k, v]) => `**${k}** : ${formatValue(v)}`);

  const header = `📋 Draft · ${app.toUpperCase()} · ${verb}`;
  const body = lines.length > 0 ? lines.join("\n") : "(aucun paramètre)";
  const footer = "↩ Réponds **confirmer** pour exécuter, ou **annuler** pour abandonner.";

  return `${header}\n\n${body}\n\n${footer}`;
}

// ── Domain → Composio app allowlist ──────────────────────────

const DOMAIN_APP_ALLOWLIST: Record<string, string[]> = {
  communication: ["gmail", "slack", "outlook", "teams", "whatsapp", "telegram", "discord"],
  productivity: [
    "googlecalendar",
    "google_calendar",
    "notion",
    "todoist",
    "asana",
    "trello",
    "airtable",
  ],
  finance: ["stripe", "quickbooks", "hubspot", "chargebee", "braintree"],
  developer: ["github", "jira", "linear", "gitlab", "bitbucket", "sentry"],
  crm: ["hubspot", "salesforce", "pipedrive", "close"],
  design: ["figma"],
};

/**
 * Filter discovered tools to only those relevant for the given domain.
 * Returns all tools unchanged for "general" and "research" (no restriction).
 * Always caps at 40 tools to prevent token explosion.
 *
 * Pour le domaine "general", on fait du round-robin par app : on garantit
 * qu'au moins 1 tool de chaque app connectée passe la limite avant qu'une
 * app n'en place 2. Sans ce ré-équilibrage, les apps avec beaucoup d'actions
 * (gmail, slack) saturaient les 40 premiers slots et masquaient l'existence
 * des apps minoritaires (notion, github, hubspot, figma) au LLM — qui
 * répondait alors "tu n'as que Gmail, Slack et Stripe" alors que 12 apps
 * étaient connectées.
 */
export function filterToolsByDomain(
  tools: import("./discovery").DiscoveredTool[],
  domain: string,
): import("./discovery").DiscoveredTool[] {
  const MAX_TOOLS = 40;

  const allowlist = DOMAIN_APP_ALLOWLIST[domain];
  const candidates = allowlist
    ? tools.filter((t) => allowlist.includes(t.app.toLowerCase()))
    : tools;

  // Round-robin par app : on lit en couches successives. Au tour N, on
  // ajoute le N-ième tool de chaque app (s'il existe). Chaque app reçoit
  // ainsi sa part avant qu'une seule app ne consomme tout le quota.
  const byApp = new Map<string, import("./discovery").DiscoveredTool[]>();
  for (const t of candidates) {
    const app = t.app.toLowerCase();
    const list = byApp.get(app);
    if (list) list.push(t);
    else byApp.set(app, [t]);
  }

  const result: import("./discovery").DiscoveredTool[] = [];
  let layer = 0;
  while (result.length < MAX_TOOLS) {
    let pickedThisLayer = false;
    for (const list of byApp.values()) {
      if (result.length >= MAX_TOOLS) break;
      const tool = list[layer];
      if (tool) {
        result.push(tool);
        pickedThisLayer = true;
      }
    }
    if (!pickedThisLayer) break;
    layer++;
  }
  return result;
}
