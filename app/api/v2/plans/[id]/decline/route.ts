/**
 * POST /api/v2/plans/[id]/decline
 *
 * Decline a plan awaiting approval (HITL decline). Miroir de la route
 * `approve`, mais N'ENCHAÎNE PAS l'exécution : un decline ARRÊTE le plan
 * (statut terminal `declined`). Pas de approveAndResume.
 */

import { type NextRequest, NextResponse } from "next/server";
import { declinePlan } from "@/lib/engine/planner/index";
import { getPlan } from "@/lib/engine/planner/store";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { redactId } from "@/lib/utils/redact";

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
    const { threadId } = body;

    // Anti-pattern banni : userId / tenantId NE viennent PAS du body. Le
    // scope a déjà été résolu via requireScope() (UUID issu de public.users
    // via NextAuth callback). Logger un warning si le client envoie ces champs
    // — signal d'un call site frontend pollué à fixer.
    if (typeof body.userId !== "undefined" || typeof body.tenantId !== "undefined") {
      log.warn(
        { bodyUserId: typeof body.userId, bodyTenantId: typeof body.tenantId },
        "plan_decline_body_contains_ids",
      );
    }

    if (!threadId) {
      return NextResponse.json({ error: "Missing required context: threadId" }, { status: 400 });
    }

    // Ownership check (fail-closed) — identique à approve-step. Le plan
    // in-memory porte user_id + tenant_id ; on vérifie avant toute mutation.
    const plan = getPlan(planId);
    if (!plan) {
      log.warn({ planId }, "plan_not_found");
      return NextResponse.json(
        { error: "Plan not found or not awaiting approval" },
        { status: 404 },
      );
    }

    const userMatch = plan.userId === scope.userId;
    const tenantMatch = !plan.tenantId || plan.tenantId === scope.tenantId;
    if (!userMatch || !tenantMatch) {
      log.warn(
        {
          event: "idor_attempt",
          action: "decline",
          planId,
          userId: redactId(scope.userId),
          tenantId: redactId(scope.tenantId),
          ownerUserId: redactId(plan.userId),
          userMatch,
          tenantMatch,
        },
        "plan_decline_idor_blocked",
      );
      // Sécurité : 404 uniforme (pas 403) — n'expose pas l'existence d'un plan
      // appartenant à un autre user. Le log audit ci-dessus reste intact.
      return NextResponse.json(
        { error: "Plan not found or not awaiting approval" },
        { status: 404 },
      );
    }

    // Decline : marque le gate skipped + statut terminal `declined`. N'enchaîne
    // PAS d'exécution. Retourne null si le plan n'est plus en awaiting_approval.
    const declinedPlan = declinePlan(planId);
    if (!declinedPlan) {
      log.warn({ planId }, "plan_not_awaiting_approval");
      return NextResponse.json(
        { error: "Plan not found or not awaiting approval" },
        { status: 404 },
      );
    }

    log.info({ planId, planType: declinedPlan.type }, "plan_declined");

    return NextResponse.json({
      success: true,
      planId: declinedPlan.id,
      planStatus: declinedPlan.status,
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
