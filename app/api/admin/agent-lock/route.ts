import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { type AgentLockState, getAgentLockState, setAgentLockState } from "@/lib/agent-lock";
import { withRoute } from "@/lib/observability/logger";
import { parseJsonBody } from "@/lib/platform/http/parse-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = withRoute("POST /api/admin/agent-lock");

export async function GET() {
  const guard = await requireAdmin("GET /api/admin/agent-lock", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;

  const state = await getAgentLockState();
  return NextResponse.json(state);
}

const toggleBodySchema = z.object({
  locked: z.boolean(),
  reason: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin("admin/agent-lock", { resource: "settings", action: "admin" });
  if (isError(guard)) return guard;
  const { scope } = guard;

  const parsedBody = await parseJsonBody(request, toggleBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 280)
      : null;

  const next: AgentLockState = await setAgentLockState({
    locked: body.locked,
    lockedBy: scope.userId,
    reason,
  });

  log.info(
    { locked: next.locked, userId: scope.userId, hasReason: reason !== null },
    "agent_lock_toggled",
  );

  return NextResponse.json(next);
}
