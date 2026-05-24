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
 *
 * Toujours logger le détail complet via `logger.error` (PII redacted via Pino redact paths).
 */
export function safeErrorResponse(
  cause: unknown,
  ctx: SafeErrorContext,
  status: number = 500,
): NextResponse {
  const requestId = randomUUID();
  const message = cause instanceof Error ? cause.message : String(cause);
  const stack = cause instanceof Error ? cause.stack : undefined;

  logger.error(
    {
      request_id: requestId,
      route: ctx.route,
      tenant_id: ctx.scope?.tenantId,
      user_id: ctx.scope?.userId,
      err_message: message,
      err_stack: stack,
    },
    `[${ctx.route}] unhandled exception`,
  );

  const isProd = process.env.NODE_ENV === "production";
  return NextResponse.json(
    {
      error: "internal_server_error",
      message: isProd ? "Une erreur interne est survenue. Réessayez plus tard." : message,
      request_id: requestId,
    },
    { status },
  );
}
