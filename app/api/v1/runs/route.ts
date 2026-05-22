/**
 * GET /api/v1/runs — Liste les runs du tenant courant.
 *
 * Scope STRICT : filtre tenant_id = ctx.tenant.tenantId au niveau SQL.
 * Requête Supabase directe (plutôt que getRuns de l'adapter v2 qui ne filtre
 * pas par tenantId ni par kind).
 *
 * Query params :
 *   limit   — entier 1-200 (défaut 20)
 *   kind    — filtre le champ `kind` de la table runs (ex: "swarm", "chat")
 *             prioritaire sur `service` si les deux sont fournis
 *   service — filtre par service logique (swarms|action|helm|jobs|other)
 *             applique un filtre SQL .in("kind", ...) + affinement JS
 */

import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { withApiAuth } from "@/lib/platform/http/api-auth";
import {
  kindsForService,
  RUN_SERVICES,
  type RunService,
  refineRunsByService,
  runServiceFromKind,
} from "@/lib/runs/service";

type RunKind = Database["public"]["Enums"]["run_kind"];

const VALID_RUN_KINDS = new Set<string>([
  "chat",
  "workflow",
  "evaluation",
  "tool_test",
  "audio_gen",
  "image_gen",
  "video_gen",
  "doc_parse",
  "code_exec",
  "swarm",
  "computer_action",
]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiAuth("GET /api/v1/runs", async (req, { tenant }) => {
  const url = req.nextUrl;
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Math.max(1, Math.min(200, Number.isNaN(rawLimit) ? 20 : rawLimit));

  const rawKind = url.searchParams.get("kind");
  const kind: RunKind | undefined =
    rawKind && VALID_RUN_KINDS.has(rawKind) ? (rawKind as RunKind) : undefined;

  const rawService = url.searchParams.get("service");
  const service: RunService | undefined =
    !kind && rawService && (RUN_SERVICES as string[]).includes(rawService)
      ? (rawService as RunService)
      : undefined;

  const sb = requireServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  try {
    let query = sb
      .from("runs")
      .select("id, kind, status, input, metadata, user_id, tenant_id, created_at, finished_at")
      .eq("tenant_id", tenant.tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (kind) {
      query = query.eq("kind", kind);
    } else if (service) {
      query = query.in("kind", kindsForService(service) as RunKind[]);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[v1/runs] DB error:", error.message);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }

    const rows = data ?? [];

    // JS-level refinement for service filter (e.g. exclude tool_test non-action)
    const filtered = refineRunsByService(
      rows,
      service,
      (r) => r.kind,
      (r) => r.metadata as Record<string, unknown> | null,
    );

    const runs = filtered.map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const input = (r.input ?? {}) as Record<string, unknown>;
      return {
        id: (meta.runId as string) || r.id,
        dbId: r.id,
        kind: r.kind,
        service: runServiceFromKind(r.kind, meta),
        status: r.status,
        tenantId: r.tenant_id,
        userId: r.user_id,
        input:
          typeof input.message === "string"
            ? (input.message as string).slice(0, 200)
            : JSON.stringify(input).slice(0, 200),
        swarmId: (meta.swarmId as string) ?? undefined,
        swarmName: (meta.swarmName as string) ?? undefined,
        missionId: (meta.missionId as string) ?? undefined,
        createdAt: r.created_at,
        completedAt: r.finished_at ?? undefined,
      };
    });

    return NextResponse.json({ runs });
  } catch (err) {
    console.error("[v1/runs] uncaught:", err instanceof Error ? err.name : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
