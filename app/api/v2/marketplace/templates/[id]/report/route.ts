/**
 * POST /api/v2/marketplace/templates/[id]/report
 * Body : { reason: string }
 *
 * Signalement abuse — insertion simple dans marketplace_reports. Modération
 * manuelle out-of-scope MVP.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/marketplace/rate-limit";
import { reportTemplate } from "@/lib/marketplace/store";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  reason: z.string().min(3).max(500),
});

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const { scope, error } = await requireScope({
    context: "POST /api/v2/marketplace/templates/[id]/report",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (!checkRateLimit(scope.userId, "report")) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const ok = await reportTemplate(id, scope.userId, parsed.data.reason);
  if (!ok) {
    return NextResponse.json({ error: "report_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
