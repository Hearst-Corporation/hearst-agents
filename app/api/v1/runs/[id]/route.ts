/**
 * GET /api/v1/runs/[id] — Retourne un run par id, scopé au tenant courant.
 *
 * Scope STRICT : vérifie tenant_id = ctx.tenant.tenantId (double-lock : filtre SQL
 * + vérification applicative). Retourne 404 si le run n'existe pas OU appartient
 * à un autre tenant (pas de fuite d'existence cross-tenant).
 */

import { NextResponse } from "next/server";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { withApiAuth } from "@/lib/platform/http/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiAuth<{ id: string }>(
  "GET /api/v1/runs/[id]",
  async (_req, { tenant, params }) => {
    const { id } = params;

    if (!id || typeof id !== "string" || id.trim() === "") {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }

    const sb = requireServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
    }

    try {
      // Filtre tenant_id au niveau SQL — prévient fuite cross-tenant même si
      // l'attaquant connaît l'UUID. Double-lock : vérification applicative ci-dessous.
      const { data, error } = await sb
        .from("runs")
        .select("id, kind, status, input, metadata, user_id, tenant_id, created_at, finished_at")
        .eq("id", id)
        .eq("tenant_id", tenant.tenantId)
        .maybeSingle();

      if (error) {
        console.error(`[v1/runs/${id}] DB error:`, error.message);
        return NextResponse.json({ error: "internal_error" }, { status: 500 });
      }

      if (!data) {
        // Pas de run OU appartient à un autre tenant — même 404 (pas de fuite)
        return NextResponse.json({ error: "run_not_found" }, { status: 404 });
      }

      // Vérification applicative défensive (tenantId déjà filtré SQL — belt-and-suspenders)
      if (data.tenant_id && data.tenant_id !== tenant.tenantId) {
        console.warn(`[v1/runs/${id}] tenant mismatch — access denied`);
        return NextResponse.json({ error: "run_not_found" }, { status: 404 });
      }

      const meta = (data.metadata ?? {}) as Record<string, unknown>;
      const input = (data.input ?? {}) as Record<string, unknown>;

      const run = {
        id: (meta.runId as string) || data.id,
        dbId: data.id,
        kind: data.kind,
        status: data.status,
        tenantId: data.tenant_id,
        userId: data.user_id,
        input:
          typeof input.message === "string" ? (input.message as string) : JSON.stringify(input),
        swarmId: (meta.swarmId as string) ?? undefined,
        swarmName: (meta.swarmName as string) ?? undefined,
        missionId: (meta.missionId as string) ?? undefined,
        metadata: meta,
        createdAt: data.created_at,
        completedAt: data.finished_at ?? undefined,
      };

      return NextResponse.json({ run });
    } catch (err) {
      console.error(`[v1/runs/${id}] uncaught:`, err instanceof Error ? err.name : err);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);
