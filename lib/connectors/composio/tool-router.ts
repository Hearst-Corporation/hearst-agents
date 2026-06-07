/**
 * Composio Tool Router — MCP groundwork (SCÉNARIO B)
 *
 * Pourquoi SCÉNARIO B et non A :
 *   Le SDK `ai` (Vercel AI SDK v6, pas de client MCP exporté) n'expose PAS de client MCP natif.
 *   Les 129 exports de `ai` ne contiennent aucun symbol `mcp*` ni
 *   `experimental_createMCPClient`. Consommer les tools MCP Composio via
 *   streamText({ tools }) nécessite donc un bridge externe ou un upgrade du SDK.
 *
 * Ce fichier pose le groundwork :
 *   1. `resolveToolRouterSession(userId)` — crée/cache une session Tool Router
 *      Composio par userId, retourne { sessionId, mcpUrl, headers } ou null.
 *   2. Le chemin ON (`HELM_COMPOSIO_TOOL_ROUTER=1`) logue la résolution de session
 *      et retombe sur le chemin normal (fail-soft complet, zéro rupture).
 *   3. Le chemin OFF (défaut) = no-op absolu : cette fonction n'est JAMAIS appelée.
 *
 * Ce qui est différé :
 *   La consommation effective des tools MCP (passage de `mcp.url` + headers à un
 *   client MCP qui génère les schémas à la demande) nécessite soit :
 *     a) Un upgrade du SDK `ai` vers une version exposant `experimental_createMCPClient`
 *        (annoncé dans le roadmap Vercel AI SDK), ou
 *     b) Un bridge maison (fetch JSON-RPC over SSE/HTTP vers `mcpUrl`) qui retourne
 *        des tools compatibles avec le type `Tool<…>` du SDK `ai`.
 *   Quand ce bridge est prêt : remplacer le `console.info` ci-dessous par l'appel
 *   au bridge, et retourner les tools à la place de `null`.
 *
 * Garantie flag OFF :
 *   `resolveToolRouterSession` n'est jamais importée ni appelée quand le flag est
 *   absent. Le bloc dans ai-pipeline.ts est intégralement sous
 *   `if (process.env.HELM_COMPOSIO_TOOL_ROUTER === "1")`.
 */

import { getComposio } from "./client";

/** Session résolue par userId. */
export interface ToolRouterSession {
  sessionId: string;
  mcpUrl: string;
  headers: Record<string, string>;
}

/** Cache process-local : Map<userId, { session, expiresAt }>. */
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
interface CacheEntry {
  session: ToolRouterSession;
  expiresAt: number;
}
const sessionCache = new Map<string, CacheEntry>();

/**
 * Résout (et cache) une session Tool Router Composio pour `userId`.
 *
 * - Retourne la session cachée si elle est encore valide (TTL 10 min).
 * - Sinon appelle `composio.create(userId)` et met en cache.
 * - Fail-soft : toute erreur retourne `null` — le caller retombe sur le
 *   chemin normal (injection des 40 schémas Composio).
 *
 * @returns `ToolRouterSession | null` — null signifie "fallback chemin normal".
 */
export async function resolveToolRouterSession(userId: string): Promise<ToolRouterSession | null> {
  // Vérif cache
  const cached = sessionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }

  const composio = await getComposio();
  if (!composio) {
    // Composio non configuré (pas de clé API) → fail-soft
    return null;
  }

  try {
    const result = await composio.create(userId);

    const mcpUrl = result.mcp?.url ?? result.url;
    if (!mcpUrl) {
      console.warn(
        `[ToolRouter] composio.create(${userId}) succeeded but returned no mcp.url — ` +
          `falling back to normal tool injection.`,
      );
      return null;
    }

    const headers = result.mcp?.headers ?? {};
    const session: ToolRouterSession = {
      sessionId: result.sessionId,
      mcpUrl,
      headers,
    };

    sessionCache.set(userId, { session, expiresAt: Date.now() + SESSION_TTL_MS });
    return session;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ToolRouter] composio.create(${userId}) failed: ${msg} — ` +
        `falling back to normal tool injection.`,
    );
    return null;
  }
}

/**
 * Vide le cache session (utilitaire test + hot-reload).
 */
export function resetToolRouterCache(): void {
  sessionCache.clear();
}
