import { NextResponse } from "next/server";
import { readRunBundle } from "@/lib/hom/registry";
import { readRunSpans } from "@/lib/hom/telemetry";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [bundle, spans] = await Promise.all([readRunBundle(id), readRunSpans(id)]);
  if (!bundle.intake) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json({ ...bundle, spans });
}
