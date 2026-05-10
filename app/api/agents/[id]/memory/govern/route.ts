import { NextRequest } from "next/server";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { ok, err } from "@/lib/domain";
import { enforceMemoryPolicy } from "@/lib/engine/runtime";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: scopeError } = await requireScope({ context: "POST /api/agents/[id]/memory/govern" });
  if (scopeError) return err(scopeError.message, scopeError.status);
  const { id } = await params;
  try {
    const sb = requireServerSupabase();

    const { data: agent, error: agentErr } = await sb
      .from("agents")
      .select("memory_policy_id")
      .eq("id", id)
      .single();

    if (agentErr || !agent) return err("agent_not_found", 404);

    const result = await enforceMemoryPolicy(sb, id, agent.memory_policy_id);
    return ok({ ...result, agent_id: id });
  } catch (e) {
    console.error(`POST /api/agents/${id}/memory/govern: uncaught`, e);
    return err("internal_error", 500);
  }
}
