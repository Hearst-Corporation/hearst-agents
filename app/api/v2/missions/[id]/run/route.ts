/**
 * Mission Run Now — Manually trigger a scheduled mission.
 * Creates a real v2 run through the orchestrator with missionId linkage.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { runMissionSchema } from "@/lib/contracts/missions";
import { orchestrate } from "@/lib/engine/orchestrator";
import { getMission, updateMissionLastRun } from "@/lib/engine/runtime/missions/store";
import { getScheduledMissions, updateScheduledMission } from "@/lib/engine/runtime/state/adapter";
import { fireAndForgetIngestTurn } from "@/lib/memory/kg-ingest-pipeline";
import {
  appendMissionMessage,
  formatMissionContextBlock,
  getMissionContext,
  updateMissionContextSummary,
} from "@/lib/memory/mission-context";
import { verifyMissionOwnership } from "@/lib/missions/ownership";
import { logger } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { redactId } from "@/lib/utils/redact";
import { executeWorkflow } from "@/lib/workflows/executor";
import { executeWorkflowTool } from "@/lib/workflows/handlers";
import type { WorkflowGraph } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Resolve scope with dev fallback allowed
  const { scope, error } = await requireScope({ context: "POST /api/v2/missions/[id]/run" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  // Body optionnel : la plupart des clients POSTent sans payload, mais
  // certains sérialisent `{}` par défaut. On tolère les deux cas et on
  // refuse les bodies mal formés (clés inattendues incluses, schema strict).
  const contentLength = req.headers.get("content-length");
  if (contentLength && contentLength !== "0") {
    const parsed = await parseJsonBody(req, runMissionSchema);
    if (!parsed.ok) return parsed.response;
  }

  const { id } = await params;

  // Find mission — memory first, then persisted
  let missionInput: string | null = null;
  let missionName: string | null = null;
  let missionGraph: WorkflowGraph | undefined;
  let preloadedSummary: string | null = null;
  let preloadedSummaryUpdatedAt: number | null = null;

  const memMission = getMission(id);
  if (memMission) {
    // Verify ownership via canonical guard (fail-closed cross-tenant IDOR)
    const owns = await verifyMissionOwnership(id, scope.userId, scope.tenantId);
    if (!owns) {
      logger.warn(
        {
          event: "idor_attempt",
          action: "run",
          missionId: id,
          userId: redactId(scope.userId),
          tenantId: redactId(scope.tenantId),
        },
        "Mission run blocked — ownership mismatch",
      );
      return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
    }
    missionInput = memMission.input;
    missionName = memMission.name;
    missionGraph = memMission.workflowGraph as WorkflowGraph | undefined;
  } else {
    // Query persisted missions scoped to current user
    const persisted = await getScheduledMissions({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });
    const found = persisted.find((m) => m.id === id);
    if (found) {
      missionInput = found.input;
      missionName = found.name;
      missionGraph = found.workflowGraph;
      preloadedSummary = found.contextSummary ?? null;
      preloadedSummaryUpdatedAt = found.contextSummaryUpdatedAt ?? null;
    }
  }

  if (!missionInput) {
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  }

  console.log(
    `[MissionRunNow] Triggering "${missionName}" (${id}) for user ${redactId(scope.userId)}`,
  );

  // Branch C3 : si la mission a un workflowGraph, on exécute via le workflow
  // executor au lieu de l'orchestrator standard. Run synchrone — les events
  // sont collectés et retournés tels quels (pas de SSE pour cette MVP route).
  if (missionGraph) {
    const runId = randomUUID();
    const events: Array<unknown> = [];
    try {
      const result = await executeWorkflow(
        missionGraph,
        {
          userId: scope.userId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          runId,
          outputs: new Map(),
        },
        {
          executeTool: async (tool, args) =>
            executeWorkflowTool(tool, args, {
              userId: scope.userId,
              tenantId: scope.tenantId,
              workspaceId: scope.workspaceId,
              runId,
            }),
          emitEvent: (e) => events.push(e),
        },
        { maxNodes: 50 },
      );

      updateMissionLastRun(id, runId);
      void updateScheduledMission(id, {
        lastRunAt: Date.now(),
        lastRunId: runId,
        lastRunStatus: result.status === "completed" ? "success" : "failed",
        lastError: result.error,
      });

      return NextResponse.json({
        ok: result.status === "completed",
        missionId: id,
        runId,
        backend: "workflow",
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
      console.error(`[MissionRunNow] workflow run error for ${id}:`, err);
      void updateScheduledMission(id, {
        lastRunAt: Date.now(),
        lastRunId: runId,
        lastRunStatus: "failed",
        lastError: message,
      });
      return NextResponse.json(
        { ok: false, missionId: id, runId, backend: "workflow", error: message },
        { status: 500 },
      );
    }
  }

  // ── Mission Memory : pré-charge le contexte (vague 9) ───────
  // On préfère un fail-soft : si la table mission_messages n'existe pas
  // encore (migration pas appliquée) ou si Supabase est down, on tourne
  // sans mémoire mission plutôt que de bloquer le run.
  const missionCtx = await getMissionContext({
    missionId: id,
    userId: scope.userId,
    tenantId: scope.tenantId,
    missionInput,
    preloadedSummary,
    preloadedSummaryUpdatedAt,
  }).catch((err) => {
    logger.warn(
      {
        event: "mission_context_load_failed",
        missionId: id,
        userId: redactId(scope.userId),
        err: err instanceof Error ? err.message : String(err),
      },
      "MissionRunNow: getMissionContext failed",
    );
    return null;
  });
  const missionContextBlock = missionCtx ? formatMissionContextBlock(missionCtx) : "";

  // Trace l'intent côté mission_messages — utile pour reconstruire le fil
  // côté UI (l'utilisateur voit ce qu'il a déclenché). Fire-and-forget.
  void appendMissionMessage({
    missionId: id,
    userId: scope.userId,
    tenantId: scope.tenantId,
    role: "user",
    content: missionInput,
  });

  const db = requireServerSupabase();

  const stream = orchestrate(db, {
    userId: scope.userId,
    message: missionInput,
    missionId: id,
    missionContext: missionContextBlock || undefined,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
  });

  // Consume the stream to completion, extract run_id + assistant final text
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let runId: string | null = null;
  const textParts: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "run_started" && event.run_id) {
            runId = event.run_id;
          } else if (event.type === "text_delta" && typeof event.delta === "string") {
            // Reconstruit le finalText pour le summary post-run + persistence
            // du message assistant. Cap soft à 16k chars accumulés pour ne
            // pas saturer la mémoire si le LLM streame une longue réponse.
            if (textParts.join("").length < 16_000) {
              textParts.push(event.delta);
            }
          }
        } catch {
          /* skip */
        }
      }
    }
  } catch (err) {
    console.error(`[MissionRunNow] Stream error for mission ${id}:`, err);
  }

  if (runId) {
    updateMissionLastRun(id, runId);
    void updateScheduledMission(id, {
      lastRunAt: Date.now(),
      lastRunId: runId,
    });
  }

  // ── Mission Memory : append assistant + update summary (fire-and-forget)
  const finalText = textParts.join("").trim();
  if (finalText.length > 0) {
    void appendMissionMessage({
      missionId: id,
      userId: scope.userId,
      tenantId: scope.tenantId,
      role: "assistant",
      content: finalText,
      runId: runId ?? undefined,
    });
  }

  // Régénère le context_summary en arrière-plan. On ne bloque pas la
  // réponse HTTP — le user verra le summary actualisé au prochain
  // refresh de /context ou au prochain run.
  if (runId) {
    void updateMissionContextSummary({
      missionId: id,
      userId: scope.userId,
      tenantId: scope.tenantId,
      missionInput,
      previousSummary: preloadedSummary,
      runResult: {
        runId,
        status: "completed",
        finalText: finalText || null,
      },
    }).catch((err) => {
      logger.warn(
        {
          event: "mission_summary_update_failed",
          missionId: id,
          userId: redactId(scope.userId),
          err: err instanceof Error ? err.message : String(err),
        },
        "MissionRunNow: updateMissionContextSummary failed",
      );
    });
  }

  // KG global — fire-and-forget. Enrichit le knowledge graph user-wide avec
  // les entités/relations extraites du turn mission_input + finalText. Cf.
  // plan initial section 4 — sans ça le KG ne se nourrit pas des missions.
  if (finalText.length > 0) {
    fireAndForgetIngestTurn({
      userId: scope.userId,
      tenantId: scope.tenantId,
      userMessage: missionInput,
      assistantReply: finalText,
    });
  }

  return NextResponse.json({
    ok: true,
    missionId: id,
    runId,
  });
}
