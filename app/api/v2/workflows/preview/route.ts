/**
 * Workflow Preview — dry-run d'un graphe.
 *
 * Reçoit un graphe en POST, l'exécute en mode preview (pas d'effet de bord
 * réel sur les tools), retourne la liste des events SSE-like collectés.
 *
 * Pour le streaming live le client peut consommer la route `/api/runs/:id/stream`
 * existante après avoir démarré un mission run avec workflowGraph. Cette
 * route preview est volontairement synchrone pour rester simple.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { executeWorkflow } from "@/lib/workflows/executor";
import type {
  WorkflowExecutionContext,
  WorkflowExecutorEvent,
  WorkflowGraph,
} from "@/lib/workflows/types";
import { validateGraph } from "@/lib/workflows/validate";

const workflowNodeSchema = z.object({
  id: z.string().max(200),
  kind: z.enum(["trigger", "tool_call", "condition", "approval", "output", "transform"]),
  label: z.string().max(500),
  config: z.record(z.string(), z.unknown()),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  onError: z.enum(["abort", "skip", "retry"]).optional(),
});

const workflowEdgeSchema = z.object({
  id: z.string().max(200),
  source: z.string().max(200),
  target: z.string().max(200),
  condition: z.string().max(500).optional(),
});

const workflowPreviewBodySchema = z.object({
  graph: z.object({
    nodes: z.array(workflowNodeSchema).max(50),
    edges: z.array(workflowEdgeSchema).max(200),
    startNodeId: z.string().max(200),
    version: z.number().int().optional(),
  }),
});

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({
    context: "POST /api/v2/workflows/preview",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const parsed = await parseJsonBody(req, workflowPreviewBodySchema);
  if (!parsed.ok) return parsed.response;

  const body: { graph: WorkflowGraph } = parsed.data;
  const validation = validateGraph(body.graph);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "invalid_graph", details: validation.errors },
      { status: 400 },
    );
  }

  const events: WorkflowExecutorEvent[] = [];
  const context: WorkflowExecutionContext = {
    userId: scope.userId,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    runId: `preview_${Date.now()}`,
    preview: true,
    outputs: new Map(),
  };

  try {
    const result = await executeWorkflow(
      body.graph,
      context,
      {
        executeTool: async (tool, args) => ({
          success: true,
          output: { preview: true, tool, args },
        }),
        emitEvent: (e) => events.push(e),
      },
      { maxNodes: 50 },
    );

    return NextResponse.json({
      ok: true,
      result: {
        status: result.status,
        visitedCount: result.visitedCount,
        outputs: result.outputs,
        awaitingNodeId: result.awaitingNodeId,
        error: result.error,
      },
      events,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WorkflowsPreview] uncaught", err);
    return NextResponse.json({ error: "preview_failed", message }, { status: 500 });
  }
}
