/**
 * POST /api/v2/plans/[id]/approve
 *
 * Approve a plan awaiting approval and resume execution.
 * Returns the updated focal object after execution.
 */

import { type NextRequest, NextResponse } from "next/server";
import { approvePlan } from "@/lib/engine/planner/index";
import { approveAndResume, type PipelineContext } from "@/lib/engine/planner/pipeline";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";

const log = withRoute("POST /api/v2/plans/[id]/approve");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { scope, error: authError } = await requireScope({ context: "POST /api/v2/plans/approve" });
  if (authError)
    return NextResponse.json({ error: authError.message }, { status: authError.status });

  const planId = (await params).id;

  try {
    const body = await request.json().catch(() => ({}));
    const { threadId, connectedProviders = [], forcedProviderId } = body;

    // Anti-pattern banni : userId / tenantId NE viennent PAS du body. Le
    // scope a déjà été résolu via requireScope() ligne 17 (UUID issu de
    // public.users via NextAuth callback). Logger un warning si le client
    // envoie ces champs — signal d'un call site frontend pollué à fixer.
    if (typeof body.userId !== "undefined" || typeof body.tenantId !== "undefined") {
      log.warn(
        { bodyUserId: typeof body.userId, bodyTenantId: typeof body.tenantId },
        "plan_approve_body_contains_ids",
      );
    }

    const userId = scope.userId;
    const tenantId = scope.tenantId;

    if (!threadId) {
      return NextResponse.json({ error: "Missing required context: threadId" }, { status: 400 });
    }

    // First, approve the plan
    const approvedPlan = approvePlan(planId);
    if (!approvedPlan) {
      log.warn({ planId }, "plan_not_found_or_not_awaiting_approval");
      return NextResponse.json(
        { error: "Plan not found or not awaiting approval" },
        { status: 404 },
      );
    }

    log.info({ planId, planType: approvedPlan.type }, "plan_approved");

    // Build pipeline context
    const ctx: PipelineContext = {
      userId,
      tenantId,
      threadId,
      connectedProviders,
      forcedProviderId,
    };

    // Resume execution with the approved plan
    const result = await approveAndResume(planId, ctx, (event, data) => {
      log.info({ planId, event, data }, "plan_pipeline_event");
    });

    // Return the focal object produced by execution
    return NextResponse.json({
      success: true,
      planId: result.plan.id,
      planStatus: result.plan.status,
      focalObject: result.focalObject,
      assets: result.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
      })),
    });
  } catch (error) {
    log.error({ err: redactedError(error), planId }, "plan_approve_failed");
    return NextResponse.json(
      {
        error: "Failed to approve plan",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
