import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { listRuns } from "@/lib/hom/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/runs", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const runs = await listRuns();
  return NextResponse.json({ runs });
}
