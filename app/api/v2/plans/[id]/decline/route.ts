/**
 * POST /api/v2/plans/[id]/decline
 *
 * Decline a plan awaiting approval.
 * Maps the plan to status "failed" (terminal) — no execution is resumed.
 */

import { type NextRequest, NextResponse } from "next/server";
import { declinePlan } from "@/lib/engine/planner/index";
import { getPlan } from "@/lib/engine/planner/store";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";

const log = withRoute("POST /api/v2/plans/[id]/decline");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { scope, error: authError } = await requireScope({ context: "POST /api/v2/plans/decline" });
  if (authError)
    return NextResponse.json({ error: authError.message }, { status: authError.status });

  const planId = (await params).id;

  try {
    const body = await request.json().catch(() => ({}));

    // Anti-pattern banni : userId / tenantId NE viennent PAS du body. Le
    // scope a déjà été résolu via requireScope() (UUID issu de
    // public.users via NextAuth callback). Logger un warning si le client
    // envoie ces champs — signal d'un call site frontend pollué à fixer.
    if (typeof body.userId !== "undefined" || typeof body.tenantId !== "undefined") {
      log.warn(
        { bodyUserId: typeof body.userId, bodyTenantId: typeof body.tenantId },
        "plan_decline_body_contains_ids",
      );
    }

    const userId = scope.userId;
    const tenantId = scope.tenantId;

    // IDOR guard : vérifier l'ownership AVANT de décliner. requireScope
    // authentifie mais N'autorise PAS — sans ce check, n'importe quel user
    // authentifié décline le plan d'un autre par son id.
    const existingPlan = getPlan(planId);
    if (!existingPlan) {
      log.warn({ planId }, "plan_not_found_or_not_awaiting_approval");
      return NextResponse.json(
        { error: "Plan not found or not awaiting approval" },
        { status: 404 },
      );
    }
    const userMatch = existingPlan.userId === userId;
    const tenantMatch = !existingPlan.tenantId || existingPlan.tenantId === tenantId;
    if (!userMatch || !tenantMatch) {
      log.warn(
        { event: "idor_attempt", action: "plan-decline", planId, userMatch, tenantMatch },
        "plan_decline_idor_blocked",
      );
      // 404 uniforme (ne révèle pas l'existence d'un plan appartenant à un autre user).
      return NextResponse.json(
        { error: "Plan not found or not awaiting approval" },
        { status: 404 },
      );
    }

    // Ownership OK → decline the plan
    const declined = declinePlan(planId);
    if (!declined) {
      log.warn({ planId }, "plan_not_found_or_not_awaiting_approval");
      return NextResponse.json(
        { error: "Plan not found or not awaiting approval" },
        { status: 404 },
      );
    }

    log.info({ planId }, "plan_declined");

    return NextResponse.json({
      success: true,
      planId: declined.id,
      planStatus: declined.status,
    });
  } catch (error) {
    log.error({ err: redactedError(error), planId }, "plan_decline_failed");
    return NextResponse.json(
      {
        error: "Failed to decline plan",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
