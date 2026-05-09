import { NextResponse } from "next/server";
import { buildRegistry } from "@/lib/hom/registry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  const reg = await buildRegistry();

  if (view) {
    const filtered = reg.entries.filter((e) => e.kind === view);
    return NextResponse.json({ ...reg, entries: filtered });
  }
  return NextResponse.json(reg);
}
