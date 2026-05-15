import { type NextRequest, NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { getRuns } from "@/lib/engine/runtime/state/adapter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin("GET /api/admin/runs/recent", {
    resource: "runs",
    action: "read",
  });
  if (isError(guard)) return guard;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 50);
  // F-109: Never trust userId from query params — use admin's scope only.
  // Ancienne interface acceptait userId param → potential profile enumeration.
  // À présent, on retourne les runs de l'admin lui-même (pas de profile browsing).

  try {
    const runs = await getRuns({ limit });
    return NextResponse.json({ runs });
  } catch (e) {
    console.error("[Admin API] GET /runs/recent error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
