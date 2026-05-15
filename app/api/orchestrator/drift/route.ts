import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { loadDriftLog } from "@/lib/hom/drift";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/drift", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const drift = await loadDriftLog();
  // Stats par type
  const byType: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  for (const d of drift) {
    byType[d.type] = (byType[d.type] ?? 0) + 1;
    byFile[d.file] = (byFile[d.file] ?? 0) + 1;
  }
  return NextResponse.json({
    total: drift.length,
    byType,
    topFiles: Object.entries(byFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([file, count]) => ({ file, count })),
    recent: drift.slice(-50).reverse(),
  });
}
