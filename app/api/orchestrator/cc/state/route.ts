import { NextResponse } from "next/server";
import { loadCC } from "@/lib/hom/cc-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await loadCC();
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
