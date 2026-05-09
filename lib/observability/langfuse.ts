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

let _client: Langfuse | null = null;
let _bootStatusLogged = false;

function logBootStatus(status: "enabled" | "disabled" | "fatal", detail?: string) {
  if (_bootStatusLogged) return;
  _bootStatusLogged = true;
  if (status === "enabled") {
    console.log("[langfuse] enabled (prod)");
  } else if (status === "disabled") {
    console.log(`[langfuse] disabled (${detail ?? "no keys"})`);
  } else {
    console.error(`[langfuse] FATAL: missing keys in production (${detail ?? "unknown"})`);
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
  if (isProd) {
    logBootStatus("enabled");
  } else {
    logBootStatus("disabled", "dev with keys — traces enabled");
  }
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

/**
 * Vérifie au boot que Langfuse est correctement configuré en production.
 * À appeler depuis `instrumentation.ts` (Next.js `register()`) pour fail fast
 * si les clés sont absentes en prod. No-op en dev/test.
 *
 * NOTE : cette fonction n'est pas auto-invoquée. L'utilisateur doit l'ajouter
 * manuellement dans `instrumentation.ts` (laissé volontairement hors de ce
 * patch pour respecter le scope ADD).
 */
export function assertLangfuseReady(): void {
  if (process.env.NODE_ENV !== "production") return;
  // getClient() throws en prod si clés absentes — comportement voulu
  getClient();
}
