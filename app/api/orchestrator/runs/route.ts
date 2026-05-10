import { NextResponse } from "next/server";
import { listRuns } from "@/lib/hom/registry";
import { requireAdmin, isError } from "@/app/api/admin/_helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/runs", { resource: "settings", action: "read" });
  if (isError(guard)) return guard;
  const runs = await listRuns();
  return NextResponse.json({ runs });
}
