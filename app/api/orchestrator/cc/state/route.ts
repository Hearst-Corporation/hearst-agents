import { NextResponse } from "next/server";
import { loadCC } from "@/lib/hom/cc-state";
import { requireAdmin, isError } from "@/app/api/admin/_helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/cc/state", { resource: "settings", action: "read" });
  if (isError(guard)) return guard;
  const state = await loadCC();
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
