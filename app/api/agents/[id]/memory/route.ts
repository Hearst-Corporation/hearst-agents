import type { NextRequest } from "next/server";
import { createMemorySchema, dbErr, err, ok, parseBody } from "@/lib/domain";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { withScope } from "@/lib/platform/http/route-handler";

const log = withRoute("GET|POST /api/agents/[id]/memory");

export const dynamic = "force-dynamic";

export const GET = withScope<{ id: string }>(
  "GET /api/agents/[id]/memory",
  async (_req, { scope, params }) => {
    const { id } = params;
    try {
      const sb = requireServerSupabase();

      // Vérifier ownership agent avant de lire la mémoire (F-094)
      const { data: agent } = await sb
        .from("agents")
        .select("id")
        .eq("id", id)
        .eq("tenant_id", scope.tenantId)
        .single();
      if (!agent) return err("not_found", 404);

      const { data, error } = await sb
        .from("agent_memory")
        .select("*")
        .eq("agent_id", id)
        .eq("user_id", scope.userId)
        .order("importance", { ascending: false })
        .limit(50);

      if (error) return dbErr(`GET /api/agents/${id}/memory`, error);
      return ok({ memories: data ?? [] });
    } catch (e) {
      log.error({ err: redactedError(e) }, "agent_memory_get_failed");
      return err("internal_error", 500);
    }
  },
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error: scopeError } = await requireScope({
    context: "POST /api/agents/[id]/memory",
  });
  if (scopeError) return err(scopeError.message, scopeError.status);
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = parseBody(createMemorySchema, body);
    if (!parsed.success) return parsed.response;

    const sb = requireServerSupabase();

    // Vérifier ownership agent avant d'écrire (F-094)
    const { data: agent } = await sb
      .from("agents")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", scope.tenantId)
      .single();
    if (!agent) return err("not_found", 404);

    const input = parsed.data;

    // Persister user_id + tenant_id pour l'isolation RLS (F-094)
    const { data, error } = await sb
      .from("agent_memory")
      .insert({
        agent_id: id,
        user_id: scope.userId,
        tenant_id: scope.tenantId,
        memory_type: input.memory_type,
        key: input.key,
        value: input.value,
        importance: input.importance,
        expires_at: input.expires_at ?? null,
      })
      .select()
      .single();

    if (error) return dbErr(`POST /api/agents/${id}/memory`, error);
    return ok({ memory: data }, 201);
  } catch (e) {
    log.error({ err: redactedError(e) }, "agent_memory_post_failed");
    return err("internal_error", 500);
  }
}
