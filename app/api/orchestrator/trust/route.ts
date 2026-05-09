import { NextResponse } from "next/server";
import { latestScores, loadHistory } from "@/lib/hom/trust";

export const dynamic = "force-dynamic";

export async function GET() {
  const [scores, history] = await Promise.all([latestScores(), loadHistory()]);
  return NextResponse.json({ scores, history: history.slice(-30) });
}
