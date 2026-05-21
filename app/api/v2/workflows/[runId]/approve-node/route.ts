/**
 * POST /api/v2/workflows/[runId]/approve-node
 *
 * Approuve un node "approval" d'un workflow run en pause sur `awaiting_approval`.
 *
 * Body : { nodeId: string, decision: "approve" | "skip" | "edit", editPayload?: unknown }
 *
 * MVP — limitation connue :
 *   Le state du workflow run (graph + outputs accumulés) n'est PAS persisté
 *   à l'awaiting_approval. L'executor (lib/workflows/executor.ts) émet
 *   `awaiting_approval` puis retourne immédiatement avec
 *   status === "awaiting_approval". À ce stade, le caller doit relancer
 *   `executeWorkflow` avec un `context.outputs` pré-peuplé pour reprendre.
 *
 *   Cette route accepte donc l'approval (logging + audit), mais NE relance
 *   PAS le workflow automatiquement : le client UI doit afficher un
 *   disclaimer ("L'approval est tracée — relance manuelle requise pour
 *   continuer le workflow") et fournir un bouton "Relancer" qui POST sur
 *   l'endpoint de run avec le graph original.
 *
 *   Une persistance Supabase (table `workflow_runs` avec colonne
 *   `awaiting_state JSONB`) sera ajoutée au prochain palier pour permettre
 *   une reprise transparente (voir /lib/workflows/executor.ts).
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { redactId } from "@/lib/utils/redact";

export const dynamic = "force-dynamic";

const approveNodeBodySchema = z
  .object({
    nodeId: z.string().min(1).max(200),
    decision: z.enum(["approve", "skip", "edit"]),
    editPayload: z.unknown().optional(),
  })
  .strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { scope, error } = await requireScope({
    context: "POST /api/v2/workflows/[runId]/approve-node",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { runId } = await params;

  const parsed = await parseJsonBody(req, approveNodeBodySchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;

  // MVP : log audit-only. Aucun resume automatique tant que la persistance
  // du workflow state n'est pas livrée. Voir docstring du fichier.
  logger.info(
    { runId, nodeId: body.nodeId, decision: body.decision, userId: redactId(scope.userId) },
    "[ApproveNode] approval recorded",
  );

  return NextResponse.json({
    ok: true,
    runId,
    nodeId: body.nodeId,
    decision: body.decision,
    resumed: false,
    message:
      "Approval enregistrée. La reprise automatique du workflow est désactivée tant que la persistance d'état n'est pas livrée — relancer manuellement le workflow pour continuer.",
  });
}
