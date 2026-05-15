import type { NextRequest } from "next/server";
import { err, ok } from "@/lib/domain";
import { enforceMemoryPolicy } from "@/lib/engine/runtime";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/agents/[id]/memory/govern",
  });
  if (scopeError) return err(scopeError.message, scopeError.status);
  const { id } = await params;
  try {
    const sb = requireServerSupabase();

    // Vérifier ownership : tenant_id + owner_user_id (F-100)
    const { data: agent, error: agentErr } = await sb
      .from("agents")
      .select("memory_policy_id, owner_user_id, tenant_id")
      .eq("id", id)
      .eq("tenant_id", scope.tenantId)
      .single();

    if (agentErr || !agent) return err("not_found", 404);

    // Seul l'owner (ou un admin) peut déclencher le wipe mémoire
    if (agent.owner_user_id !== scope.userId) {
      return err("not_found", 404);
    }

    const result = await enforceMemoryPolicy(sb, id, agent.memory_policy_id);
    return ok({ ...result, agent_id: id });
  } catch (e) {
    console.error(`POST /api/agents/${id}/memory/govern: uncaught`, e);
    return err("internal_error", 500);
  }
}
