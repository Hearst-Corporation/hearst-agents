/**
 * POST /api/v2/browser/[id]/extract — Extraction structurée via Stagehand.
 *
 * Body : `{ instruction: string, schema: Record<string,unknown> }`. On lance
 * une mini-task d'extraction one-shot (pas de plan), persiste le résultat
 * comme asset JSON (kind="extract") et retourne `{ assetId, data }`.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { persistExtraction } from "@/lib/browser/screenshot";
import { runBrowserTask } from "@/lib/browser/stagehand-executor";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

const browserExtractBodySchema = z
  .object({
    instruction: z.string().min(1).max(10_000),
    schema: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { scope, error } = await requireScope({
    context: "POST /api/v2/browser/[id]/extract",
  });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  if (!id?.trim()) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  // Ownership check (F-005)
  try {
    const sb = requireServerSupabase();
    const { data: owned } = await sb
      .from("browser_sessions")
      .select("user_id")
      .eq("session_id", id)
      .eq("user_id", scope.userId)
      .single();
    if (!owned) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch {
    // Graceful degradation si table inaccessible
  }

  if (!process.env.BROWSERBASE_API_KEY) {
    return NextResponse.json({ error: "browserbase_unavailable" }, { status: 503 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = browserExtractBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const instruction = body.instruction.trim();

  try {
    const result = await runBrowserTask({
      sessionId: id,
      task: instruction,
      extractInstruction: instruction,
      extractSchema: body.schema,
      maxActions: 5,
    });

    const asset = await persistExtraction(id, result.extractData, scope, {
      instruction,
      schema: body.schema,
    });

    return NextResponse.json({
      assetId: asset.id,
      data: result.extractData,
      totalActions: result.totalActions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[BrowserExtract] failed:", message);
    return NextResponse.json({ error: "extract_failed", message }, { status: 502 });
  }
}
