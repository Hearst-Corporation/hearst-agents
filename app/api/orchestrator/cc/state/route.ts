import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { loadCC } from "@/lib/hom/cc-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/cc/state", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const state = await loadCC();
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
