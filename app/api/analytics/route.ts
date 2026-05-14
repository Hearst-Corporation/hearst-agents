/**
 * Analytics API — Log product events.
 *
 * POST /api/analytics — Log a structured event.
 *
 * Sécurité : la route exige une session authentifiée et utilise
 * scope.userId (UUID) comme identifiant. Le frontend ne doit PAS envoyer
 * `userId` dans le body — le backend le résout. Si reçu, log un warning
 * pour détecter les call sites pollués.
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { logAnalyticsEvent } from "@/lib/analytics/events";
import { requireScope } from "@/lib/platform/auth/scope";
import { withRoute, redactedError } from "@/lib/observability/logger";

const log = withRoute("POST /api/analytics");

const analyticsBodySchema = z.object({
  type: z.enum(["login_success", "first_message_sent", "run_completed", "run_failed"]),
  // userId ignoré volontairement — résolu depuis scope.userId côté serveur
  userId: z.unknown().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
}).strict();

export async function POST(req: Request) {
  const { scope, error: scopeError } = await requireScope({ context: "POST /api/analytics" });
  if (scopeError || !scope) {
    return NextResponse.json({ error: scopeError?.message ?? "not_authenticated" }, { status: scopeError?.status ?? 401 });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = analyticsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { type, userId: bodyUserId, properties } = parsed.data;

    if (typeof bodyUserId !== "undefined") {
      log.warn(
        { bodyUserIdType: typeof bodyUserId },
        "body_userid_ignored",
      );
    }

    logAnalyticsEvent(type, scope.userId, properties);

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err: redactedError(err) }, "log_event_failed");
    return NextResponse.json(
      { error: "Failed to log event" },
      { status: 500 }
    );
  }
}
