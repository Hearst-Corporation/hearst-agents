/**
 * Composio Client — thin singleton over `@composio/core`.
 *
 * Migrated from the legacy `composio-core` (OpenAIToolSet pattern) to the
 * v0.6 SDK. Key differences:
 *  - `Composio` is the entry point; sub-modules are `tools`, `toolkits`,
 *    `connectedAccounts`, `mcp`, plus a `create(userId)` factory for
 *    Tool Router (MCP) sessions.
 *  - "Apps" are now "toolkits".
 *  - `executeAction({action, entityId, params})` becomes
 *    `composio.tools.execute(slug, { userId, arguments })`.
 *  - `connectedAccounts.initiate({entityId, appName})` becomes
 *    `composio.toolkits.authorize(userId, toolkitSlug)`.
 *
 * The SDK is loaded lazily so test runs without a live key still typecheck.
 */

import type { ComposioCallParams, ComposioResult } from "./types";

interface ComposioClient {
  // We only declare the surfaces we actually call. The full SDK surface is
  // huge; this keeps the structural type local + decoupled from SDK churn.
  tools: {
    execute(
      slug: string,
      body: {
        userId: string;
        arguments?: Record<string, unknown>;
        /** Composio 0.6+ exige une version explicite pour `tools.execute()`,
         *  sinon throw `ComposioToolVersionRequiredError`. On laisse la
         *  résolution "latest" passer en mettant ce flag — comportement
         *  identique aux versions antérieures du SDK. */
        dangerouslySkipVersionCheck?: boolean;
      },
    ): Promise<unknown>;
    get(
      userId: string,
      query: { toolkits?: string[]; tools?: string[]; limit?: number },
    ): Promise<unknown>;
  };
  toolkits: {
    list(query?: Record<string, unknown>): Promise<unknown>;
    get(slug: string): Promise<unknown>;
    authorize(
      userId: string,
      toolkitSlug: string,
      authConfigId?: string,
    ): Promise<{
      id: string;
      redirectUrl?: string | null;
    }>;
  };
  connectedAccounts: {
    list(query?: {
      userIds?: string[];
      toolkitSlugs?: string[];
      statuses?: string[];
    }): Promise<unknown>;
    delete(nanoid: string): Promise<unknown>;
  };
  /** Create a per-user Tool Router (MCP) session. */
  create(
    userId: string,
    config?: Record<string, unknown>,
  ): Promise<{
    sessionId: string;
    url?: string;
    mcp?: { type: string; url: string; headers?: Record<string, string> };
    tools?: () => Promise<unknown>;
  }>;
}

let cachedClient: ComposioClient | null = null;
let initFailed: { code: "NOT_CONFIGURED" | "SDK_NOT_INSTALLED"; message: string } | null = null;

export function resetComposioClient(): void {
  cachedClient = null;
  initFailed = null;
}

export function isComposioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

async function getClient(): Promise<ComposioClient | null> {
  if (cachedClient) return cachedClient;
  if (initFailed) return null;

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    initFailed = {
      code: "NOT_CONFIGURED",
      message: "COMPOSIO_API_KEY is not set — composio actions are disabled.",
    };
    return null;
  }

  try {
    const mod: unknown = await import("@composio/core");
    const m = mod as {
      Composio?: new (config?: { apiKey?: string }) => ComposioClient;
    };
    if (!m.Composio) {
      initFailed = {
        code: "SDK_NOT_INSTALLED",
        message: "@composio/core is installed but does not export `Composio`.",
      };
      return null;
    }
    cachedClient = new m.Composio({ apiKey });
    return cachedClient;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    initFailed = {
      code: "SDK_NOT_INSTALLED",
      message: `@composio/core failed to load: ${msg}. Run \`npm install @composio/core\`.`,
    };
    return null;
  }
}

/** Public accessor used by other Composio modules. */
export async function getComposio(): Promise<ComposioClient | null> {
  return getClient();
}

/**
 * Returns the last initialization failure (if any) so callers can surface
 * a real error to the UI instead of silently returning empty results.
 */
export function getComposioInitError(): { code: string; message: string } | null {
  return initFailed;
}

/**
 * Execute a single Composio action (tool) for a user. Always returns a
 * `{ ok, data?, error?, errorCode? }` envelope — never throws.
 *
 * `entityId` from the old API is the new SDK's `userId`.
 */
/**
 * Slugs hallucinés par le LLM (noms qu'il connaît de son entraînement) →
 * slugs réels du SDK Composio 0.6.x. Complété au fur et à mesure des erreurs
 * "Unable to retrieve tool with slug X" remontées en production.
 */
const SLUG_ALIASES: Record<string, string> = {
  GMAIL_GET_EMAILS: "GMAIL_FETCH_EMAILS",
  GMAIL_LIST_EMAILS: "GMAIL_FETCH_EMAILS",
  GMAIL_READ_EMAILS: "GMAIL_FETCH_EMAILS",
  GMAIL_GET_INBOX: "GMAIL_FETCH_EMAILS",
  GMAIL_LIST_MESSAGES: "GMAIL_FETCH_EMAILS",
  SLACK_GET_MESSAGES: "SLACK_LIST_MESSAGES",
  SLACK_READ_MESSAGES: "SLACK_LIST_MESSAGES",
  SLACK_FETCH_MESSAGES: "SLACK_LIST_MESSAGES",
  SLACK_GET_CHANNELS: "SLACK_LIST_CHANNELS_AND_DMS",
  SLACK_LIST_CHANNELS: "SLACK_LIST_CHANNELS_AND_DMS",
  NOTION_GET_PAGE: "NOTION_RETRIEVE_A_PAGE",
  NOTION_READ_PAGE: "NOTION_RETRIEVE_A_PAGE",
  NOTION_LIST_PAGES: "NOTION_SEARCH",
  HUBSPOT_GET_CONTACTS: "HUBSPOT_LIST_CONTACTS",
  HUBSPOT_LIST_DEALS: "HUBSPOT_GET_ALL_DEALS",
};

/**
 * Timeout strict par exécution Composio.
 *
 * P1-3 : un tool Composio lent ou hangé peut tenir un stream `/api/orchestrate`
 * > 120s. Le user voit alors un spinner infini, puis 504. On cap chaque
 * exécution individuelle à 30s pour borner la latence cumulée et permettre
 * au modèle de réagir (essayer un autre tool, demander à l'utilisateur).
 *
 * Override possible via `COMPOSIO_TOOL_TIMEOUT_MS` (rare, à éviter en prod).
 */
const COMPOSIO_TOOL_TIMEOUT_MS = parseInt(process.env.COMPOSIO_TOOL_TIMEOUT_MS ?? "30000", 10);

class ComposioTimeoutError extends Error {
  constructor(slug: string, timeoutMs: number) {
    super(`Composio action "${slug}" did not respond within ${timeoutMs}ms (provider timeout)`);
    this.name = "ComposioTimeoutError";
  }
}

export async function executeComposioAction(call: ComposioCallParams): Promise<ComposioResult> {
  const client = await getClient();
  if (!client) {
    return {
      ok: false,
      error: initFailed?.message ?? "Composio not initialized.",
      errorCode: initFailed?.code ?? "NOT_CONFIGURED",
    };
  }

  // Résolution des slugs hallucinés par le LLM → slug réel du SDK.
  const resolvedAction = SLUG_ALIASES[call.action] ?? call.action;
  if (resolvedAction !== call.action) {
    console.warn(
      `[Composio] Slug alias: ${call.action} → ${resolvedAction} (LLM hallucination corrigée)`,
    );
  }

  try {
    // P1-3 : Promise.race contre timeout. Le SDK Composio n'expose pas
    // d'AbortSignal interne (v0.6) — on coupe au niveau de la promesse, le
    // SDK continuera son fetch en arrière-plan mais on libère le flux LLM.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const data = await Promise.race<unknown>([
      client.tools.execute(resolvedAction, {
        userId: call.entityId,
        arguments: call.params,
        // SDK 0.6+ throw ComposioToolVersionRequiredError si on n'a pas pinné
        // de version par toolkit. On garde le comportement "latest" implicite
        // d'avant en bypassant le check. À durcir en pinning par toolkit
        // dans un sprint dédié si on veut éviter les régressions silencieuses
        // côté Composio.
        dangerouslySkipVersionCheck: true,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new ComposioTimeoutError(resolvedAction, COMPOSIO_TOOL_TIMEOUT_MS));
        }, COMPOSIO_TOOL_TIMEOUT_MS);
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ComposioTimeoutError) {
      console.warn(`[Composio] ${err.message}`);
      return {
        ok: false,
        error: `Le service tiers a mis trop de temps à répondre (>${Math.round(COMPOSIO_TOOL_TIMEOUT_MS / 1000)}s). Réessaie plus tard ou utilise un autre service.`,
        errorCode: "TIMEOUT",
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    const looksLikeAuth =
      /(connected.*account|not.*authoriz|missing.*connection|unauthorized|no.*active.*connection)/i.test(
        msg,
      );
    const looksLikeUnknownSlug = /unable to retrieve tool|unknown.*slug|slug.*not.*found/i.test(
      msg,
    );
    const userFacingError = looksLikeUnknownSlug
      ? `L'action "${resolvedAction}" n'est pas disponible pour ce service. Essaie une formulation différente ou consulte la liste des actions disponibles via /apps.`
      : msg;
    return {
      ok: false,
      error: userFacingError,
      errorCode: looksLikeAuth
        ? "AUTH_REQUIRED"
        : looksLikeUnknownSlug
          ? "UNKNOWN_SLUG"
          : "ACTION_FAILED",
    };
  }
}
