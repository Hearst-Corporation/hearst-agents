/**
 * POST /api/orchestrate/abort/[runId] — Coupe un run en cours côté serveur.
 *
 * Avant cette route, l'AbortController côté client coupait juste la connexion
 * SSE locale ; le pipeline serveur continuait à tourner et à payer le LLM
 * jusqu'à completion ou maxDuration (300s). Maintenant, le client peut
 * vraiment kill : l'orchestrator enregistre son AbortController dans le
 * registry sous `engine.id`, ce POST l'abort, le pipeline propage vers
 * `streamText({ abortSignal })` qui termine la stream Anthropic.
 *
 * Idempotent : 200 même si le run n'est pas (plus) trouvé — un client qui
 * abort un run déjà fini ne reçoit pas d'erreur trompeuse.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { abortRun } from "@/lib/engine/orchestrator/abort-registry";
import { getRunById } from "@/lib/engine/runtime/runs/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  const { scope, error } = await requireScope({ context: "POST /api/orchestrate/abort" });
  if (error || !scope) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  const { runId } = await context.params;
  if (!runId || typeof runId !== "string") {
    return NextResponse.json({ ok: false, error: "runId_required" }, { status: 400 });
  }

  // Ownership check : un user ne peut abort que ses propres runs (F-004)
  // Si le run est inconnu du store in-memory (cross-instance) on laisse passer —
  // l'idempotence est maintenue, worst case le run est déjà terminé.
  const run = getRunById(runId);
  if (run && run.userId !== scope.userId) {
    // 200 + aborted:false — idempotent, pas d'info disclosure sur l'existence du run
    return NextResponse.json({ ok: true, aborted: false });
  }

  const aborted = abortRun(runId);
  return NextResponse.json({ ok: true, aborted });
}
