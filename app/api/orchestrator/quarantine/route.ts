import { NextResponse } from "next/server";
import { z } from "zod";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { loadQuarantine, restoreAgent } from "@/lib/hom/quarantine";
import { type AgentId, ALL_AGENTS } from "@/lib/hom/types";

const quarantineBodySchema = z
  .object({
    action: z.literal("restore"),
    agent: z.enum(ALL_AGENTS as [AgentId, ...AgentId[]]),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/orchestrator/quarantine", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;
  const state = await loadQuarantine();
  return NextResponse.json(state);
}

export async function POST(req: Request) {
  const guard = await requireAdmin("POST /api/orchestrator/quarantine", {
    resource: "settings",
    action: "update",
  });
  if (isError(guard)) return guard;

  const raw = await (req as Request & { json(): Promise<unknown> }).json().catch(() => null);
  const parsed = quarantineBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await restoreAgent(parsed.data.agent, parsed.data.reason ?? "manual restore");
  return NextResponse.json({ ok: true });
}
