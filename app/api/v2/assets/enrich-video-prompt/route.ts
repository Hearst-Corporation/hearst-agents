/**
 * POST /api/v2/assets/enrich-video-prompt
 *
 * Enrichit un prompt vidéo brut via Claude Haiku (cinématographique). Appelé
 * depuis `AssetVariantTabs` (S2-B) avant d'envoyer la génération à Runway.
 *
 * Body: { prompt: string }
 * Response: { enriched: string, diff: string[] }
 *
 * Auth requise (scope) — l'endpoint coûte 1 appel Haiku, on évite l'usage
 * anonyme.
 */

import { type NextRequest, NextResponse } from "next/server";
import { enrichVideoPrompt } from "@/lib/capabilities/providers/video-prompt-enricher";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/v2/assets/enrich-video-prompt",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  let body: { prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return NextResponse.json({ error: "missing_prompt" }, { status: 400 });
  }

  try {
    const result = await enrichVideoPrompt(body.prompt);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "enrichment_failed";
    console.error("[enrich-video-prompt] failed:", message);
    return NextResponse.json({ error: "enrichment_failed", message }, { status: 500 });
  }
}
