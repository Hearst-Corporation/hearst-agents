import { NextResponse } from "next/server";
import { getRunById, removeRun } from "@/lib/engine/runtime/runs/store";
import { deleteRun, getRunById as getPersistedRun } from "@/lib/engine/runtime/state/adapter";
import { normalizeRunEventsToTimeline } from "@/lib/engine/runtime/timeline/normalize";
import { getPersistedRunEvents } from "@/lib/engine/runtime/timeline/persist";
import { withScope } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";

import type { RunEvent } from "@/lib/events/types";

function serializeRun(
  r: {
    id: string;
    userId?: string;
    input: string;
    surface?: string;
    executionMode?: string;
    agentId?: string;
    backend?: string;
    missionId?: string;
    status: string;
    createdAt: number;
    completedAt?: number;
    assets: Array<{ id: string; name: string; type: string }>;
  },
  events: RunEvent[],
) {
  return {
    id: r.id,
    userId: r.userId,
    input: r.input,
    surface: r.surface,
    executionMode: r.executionMode,
    agentId: r.agentId,
    backend: r.backend,
    missionId: r.missionId,
    status: r.status,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
    assets: r.assets,
    events,
  };
}

export const GET = withScope<{ id: string }>(
  "GET /api/v2/runs/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;

    try {
      // In-memory run has live events — best for active/recent runs
      const memRun = getRunById(id);
      if (memRun && memRun.events.length > 0) {
        // Verify ownership
        if (memRun.userId && memRun.userId !== scope.userId) {
          console.warn(`[v2/runs/${id}] Access denied — user mismatch (mem)`);
          return NextResponse.json({ error: "run_not_found" }, { status: 404 });
        }

        return NextResponse.json({
          run: serializeRun(memRun, memRun.events),
          timeline: normalizeRunEventsToTimeline({
            runId: id,
            events: memRun.events,
          }),
          timelineSource: "memory" as const,
        });
      }

      // Fall back to persisted run + persisted timeline events
      const persisted = memRun ? null : await getPersistedRun(id);
      const run = memRun ?? persisted;
      if (!run) {
        return NextResponse.json({ error: "run_not_found" }, { status: 404 });
      }

      // Verify ownership for persisted runs
      if (run.userId && run.userId !== scope.userId) {
        console.warn(`[v2/runs/${id}] Access denied — user mismatch (db)`);
        return NextResponse.json({ error: "run_not_found" }, { status: 404 });
      }

      const persistedEvents = await getPersistedRunEvents({ runId: id });
      const timeline =
        persistedEvents.length > 0
          ? normalizeRunEventsToTimeline({
              runId: id,
              events: persistedEvents.map((e) => e.payload),
            })
          : [];

      const events = persistedEvents.map((e) => e.payload as RunEvent);

      return NextResponse.json({
        run: serializeRun(run, events),
        timeline,
        timelineSource: persistedEvents.length > 0 ? "persistent" : "empty",
      });
    } catch (e) {
      console.error(`GET /api/v2/runs/${id}: uncaught`, e);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);

/**
 * DELETE /api/v2/runs/[id] — Supprime réellement le run en Supabase (cascade
 * complète : run_steps, run_logs, run_approvals, plans, action_plans,
 * action_executions) ET de la Map mémoire. Idempotent : run déjà absent → 200.
 *
 * Double-lock ownership : filtre user_id au niveau SQL (défense en profondeur).
 */
export const DELETE = withScope<{ id: string }>(
  "DELETE /api/v2/runs/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }

    try {
      const memRun = getRunById(id);
      const persisted = memRun ? null : await getPersistedRun(id);
      const run = memRun ?? persisted;

      if (!run) {
        // Idempotence : déjà absent → 200, l'UI peut nettoyer son cache local.
        return NextResponse.json({ ok: true, deleted: false, runId: id });
      }

      if (run.userId && run.userId !== scope.userId) {
        return NextResponse.json({ error: "run_not_found" }, { status: 404 });
      }

      // Suppression Supabase (hard-delete avec cascade)
      const result = await deleteRun(id, scope.userId);
      if (!result.ok) {
        return NextResponse.json({ error: "delete_failed", detail: result.error }, { status: 500 });
      }

      // Suppression mémoire best-effort (no-op si absent)
      removeRun(id);

      return NextResponse.json({ ok: true, deleted: result.deleted, runId: id });
    } catch (e) {
      console.error(`DELETE /api/v2/runs/${id}: uncaught`, e);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);
