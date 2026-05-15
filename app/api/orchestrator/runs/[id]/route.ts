import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { readRunBundle } from "@/lib/hom/registry";
import { readRunSpans } from "@/lib/hom/telemetry";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin("GET /api/orchestrator/runs/[id]", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const { id } = await params;
  const [bundle, spans] = await Promise.all([readRunBundle(id), readRunSpans(id)]);
  if (!bundle.intake) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json({ ...bundle, spans });
}
