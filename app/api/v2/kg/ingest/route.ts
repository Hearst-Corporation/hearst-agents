/**
 * POST /api/v2/kg/ingest — Ingest un texte → entités + relations.
 *
 * Signature 7 MVP : Claude haiku extrait, on persiste dans kg_nodes /
 * kg_edges scoped (user_id, tenant_id). Phase B suivante : Letta + Zep
 * + pgvector pour mémoire long terme et raisonnement.
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { extractEntities, upsertNode, upsertEdge } from "@/lib/memory/kg";
import { checkDailyCap } from "@/lib/credits/daily-caps";

const kgIngestBodySchema = z.object({
  text: z.string().min(1).max(50_000),
  sourceLabel: z.string().max(200).optional(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/v2/kg/ingest",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = kgIngestBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const text = parsed.data.text.trim();

  // Daily cap: 10 ingest operations/jour
  const cap = await checkDailyCap(scope.userId, "kg-ingest", 10);
  if (!cap.allowed) {
    return NextResponse.json(
      {
        error: "daily_cap_exceeded",
        current: cap.current,
        max: cap.max,
        message: "Vous avez atteint votre limite quotidienne d'ingest KG (10/jour)",
      },
      { status: 429 },
    );
  }

  try {
    const { entities, relations } = await extractEntities(text);

    const nodeIdByLabel = new Map<string, string>();
    let entitiesCreated = 0;
    for (const entity of entities) {
      const id = await upsertNode(
        { userId: scope.userId, tenantId: scope.tenantId },
        { type: entity.type, label: entity.label, properties: entity.properties ?? {} },
      );
      nodeIdByLabel.set(entity.label, id);
      entitiesCreated += 1;
    }

    let edgesCreated = 0;
    for (const relation of relations) {
      const sourceId = nodeIdByLabel.get(relation.source_label);
      const targetId = nodeIdByLabel.get(relation.target_label);
      if (!sourceId || !targetId) continue;
      await upsertEdge(
        { userId: scope.userId, tenantId: scope.tenantId },
        {
          source_id: sourceId,
          target_id: targetId,
          type: relation.type,
          weight: relation.weight,
        },
      );
      edgesCreated += 1;
    }

    return NextResponse.json({ entitiesCreated, edgesCreated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kg/ingest] failed:", message);
    return NextResponse.json({ error: "ingest_failed", message }, { status: 500 });
  }
}
