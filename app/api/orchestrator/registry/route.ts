import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { buildRegistry } from "@/lib/hom/registry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin("GET /api/orchestrator/registry", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  const reg = await buildRegistry();

  if (view) {
    const filtered = reg.entries.filter((e) => e.kind === view);
    return NextResponse.json({ ...reg, entries: filtered });
  }
  return NextResponse.json(reg);
}
