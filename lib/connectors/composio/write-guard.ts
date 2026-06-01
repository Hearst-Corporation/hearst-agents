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
  "_ADD_",
] as const;

// Segments that look like writes but need a word-boundary-aware check.
// "_ASSIGN_" alone false-positives on reads that contain the substring —
// including Composio-mangled slugs like GITHUB_ISSUES_LIST_ASSIGN_EES
// (Composio truncates ASSIGNEES → ASSIGN_EES, producing LIST_ASSIGN_ directly).
//
// Pattern: match LIST_/GET_/FETCH_ followed by zero-or-more 'WORD_' groups
// then ASSIGN_. This covers both LIST_ASSIGN_ (direct) and LIST_EES_ASSIGN_
// (intermediate segment). Real writes (JIRA_ASSIGN_ISSUE) have no read prefix.
const WRITE_PATTERN_ASSIGN = /_ASSIGN_/;
const READ_PREFIX_BEFORE_ASSIGN = /(?:LIST|GET|FETCH)_(?:[A-Z]+_)*ASSIGN_/;

// Handles tools that START with a write verb (no leading underscore)
const WRITE_PREFIXES = ["SEND_", "CREATE_", "DELETE_", "UPDATE_", "POST_", "PUBLISH_"] as const;

export function isWriteAction(toolName: string): boolean {
  const upper = toolName.toUpperCase();

  // Segment-based check (fast path — no regex).
  if (WRITE_SEGMENTS.some((seg) => upper.includes(seg))) return true;

  // Prefix-based check.
  if (WRITE_PREFIXES.some((pfx) => upper.startsWith(pfx))) return true;

  // _ASSIGN_ is a write (e.g. JIRA_ASSIGN_ISSUE, GITHUB_ADD_ASSIGNEES_TO_AN_ISSUE),
  // but must not fire when the _ASSIGN_ substring appears after a read verb like
  // LIST_/GET_/FETCH_ (e.g. a future GITHUB_GET_ASSIGNEES_LIST pattern).
  if (WRITE_PATTERN_ASSIGN.test(upper) && !READ_PREFIX_BEFORE_ASSIGN.test(upper)) return true;

  return false;
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
  if (upper.includes("_ADD_")) return "Ajouter";
  if (WRITE_PATTERN_ASSIGN.test(upper) && !READ_PREFIX_BEFORE_ASSIGN.test(upper)) return "Assigner";
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

// ── Tool cap ─────────────────────────────────────────────────

/** Maximum number of tools returned by filterToolsByDomain — exported so tests don't hardcode 40. */
export const MAX_TOOLS = 40;

/** Slots reserved for essential tools — half the budget (cap, not a minimum). */
const ESSENTIAL_RESERVE = Math.floor(MAX_TOOLS / 2);

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
 * Always caps at MAX_TOOLS (40) to prevent token explosion.
 *
 * Pour le domaine "general", on fait du round-robin par app : on garantit
 * qu'au moins 1 tool de chaque app connectée passe la limite avant qu'une
 * app n'en place 2. Sans ce ré-équilibrage, les apps avec beaucoup d'actions
 * (gmail, slack) saturaient les 40 premiers slots et masquaient l'existence
 * des apps minoritaires (notion, github, hubspot, figma) au LLM — qui
 * répondait alors "tu n'as que Gmail, Slack et Stripe" alors que 12 apps
 * étaient connectées.
 *
 * ESSENTIAL SEEDING: before the round-robin, all tools flagged `essential:true`
 * (set by discovery.ts for ESSENTIAL_READS registry entries) are seeded into
 * the result first — up to ESSENTIAL_RESERVE slots (= MAX_TOOLS / 2 = 20).
 * The seed uses a ROUND-ROBIN across apps (layer 0 = first essential of each
 * app, layer 1 = second of each app, …) so that every connected app gets at
 * least its first essential before any app claims extra reserve slots. Without
 * this fairness, a sequential pass over 6+ apps (≥24 essentials > 20 reserve)
 * would give the last-connected apps zero essentials. The reserve cap prevents
 * essentials from eating the full budget — writes and non-essential reads still
 * fill the remaining slots via the interleave + round-robin (Stage 2).
 */
export function filterToolsByDomain(
  tools: import("./discovery").DiscoveredTool[],
  domain: string,
): import("./discovery").DiscoveredTool[] {
  const allowlist = DOMAIN_APP_ALLOWLIST[domain];
  const candidates = allowlist
    ? tools.filter((t) => allowlist.includes(t.app.toLowerCase()))
    : tools;

  // ── Stage 1: Seed essentials — round-robin across apps ──────────────────
  // Group essential tools by app, then fill layer-by-layer (layer 0 = first
  // essential of each app, layer 1 = second of each app, …) until
  // ESSENTIAL_RESERVE is reached. This guarantees every connected app gets at
  // least its first essential(s) before any app gets extra slots — preventing
  // last-connected apps from receiving 0 essentials when ≥6 apps contribute
  // essentials and the total exceeds the reserve.
  // Dedup by name is preserved; intra-app relative order is stable.
  const seededNames = new Set<string>();
  const result: import("./discovery").DiscoveredTool[] = [];

  // Build per-app essential buckets (preserving input order within each app).
  const essentialByApp = new Map<string, import("./discovery").DiscoveredTool[]>();
  for (const t of candidates) {
    if (!t.essential) continue;
    if (seededNames.has(t.name)) continue;
    const appKey = t.app.toLowerCase();
    const bucket = essentialByApp.get(appKey);
    if (bucket) bucket.push(t);
    else essentialByApp.set(appKey, [t]);
    seededNames.add(t.name); // pre-register to dedup across buckets
  }
  // Reset seededNames — we only used it above for dedup during bucketing.
  // Re-populate it properly as we push into result during the round-robin.
  seededNames.clear();

  let seedLayer = 0;
  while (result.length < ESSENTIAL_RESERVE) {
    let pickedThisSeedLayer = false;
    for (const bucket of essentialByApp.values()) {
      if (result.length >= ESSENTIAL_RESERVE) break;
      const t = bucket[seedLayer];
      if (t && !seededNames.has(t.name)) {
        result.push(t);
        seededNames.add(t.name);
        pickedThisSeedLayer = true;
      }
    }
    if (!pickedThisSeedLayer) break;
    seedLayer++;
  }

  // ── Stage 2: Round-robin fill for remaining slots ────────────────────────
  // Build per-app buckets from NON-seeded candidates (skip already-seeded
  // essentials to avoid duplicates in the round-robin fill).
  const remaining = candidates.filter((t) => !seededNames.has(t.name));

  // Round-robin par app : on lit en couches successives. Au tour N, on
  // ajoute le N-ième tool de chaque app (s'il existe). Chaque app reçoit
  // ainsi sa part avant qu'une seule app ne consomme tout le quota.
  const byApp = new Map<string, import("./discovery").DiscoveredTool[]>();
  for (const t of remaining) {
    const app = t.app.toLowerCase();
    const list = byApp.get(app);
    if (list) list.push(t);
    else byApp.set(app, [t]);
  }

  // Interleave reads and writes per app (stable: preserves alphabetical order
  // within each group). Pattern: [read0, write0, read1, write1, …, leftovers].
  //
  // WHY NOT "all reads first": with a read-heavy app (e.g. only GitHub, ~40
  // reads), a pure reads-first sort evicts ALL write actions (CREATE_ISSUE,
  // CREATE_PR) from the 40-cap round-robin. Interleaving guarantees that BOTH
  // top reads AND top writes survive the cap regardless of per-app read/write
  // ratio.
  for (const [appKey, list] of byApp) {
    const reads = list.filter((t) => !isWriteAction(t.name));
    const writes = list.filter((t) => isWriteAction(t.name));
    const interleaved: typeof list = [];
    const maxLen = Math.max(reads.length, writes.length);
    for (let i = 0; i < maxLen; i++) {
      if (reads[i]) interleaved.push(reads[i]);
      if (writes[i]) interleaved.push(writes[i]);
    }
    byApp.set(appKey, interleaved);
  }

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
