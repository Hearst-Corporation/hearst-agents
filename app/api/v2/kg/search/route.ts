/**
 * GET /api/v2/kg/search?q=<query>
 *
 * Recherche fuzzy de nodes par label (ILIKE %q%). User-scoped.
 * UI : KnowledgeStage.tsx — highlight des hits sur le graphe Cytoscape.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { searchNodes } from "@/lib/memory/kg";
import { withScope } from "@/lib/platform/http/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = withScope("GET /api/v2/kg/search", async (req, { scope }) => {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: searchParams.get("q"),
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const nodes = await searchNodes(
      { userId: scope.userId, tenantId: scope.tenantId },
      parsed.data.q,
      parsed.data.limit,
    );
    return NextResponse.json({ nodes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kg/search] failed:", message);
    return NextResponse.json({ error: "search_failed", message }, { status: 500 });
  }
});
