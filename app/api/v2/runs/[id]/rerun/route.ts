/**
 * POST /api/v2/runs/[id]/rerun — Relance réelle d'un run via l'orchestrateur v2.
 *
 * Résout le run source (mémoire → Supabase), vérifie l'ownership, appelle
 * orchestrate() et dreine le stream pour extraire le runId réel émis par
 * l'event SSE `run_started`. Retourne { ok, queuedRunId, sourceRunId, requestedBy }.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orchestrate } from "@/lib/engine/orchestrator";
import { getRunById } from "@/lib/engine/runtime/runs/store";
import { getRunById as getPersistedRun } from "@/lib/engine/runtime/state/adapter";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ParamsSchema = z.object({ id: z.string().min(1, "id_required") });

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error } = await requireScope({ context: "POST /api/v2/runs/[id]/rerun" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const raw = await params;
  const parsed = ParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_params", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const id = parsed.data.id;

  // Résolution run source : mémoire en priorité, Supabase en fallback
  const memRun = getRunById(id);
  const persisted = memRun ? null : await getPersistedRun(id);
  const run = memRun ?? persisted;

  if (!run) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }

  // Ownership check
  if (run.userId && run.userId !== scope.userId) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }

  // Refus si déjà en cours
  if (run.status === "running") {
    return NextResponse.json({ error: "run_already_running" }, { status: 409 });
  }

  // Lancement orchestrateur
  const db = requireServerSupabase();
  const stream = orchestrate(db, {
    userId: scope.userId,
    message: run.input,
    surface: run.surface,
    missionId: run.missionId,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
  });

  // Drain du stream pour extraire le runId réel depuis l'event run_started
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let queuedRunId: string | null = null;

  try {
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "run_started" && event.run_id) {
            queuedRunId = event.run_id as string;
            break outer;
          }
        } catch {
          /* ignorer lignes malformées */
        }
      }
    }
  } catch (err) {
    console.error(`[rerun] Stream error for source run ${id}:`, err);
  } finally {
    void reader.cancel();
  }

  if (!queuedRunId) {
    return NextResponse.json({ error: "rerun_enqueue_failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    queuedRunId,
    sourceRunId: id,
    requestedBy: scope.userId,
  });
}
