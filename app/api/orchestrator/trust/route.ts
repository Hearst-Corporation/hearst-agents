import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { latestScores, loadHistory } from "@/lib/hom/trust";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/trust", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const [scores, history] = await Promise.all([latestScores(), loadHistory()]);
  return NextResponse.json({ scores, history: history.slice(-30) });
}
