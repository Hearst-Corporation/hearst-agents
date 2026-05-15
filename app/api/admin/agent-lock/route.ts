import { type NextRequest, NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { type AgentLockState, getAgentLockState, setAgentLockState } from "@/lib/agent-lock";
import { withRoute } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = withRoute("POST /api/admin/agent-lock");

export async function GET() {
  const state = await getAgentLockState();
  return NextResponse.json(state);
}

interface ToggleBody {
  locked?: boolean;
  reason?: string | null;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin("admin/agent-lock", { resource: "settings", action: "admin" });
  if (isError(guard)) return guard;
  const { scope } = guard;

  let body: ToggleBody = {};
  try {
    body = (await request.json()) as ToggleBody;
  } catch {
    body = {};
  }

  if (typeof body.locked !== "boolean") {
    return NextResponse.json(
      { error: "invalid_payload", message: "locked: boolean requis" },
      { status: 400 },
    );
  }

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
