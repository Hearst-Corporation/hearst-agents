/**
 * GET /api/v2/runs/[id]/export — Exporte le run sous le format trace versionné
 * `hearst.run-trace/v1`. Déclenche un téléchargement côté navigateur via
 * Content-Disposition attachment (RFC 6266).
 *
 * Format trace v1 :
 *   { schema, exportedAt, run, spans, raw: { events, timeline } }
 *
 * Les spans sont les events ordonnés chronologiquement, mappés en
 * { ts, type, label, data }.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRunById } from "@/lib/engine/runtime/runs/store";
import { getRunById as getPersistedRun } from "@/lib/engine/runtime/state/adapter";
import { normalizeRunEventsToTimeline } from "@/lib/engine/runtime/timeline/normalize";
import { getPersistedRunEvents } from "@/lib/engine/runtime/timeline/persist";
import type { RunEvent } from "@/lib/events/types";
import { requireScope } from "@/lib/platform/auth/scope";

/* F-055: Safe Content-Disposition header */
function safeFilename(name: string): string {
  return String(name)
    .replace(/[\r\n"\\]/g, "_")
    .slice(0, 200);
}

/** Extrait un timestamp stable depuis un event (ms epoch ou ISO string) */
function eventTs(event: RunEvent): number {
  // Les events peuvent porter ts (number) ou timestamp (string/number)
  const e = event as unknown as Record<string, unknown>;
  if (typeof e.ts === "number") return e.ts;
  if (typeof e.timestamp === "number") return e.timestamp;
  if (typeof e.timestamp === "string") {
    const parsed = Date.parse(e.timestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Mappe un RunEvent en span trace v1 */
function toSpan(event: RunEvent): { ts: number; type: string; label: string; data: unknown } {
  const e = event as unknown as Record<string, unknown>;
  const ts = eventTs(event);
  const type = (typeof e.type === "string" ? e.type : "unknown") as string;

  // Label lisible : name > label > type
  const label =
    (typeof e.name === "string" ? e.name : null) ??
    (typeof e.label === "string" ? e.label : null) ??
    type;

  // data = tout sauf les champs déjà représentés
  const { type: _t, name: _n, label: _l, ts: _ts, timestamp: _stamp, ...rest } = e;
  void _t;
  void _n;
  void _l;
  void _ts;
  void _stamp;

  return { ts, type, label, data: rest };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().min(1, "id_required") });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error } = await requireScope({ context: "GET /api/v2/runs/[id]/export" });
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

  try {
    const memRun = getRunById(id);
    if (memRun?.userId && memRun.userId !== scope.userId) {
      return NextResponse.json({ error: "run_not_found" }, { status: 404 });
    }

    const persisted = memRun ? null : await getPersistedRun(id);
    const run = memRun ?? persisted;
    if (!run) {
      return NextResponse.json({ error: "run_not_found" }, { status: 404 });
    }

    if (run.userId && run.userId !== scope.userId) {
      return NextResponse.json({ error: "run_not_found" }, { status: 404 });
    }

    let events: RunEvent[] = [];
    if (memRun && memRun.events.length > 0) {
      events = memRun.events;
    } else {
      const persistedEvents = await getPersistedRunEvents({ runId: id });
      events = persistedEvents.map((e) => e.payload as RunEvent);
    }

    const timeline = events.length > 0 ? normalizeRunEventsToTimeline({ runId: id, events }) : [];

    // Tri stable des events par timestamp croissant
    const sortedEvents = [...events].sort((a, b) => eventTs(a) - eventTs(b));

    const exportedAt = Date.now();

    const payload = {
      schema: "hearst.run-trace/v1" as const,
      exportedAt,
      run: {
        id: run.id,
        userId: run.userId,
        input: run.input,
        surface: run.surface,
        executionMode: run.executionMode,
        agentId: run.agentId,
        backend: run.backend,
        missionId: run.missionId,
        status: run.status,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        assets: run.assets,
        metrics: run.metrics,
      },
      spans: sortedEvents.map(toSpan),
      raw: {
        events,
        timeline,
      },
    };

    const body = JSON.stringify(payload, null, 2);
    // F-055: Safe filename with UTF-8 RFC 6266 encoding
    const safeName = safeFilename(`run-trace-${id}.json`);
    const encoded = encodeURIComponent(safeName);
    const disposition = `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(`GET /api/v2/runs/${id}/export: uncaught`, e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
