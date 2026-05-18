/**
 * Langfuse client — LLM observability (prompts, outputs, traces).
 *
 * Comportement :
 *  - En production (`NODE_ENV === "production"`), `LANGFUSE_PUBLIC_KEY` et
 *    `LANGFUSE_SECRET_KEY` sont obligatoires. Si absentes, `getClient()` jette
 *    une erreur fatale au boot pour fail fast.
 *  - En dev/test, comportement silencieux : `getClient()` retourne `null` si
 *    les clés ne sont pas configurées.
 *
 * Usage côté Anthropic :
 *   const trace = startTrace("orchestrate", { userId, missionId });
 *   const generation = trace?.generation({ name: "claude-sonnet", model, input });
 *   // ... call Anthropic ...
 *   generation?.end({ output, usage });
 */

import { Langfuse } from "langfuse";
import { logger } from "./logger";

let _client: Langfuse | null = null;
let _bootStatusLogged = false;

function logBootStatus(status: "enabled" | "disabled" | "fatal", detail?: string) {
  if (_bootStatusLogged) return;
  _bootStatusLogged = true;
  if (status === "enabled") {
    logger.info({ detail }, "langfuse_enabled");
  } else if (status === "disabled") {
    logger.info({ detail: detail ?? "no keys" }, "langfuse_disabled");
  } else {
    logger.error({ detail: detail ?? "unknown" }, "langfuse_fatal_missing_keys");
  }
}

function getClient(): Langfuse | null {
  if (_client) return _client;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const isProd = process.env.NODE_ENV === "production";

  if (!publicKey || !secretKey) {
    if (isProd) {
      const missing = [!publicKey && "LANGFUSE_PUBLIC_KEY", !secretKey && "LANGFUSE_SECRET_KEY"]
        .filter(Boolean)
        .join(", ");
      logBootStatus("fatal", missing);
      throw new Error(
        `[langfuse] Missing required env vars in production: ${missing}. Langfuse is mandatory in prod — set the keys or call assertLangfuseReady() at boot to fail fast.`,
      );
    }
    logBootStatus("disabled", "dev, no keys");
    return null;
  }

  _client = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
  });
  // En prod comme en dev avec clés, le client est actif → statut "enabled".
  logBootStatus("enabled");
  return _client;
}

/**
 * Retourne le client Langfuse instancié (ou `null` en dev sans clés).
 * À utiliser pour des opérations bas niveau (flush, shutdown). En prod,
 * jette si les clés sont absentes.
 */
export function getLangfuseClient(): Langfuse | null {
  return getClient();
}

export function startTrace(name: string, metadata?: Record<string, unknown>) {
  const client = getClient();
  if (!client) return null;
  return client.trace({ name, metadata });
}

/** Hard-fail en production si les clés Langfuse sont absentes. No-op hors prod. */
export function assertLangfuseReady(): void {
  if (process.env.NODE_ENV !== "production") return;
  // getClient() throws en prod si clés absentes — comportement voulu
  getClient();
}

/**
 * Flush des traces Langfuse avec timeout strict.
 *
 * P1-1 : sur Vercel serverless, le process est tué dès que la response HTTP
 * est envoyée. `flushAsync()` natif peut hanger indéfiniment si le réseau
 * vers Langfuse est lent — d'où ce wrapper qui force un cap.
 *
 * Comportement :
 *  - Resolve `true` si flush terminé avant timeout
 *  - Resolve `false` si timeout dépassé (les traces non-flushées sont perdues
 *    mais le run termine proprement)
 *  - Resolve `false` si Langfuse client est null (dev sans clés)
 *  - Ne throw jamais — fail-soft pour ne pas casser le run.
 */
export async function flushLangfuse(timeoutMs = 2000): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const flushPromise = client.flushAsync().then(() => true);
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => {
        logger.warn({ timeoutMs }, "langfuse_flush_timeout");
        resolve(false);
      }, timeoutMs);
    });
    return await Promise.race([flushPromise, timeoutPromise]);
  } catch (err) {
    logger.warn({ msg: err instanceof Error ? err.message : String(err) }, "langfuse_flush_error");
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
