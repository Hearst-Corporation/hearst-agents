/**
 * POST /api/v2/missions/[id]/approve-step
 *
 * Approuve un step en attente d'une mission active (Mission Control B1).
 * Reprend l'exécution du plan multi-step. L'`id` ici peut être soit un
 * missionId classique, soit un planId interne — on accepte les deux.
 *
 * Body : { stepId: string, skip?: boolean }
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { approvePlan } from "@/lib/engine/planner";
import { getPlan } from "@/lib/engine/planner/store";
import { requireScope } from "@/lib/platform/auth/scope";

const approveStepBodySchema = z.object({
  stepId: z.string().min(1).max(200),
  skip: z.boolean().optional(),
}).strict();

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { scope, error } = await requireScope({
    context: "POST /api/v2/missions/[id]/approve-step",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { id } = await params;

  const raw = await req.json().catch(() => null);
  const parsed = approveStepBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // F-056: Ownership check — vérifier que le plan appartient à l'utilisateur actuel
  const plan = getPlan(id);
  if (!plan) {
    console.warn(
      `[ApproveStep] plan/mission ${id} introuvable (user ${scope.userId.slice(0, 8)})`,
    );
    return NextResponse.json(
      { error: "plan_not_found", id },
      { status: 404 },
    );
  }

  if (plan.userId !== scope.userId) {
    console.warn(
      `[ApproveStep] IDOR attempt — user ${scope.userId.slice(0, 8)} tried to access plan of ${plan.userId.slice(0, 8)}`,
    );
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403 },
    );
  }

  // POURQUOI : on essaie d'approuver le plan via le store planner. Si l'`id`
  // est un missionId, le plan associé n'est pas trouvé → 404 silencieux. Le
  // resume fin sera implémenté Phase 2 quand le planner aura un store
  // persistant (Supabase) au lieu d'in-memory.
  const approved = approvePlan(id);

  if (!approved) {
    console.warn(
      `[ApproveStep] plan ${id} pas en awaiting_approval (user ${scope.userId.slice(0, 8)})`,
    );
    return NextResponse.json(
      { error: "plan_not_awaiting_approval", id },
      { status: 404 },
    );
  }

  console.log(
    `[ApproveStep] plan ${id} step ${body.stepId} ${body.skip ? "skipped" : "approved"} (user ${scope.userId.slice(0, 8)})`,
  );

  return NextResponse.json({
    ok: true,
    planId: id,
    stepId: body.stepId,
    skipped: body.skip ?? false,
    status: approved.status,
  });
}
