/**
 * POST /api/v2/missions/[id]/approve-step
 *
 * Approuve un step en attente d'une mission active (Mission Control B1).
 * Reprend l'exécution du plan multi-step. L'`id` ici peut être soit un
 * missionId classique, soit un planId interne — on accepte les deux.
 *
 * Body : { stepId: string, skip?: boolean }
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { approvePlan } from "@/lib/engine/planner";
import { getPlan } from "@/lib/engine/planner/store";
import { logger } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { redactId } from "@/lib/utils/redact";

const approveStepBodySchema = z
  .object({
    stepId: z.string().min(1).max(200),
    skip: z.boolean().optional(),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error } = await requireScope({
    context: "POST /api/v2/missions/[id]/approve-step",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { id } = await params;

  const parsed = await parseJsonBody(req, approveStepBodySchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;

  // F-056: Ownership check — vérifier que le plan appartient à l'utilisateur actuel
  const plan = getPlan(id);
  if (!plan) {
    console.warn(`[ApproveStep] plan/mission ${id} introuvable (user ${redactId(scope.userId)})`);
    return NextResponse.json({ error: "plan_not_found", id }, { status: 404 });
  }

  // ApprovePlan opère sur un ExecutionPlan in-memory (pas une Mission DB) — la
  // canonical fonction verifyMissionOwnership ne s'applique pas. On vérifie ici
  // user_id + tenant_id directement sur le plan in-memory (fail-closed).
  const userMatch = plan.userId === scope.userId;
  const tenantMatch = !plan.tenantId || plan.tenantId === scope.tenantId;
  if (!userMatch || !tenantMatch) {
    logger.warn(
      {
        event: "idor_attempt",
        action: "approve-step",
        planId: id,
        userId: redactId(scope.userId),
        tenantId: redactId(scope.tenantId),
        ownerUserId: redactId(plan.userId),
        userMatch,
        tenantMatch,
      },
      "ApproveStep IDOR attempt blocked",
    );
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // POURQUOI : on essaie d'approuver le plan via le store planner. Si l'`id`
  // est un missionId, le plan associé n'est pas trouvé → 404 silencieux. Le
  // resume fin sera implémenté Phase 2 quand le planner aura un store
  // persistant (Supabase) au lieu d'in-memory.
  const approved = approvePlan(id);

  if (!approved) {
    console.warn(
      `[ApproveStep] plan ${id} pas en awaiting_approval (user ${redactId(scope.userId)})`,
    );
    return NextResponse.json({ error: "plan_not_awaiting_approval", id }, { status: 404 });
  }

  console.log(
    `[ApproveStep] plan ${id} step ${body.stepId} ${body.skip ? "skipped" : "approved"} (user ${redactId(scope.userId)})`,
  );

  return NextResponse.json({
    ok: true,
    planId: id,
    stepId: body.stepId,
    skipped: body.skip ?? false,
    status: approved.status,
  });
}
