import { NextResponse } from "next/server";
import { loadQuarantine, restoreAgent } from "@/lib/hom/quarantine";
import { ALL_AGENTS, type AgentId } from "@/lib/hom/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await loadQuarantine();
  return NextResponse.json(state);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { agent?: string; action?: string; reason?: string };
  if (body.action !== "restore") {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }
  const agent = body.agent;
  if (!agent || !ALL_AGENTS.includes(agent as AgentId)) {
    return NextResponse.json({ error: "invalid agent" }, { status: 400 });
  }
  await restoreAgent(agent as AgentId, body.reason ?? "manual restore");
  return NextResponse.json({ ok: true });
}
