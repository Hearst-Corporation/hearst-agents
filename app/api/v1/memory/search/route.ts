/**
 * POST /api/v1/memory/search — Recherche dans Cortex LTM pour le tenant courant.
 *
 * Appelle searchCortexMemory (lib/memory/cortex-client.ts) avec
 * tenantId + userId issus de ctx.tenant → isolation mémoire multi-tenant garantie.
 *
 * Body : { query: string, limit?: number (1-25, défaut 5) }
 * Retour : { results: RetrievedEmbedding[] }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { searchCortexMemory } from "@/lib/memory/cortex-client";
import { withApiAuth } from "@/lib/platform/http/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const searchBodySchema = z.object({
  query: z.string().min(1).max(2_000),
  limit: z.number().int().min(1).max(25).optional(),
});

export const POST = withApiAuth("POST /api/v1/memory/search", async (req, { tenant }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = searchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const results = await searchCortexMemory({
      query: parsed.data.query,
      k: parsed.data.limit,
      tenantId: tenant.tenantId,
      userId: tenant.userId ?? undefined,
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error(
      "[v1/memory/search] searchCortexMemory error:",
      err instanceof Error ? err.name : err,
    );
    return NextResponse.json({ error: "memory_unavailable" }, { status: 503 });
  }
});
