import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";

export interface SafeErrorContext {
  route: string;
  scope?: { tenantId?: string; userId?: string };
}

/**
 * Retourne une réponse d'erreur user-safe :
 * - Message générique en prod (jamais de stack ni détail interne)
 * - Message complet en dev pour debug
 * - Toujours un `request_id` pour corrélation avec les logs Sentry/Langfuse
 * - Header `X-Request-Id` pour corrélation rapide DevTools/Sentry
 *
 * Toujours logger le détail complet via `logger.error` (PII redacted via Pino redact paths).
 */
export function safeErrorResponse(
  cause: unknown,
  ctx: SafeErrorContext,
  status: number = 500,
): NextResponse {
  const requestId = randomUUID();

  // Fallback cause.message : supporte les objets non-Error avec .message
  // (ex : Supabase brut { message, code, details })
  const messageRaw =
    cause instanceof Error
      ? cause.message
      : typeof cause === "object" && cause !== null && "message" in cause
        ? String((cause as { message: unknown }).message)
        : String(cause);

  const stack = cause instanceof Error ? cause.stack : undefined;

  logger.error(
    {
      request_id: requestId,
      route: ctx.route,
      tenant_id: ctx.scope?.tenantId,
      user_id: ctx.scope?.userId,
      err_message: messageRaw,
      err_stack: stack,
    },
    `[${ctx.route}] unhandled exception`,
  );

  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.json(
    {
      error: "internal_server_error",
      message: isProd ? "Une erreur interne est survenue. Réessayez plus tard." : messageRaw,
      request_id: requestId,
    },
    { status },
  );
  res.headers.set("X-Request-Id", requestId);
  return res;
}
