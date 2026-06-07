/**
 * Composio Discovery — per-user tool resolution against the new SDK.
 *
 * Strategy:
 *  1. List the user's ACTIVE connected toolkits via `connectedAccounts.list`.
 *     This is the source-of-truth — `tools.get({userId})` alone has been
 *     observed returning empty sets after a fresh OAuth (eventual consistency
 *     on Composio's side), which produced "Slack n'est pas connecté"
 *     hallucinations even when the toolkit was ACTIVE.
 *  2. Fetch tool definitions via `tools.get(userId, { toolkits: [active], limit })`.
 *     The SDK returns OpenAI-style `{ type, function: { name, description, parameters } }`.
 *  3. If a toolkit is ACTIVE but the SDK returns no tools for it, the
 *     discrepancy is logged so we can detect propagation lag.
 *
 * Cache: 60s TTL (reduced from 5min). We also refuse to cache empty results
 * — a freshly-connected user would otherwise be locked out for the full TTL.
 * Invalidated explicitly on connect / disconnect / OAuth return.
 */

import { logger } from "@/lib/observability/logger";
import {
  getCacheEntry,
  invalidateUserDiscovery,
  resetDiscoveryCache,
  setCacheEntry,
} from "./cache";
import { getComposio } from "./client";
import { listConnections } from "./connections";
import type { DiscoveredTool } from "./types";

export type { DiscoveredTool };
export { invalidateUserDiscovery, resetDiscoveryCache };

// Max tools fetched from Composio per toolkit in a single request (runtime path).
// Composio v3 returns actions in NATIVE (not alphabetical) order. For GitHub,
// key read actions like GITHUB_GET_A_REPOSITORY (native index 324) or
// GITHUB_FIND_PULL_REQUESTS (native index 236) sit well beyond this limit.
// The ESSENTIAL_READS fetch below guarantees those are always present regardless
// of native order. This limit covers writes + nearby reads for the tool list shown
// to the LLM.
const TOOLS_PER_TOOLKIT = 60;

// Separate higher limit for the UI catalogue drawer (getToolsForApp).
// The drawer shows "what your agent could do" before connection — breadth matters
// more than latency here, so we use a larger limit than the runtime path.
const CATALOG_TOOLS_PER_APP = 100;

// ── Essential Read-Actions Registry ─────────────────────────────────────────
//
// Composio v3 returns actions in NATIVE order (not alphabetical). Critical read
// actions for GitHub sit at native indices 236-324 out of 823 total, meaning a
// limit of 60 (TOOLS_PER_TOOLKIT) never reaches them. To guarantee those reads
// are always available, we fetch them explicitly by slug via tools.get({ tools: [...] })
// (ToolsOnlyParams — deterministic, ignores limit/native order), then MERGE+dedup
// into the per-toolkit result.
//
// HOW TO ADD a toolkit: verify slugs via GET /api/v3/tools?toolkit_slug=<tk>&limit=400,
// then add an entry keyed by the lowercase toolkit slug (e.g. "github", "notion").
// Slugs verified against the API on 2026-06-01. Only add slugs confirmed present.
export const ESSENTIAL_READS: Record<string, string[]> = {
  github: [
    "GITHUB_GET_A_REPOSITORY", // native index 324 — verified 2026-06-01
    "GITHUB_FIND_PULL_REQUESTS", // native index 236 — verified 2026-06-01
    "GITHUB_GET_AN_ISSUE", // native index 300 — verified 2026-06-01
    "GITHUB_FIND_REPOSITORIES", // native index 237 — verified 2026-06-01
  ],
  slack: [
    "SLACK_FETCH_CONVERSATION_HISTORY", // verified 2026-06-01
    "SLACK_LIST_ALL_CHANNELS", // verified 2026-06-01
    "SLACK_FIND_USER_BY_EMAIL_ADDRESS", // verified 2026-06-01
    "SLACK_LIST_ALL_SLACK_TEAM_USERS_WITH_PAGINATION", // verified 2026-06-01
  ],
  trello: [
    "TRELLO_GET_BOARDS_BY_ID_BOARD", // verified 2026-06-01
    "TRELLO_BOARD_GET_CARDS_BY_ID_BOARD", // verified 2026-06-01
    "TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD", // verified 2026-06-01
    "TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER", // verified 2026-06-01
  ],
  linear: [
    "LINEAR_LIST_LINEAR_ISSUES", // verified 2026-06-01
    "LINEAR_GET_LINEAR_ISSUE", // verified 2026-06-01
    "LINEAR_LIST_LINEAR_TEAMS", // verified 2026-06-01
  ],
  dropbox: [
    "DROPBOX_LIST_FILES_IN_FOLDER", // verified 2026-06-01
    "DROPBOX_LIST_FOLDERS", // verified 2026-06-01
    "DROPBOX_SEARCH_FILE_OR_FOLDER", // verified 2026-06-01
  ],
  googlecalendar: [
    "GOOGLECALENDAR_EVENTS_LIST", // verified 2026-06-01
    "GOOGLECALENDAR_FIND_EVENT", // verified 2026-06-01
    "GOOGLECALENDAR_LIST_CALENDARS", // verified 2026-06-01
    "GOOGLECALENDAR_FIND_FREE_SLOTS", // verified 2026-06-01
  ],
  googledrive: [
    "GOOGLEDRIVE_LIST_FILES", // verified 2026-06-01
    "GOOGLEDRIVE_FIND_FILE", // verified 2026-06-01
    "GOOGLEDRIVE_FIND_FOLDER", // verified 2026-06-01
    "GOOGLEDRIVE_GET_FILE_METADATA", // verified 2026-06-01
  ],
  gmail: [
    "GMAIL_FETCH_EMAILS", // verified 2026-06-01
    "GMAIL_LIST_THREADS", // verified 2026-06-01
    "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", // verified 2026-06-01
    "GMAIL_LIST_LABELS", // verified 2026-06-01
  ],
};

interface RawTool {
  type?: "function";
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

function toDiscoveredTool(raw: RawTool, essential?: boolean): DiscoveredTool | null {
  const fn = raw.function;
  if (!fn?.name) return null;
  const name = fn.name.toUpperCase();
  const app = name.split("_")[0]?.toLowerCase() ?? "unknown";
  const tool: DiscoveredTool = {
    name,
    description: fn.description ?? "",
    parameters: fn.parameters ?? { type: "object", properties: {} },
    app,
  };
  if (essential) tool.essential = true;
  return tool;
}

export async function getToolsForUser(
  userId: string,
  opts: { apps?: string[]; force?: boolean } = {},
): Promise<DiscoveredTool[]> {
  if (!userId) return [];

  const cacheKey = `${userId}::${(opts.apps ?? []).sort().join(",")}`;
  if (!opts.force) {
    const hit = getCacheEntry(cacheKey);
    if (hit) return hit as DiscoveredTool[];
  }

  const composio = await getComposio();
  if (!composio) return [];

  try {
    // 1. Source-of-truth: which toolkits does the user actually have ACTIVE?
    //    `apps` filter (if provided) intersects with the active set so we
    //    never query for toolkits the user hasn't connected.
    const accounts = await listConnections(userId);
    const activeSlugs = Array.from(
      new Set(
        accounts
          .filter((a) => a.status === "ACTIVE")
          .map((a) => a.appName.toLowerCase())
          .filter(Boolean),
      ),
    );

    const requestedSlugs = (opts.apps ?? []).map((a) => a.toLowerCase());
    const targetSlugs =
      requestedSlugs.length > 0
        ? activeSlugs.filter((s) => requestedSlugs.includes(s))
        : activeSlugs;

    if (targetSlugs.length === 0) {
      logger.info(
        {
          userId,
          totalAccounts: accounts.length,
          statuses: accounts.map((a) => `${a.appName}:${a.status}`).join(", ") || "none",
        },
        "[Composio/Discovery] no ACTIVE toolkits",
      );
      // Don't cache an empty result — the user might be mid-OAuth.
      return [];
    }

    // 2. Fetch tool definitions PER TOOLKIT en parallèle.
    //    L'API Composio limite la réponse globale (limit=100 retourne 100 max
    //    AU TOTAL sur tous les toolkits demandés). Pour un user avec 5+ apps,
    //    ça tronque silencieusement — les premiers toolkits (alphabétique)
    //    saturent la limite, les suivants (slack, stripe, etc.) reviennent
    //    vides → "ACTIVE toolkits with no tools" warning + agent qui dit
    //    "je n'ai pas accès à Slack". Itération individuelle = couverture
    //    équitable et déterministe entre toolkits.
    //
    //    For each toolkit that has ESSENTIAL_READS entries, we ALSO do a
    //    deterministic fetch by slug (ToolsOnlyParams: { tools: [...] }) which
    //    ignores native order and limit. We merge+dedup by uppercase name so
    //    critical reads are always present regardless of where they sit in
    //    the native index.
    // perToolkitResults: array of tagged raw-tool arrays, one per toolkit.
    // Each entry is { raw: RawTool; essential: boolean } so that we can pass
    // the essential flag through to DiscoveredTool without a second pass.
    const perToolkitResults = await Promise.all(
      targetSlugs.map(async (slug) => {
        try {
          // General and essential fetches are independent — run in parallel
          // to halve cold-start latency for registry toolkits.
          const essentialSlugs = ESSENTIAL_READS[slug];
          // Build a Set of uppercase names for O(1) lookup below.
          const essentialNameSet = essentialSlugs
            ? new Set(essentialSlugs.map((s) => s.toUpperCase()))
            : null;

          const generalPromise = composio.tools.get(userId, {
            toolkits: [slug],
            limit: TOOLS_PER_TOOLKIT,
          }) as Promise<{ items?: RawTool[] } | RawTool[]>;

          const essentialPromise: Promise<{ items?: RawTool[] } | RawTool[] | null> = essentialSlugs
            ? (composio.tools.get(userId, {
                tools: essentialSlugs,
              }) as Promise<{ items?: RawTool[] } | RawTool[]>)
            : Promise.resolve(null);

          const [generalRaw, essRawOrNull] = await Promise.all([
            generalPromise,
            // Essential fetch: swallow errors — failure must never evict the general results.
            essentialPromise.catch((essErr) => {
              logger.warn(
                { toolkit: slug, err: essErr instanceof Error ? essErr.message : String(essErr) },
                "[Composio/Discovery] essential reads fetch failed — returning general results only",
              );
              return null;
            }),
          ]);

          const general = Array.isArray(generalRaw)
            ? generalRaw
            : ((generalRaw as { items?: RawTool[] } | null | undefined)?.items ?? []);

          // Tag general tools: mark as essential if their name is in the registry
          // (handles the case where an essential was already in the first-60 general
          // fetch — it's already present but must still be seeded first by write-guard).
          type Tagged = { raw: RawTool; essential: boolean };
          const taggedGeneral: Tagged[] = general.map((raw) => ({
            raw,
            essential:
              essentialNameSet !== null &&
              !!raw.function?.name &&
              essentialNameSet.has(raw.function.name.toUpperCase()),
          }));

          if (essRawOrNull !== null) {
            const essItems = Array.isArray(essRawOrNull)
              ? essRawOrNull
              : (essRawOrNull.items ?? []);
            // Dedup: only prepend items NOT already in general (by uppercase name).
            const seenInGeneral = new Set(
              general.map((t) => t.function?.name?.toUpperCase()).filter(Boolean),
            );
            const taggedEss: Tagged[] = essItems
              .filter((item) => {
                const name = item.function?.name?.toUpperCase();
                return name && !seenInGeneral.has(name);
              })
              .map((raw) => ({ raw, essential: true }));
            // PREPEND: essentials first → survive the cap via both prepend AND seeding.
            return [...taggedEss, ...taggedGeneral];
          }

          return taggedGeneral;
        } catch (err) {
          logger.warn(
            { toolkit: slug, err: err instanceof Error ? err.message : String(err) },
            "[Composio/Discovery] tools.get failed for toolkit",
          );
          return [] as Array<{ raw: RawTool; essential: boolean }>;
        }
      }),
    );
    const items = perToolkitResults.flat();
    const tools = items
      .map(({ raw, essential }) => toDiscoveredTool(raw, essential || undefined))
      .filter((t): t is DiscoveredTool => t !== null);

    // 3. Detect Composio propagation lag: toolkit ACTIVE but no tools listed.
    const slugsInTools = new Set(tools.map((t) => t.app));
    const missing = targetSlugs.filter((s) => !slugsInTools.has(s));
    if (missing.length > 0) {
      logger.warn(
        {
          userId,
          missing,
          toolCount: tools.length,
          toolkitCount: slugsInTools.size,
        },
        "[Composio/Discovery] ACTIVE toolkits with no tools — likely Composio eventual-consistency lag, retry shortly",
      );
    }

    logger.info(
      { userId, toolCount: tools.length, toolkits: [...slugsInTools] },
      "[Composio/Discovery] tools resolved",
    );

    // Only cache when we actually got tools — avoid pinning an empty
    // response right after OAuth completion.
    if (tools.length > 0) {
      setCacheEntry(cacheKey, tools);
    }
    return tools;
  } catch (err) {
    logger.error(
      {
        userId,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      "[Composio/Discovery] unexpected error in getToolsForUser",
    );
    return [];
  }
}

/**
 * Liste les tools d'UN toolkit, **sans filtrer** par connexions actives.
 *
 * Différence avec `getToolsForUser` : la fonction principale n'expose que
 * les tools des toolkits que l'utilisateur a effectivement connectés.
 * `getToolsForApp` est utilisé côté UI (drawer /apps) pour montrer
 * "ce que ton agent pourra faire" AVANT la connexion — discovery éditoriale,
 * pas runtime.
 *
 * Cache séparé du cache principal (clé préfixée `app::`) pour éviter de
 * pourrir les lookups runtime quand on browse le catalogue.
 */
interface AppCacheEntry {
  tools: DiscoveredTool[];
  expiresAt: number;
}

const appCache = new Map<string, AppCacheEntry>();
const APP_TTL_MS = 5 * 60_000;

export async function getToolsForApp(userId: string, app: string): Promise<DiscoveredTool[]> {
  if (!userId || !app) return [];

  const slug = app.toLowerCase();
  const cacheKey = `app::${slug}`;
  const now = Date.now();
  const hit = appCache.get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.tools;

  const composio = await getComposio();
  if (!composio) return [];

  try {
    // CATALOG_TOOLS_PER_APP > TOOLS_PER_TOOLKIT: the catalogue drawer needs
    // breadth (show what's possible before connection), not just the runtime
    // slice the LLM gets. Using the runtime limit here was a regression.
    const raw = (await composio.tools.get(userId, {
      toolkits: [slug],
      limit: CATALOG_TOOLS_PER_APP,
    })) as { items?: RawTool[] } | RawTool[];
    const items = Array.isArray(raw) ? raw : (raw.items ?? []);
    const tools = items
      .map((r) => toDiscoveredTool(r))
      .filter((t): t is DiscoveredTool => t !== null);

    if (tools.length > 0) {
      appCache.set(cacheKey, { tools, expiresAt: now + APP_TTL_MS });
    }
    return tools;
  } catch (err) {
    logger.warn(
      { app: slug, err: err instanceof Error ? err.message : String(err) },
      "[Composio/Discovery] getToolsForApp failed",
    );
    return [];
  }
}

export function toAnthropicTools(tools: DiscoveredTool[]): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

export function toOpenAITools(tools: DiscoveredTool[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
