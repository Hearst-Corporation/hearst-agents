/**
 * Debug endpoint temporaire F1a.1 — trace ce que resolveScope voit côté prod
 * quand on envoie un Bearer hsk_*.
 *
 * À RETIRER une fois F1a.1 validé en prod end-to-end.
 *
 * Réponse JSON (NE PAS exposer la clé en clair) :
 *   {
 *     hasAuthHeader, authHeaderStartsWithBearer, rawKeyStartsWithHskPrefix,
 *     rawKeyLength, keyHashFirst8, verifyApiKeyResult: { found, hasUserId, tenantIdPrefix },
 *     resolveScopeResult: { ok, userId?, tenantId? }
 *   }
 *
 * Pas de Bearer auth requise — endpoint volontairement public mais aucun
 * payload utile divulgué (que des prefixes/booléens).
 */

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { API_KEY_PREFIX, verifyApiKey } from "@/lib/platform/auth/api-key";
import { resolveScope } from "@/lib/platform/auth/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, unknown> = {
    nodeEnv: process.env.NODE_ENV,
    nextRuntime: process.env.NEXT_RUNTIME ?? "(undefined)",
  };

  // 1. headers()
  let authHeader: string | null = null;
  try {
    const hl = await headers();
    result.headersOk = true;
    authHeader = hl.get("authorization");
    result.hasAuthHeader = authHeader !== null;
    result.authHeaderStartsWithBearer = authHeader?.startsWith("Bearer ") ?? false;
  } catch (err) {
    result.headersOk = false;
    result.headersError = err instanceof Error ? err.message : String(err);
  }

  // 2. Parse key
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawKey = authHeader.substring(7).trim();
    result.rawKeyStartsWithHskPrefix = rawKey.startsWith(API_KEY_PREFIX);
    result.rawKeyLength = rawKey.length;
    if (rawKey.startsWith(API_KEY_PREFIX)) {
      const keyHash = createHash("sha256").update(rawKey, "utf8").digest("hex");
      result.keyHashFirst8 = keyHash.substring(0, 8);

      // 3. verifyApiKey
      try {
        const verified = await verifyApiKey(rawKey);
        result.verifyApiKey = {
          found: verified !== null,
          hasUserId: verified?.userId ? true : false,
          tenantIdPrefix: verified?.tenantId?.substring(0, 8),
          scopes: verified?.scopes,
        };
      } catch (err) {
        result.verifyApiKeyError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // 4. resolveScope (full path)
  try {
    const scope = await resolveScope({ context: "_debug/scope-bearer" });
    result.resolveScope = {
      ok: scope !== null,
      userIdPrefix: scope?.userId?.substring(0, 8),
      tenantIdPrefix: scope?.tenantId?.substring(0, 8),
      isDevFallback: scope?.isDevFallback,
    };
  } catch (err) {
    result.resolveScopeError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(result);
}
