import type { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { createAgentSchema, dbErr, err, ok, parseBody, slugify } from "@/lib/domain";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { withScope } from "@/lib/platform/http/route-handler";

const log = withRoute("GET|POST /api/agents");

type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];

export const dynamic = "force-dynamic";

export const GET = withScope("GET /api/agents", async (_req, { scope }) => {
  try {
    const sb = requireServerSupabase();
    // Filtre par tenant_id — évite la fuite cross-tenant (F-002)
    const { data, error } = await sb
      .from("agents")
      .select(
        "id, name, slug, description, model_provider, model_name, status, version, created_at, updated_at",
      )
      .eq("tenant_id", scope.tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return dbErr("GET /api/agents", error);
    return ok({ agents: data ?? [] });
  } catch (e) {
    log.error({ err: redactedError(e) }, "agents_get_failed");
    return err("internal_error", 500);
  }
});

export async function POST(req: NextRequest) {
  const { scope, error: scopeError } = await requireScope({ context: "POST /api/agents" });
  if (scopeError) return err(scopeError.message, scopeError.status);

  try {
    const body = await req.json();
    const parsed = parseBody(createAgentSchema, body);
    if (!parsed.success) return parsed.response;

    const sb = requireServerSupabase();
    const input = parsed.data;
    const slug = input.slug ?? slugify(input.name);

    const row: AgentInsert = {
      name: input.name,
      slug,
      description: input.description ?? null,
      model_provider: input.model_provider,
      model_name: input.model_name,
      system_prompt: input.system_prompt,
      temperature: input.temperature,
      max_tokens: input.max_tokens,
      top_p: input.top_p,
      status: input.status,
      metadata: input.metadata as AgentInsert["metadata"],
      model_profile_id: input.model_profile_id ?? null,
      memory_policy_id: input.memory_policy_id ?? null,
      // Ancre au tenant du scope — clé pour l'isolation multi-tenant (F-002)
      tenant_id: scope.tenantId,
      owner_user_id: scope.userId,
    };

    const { data, error } = await sb.from("agents").insert(row).select().single();

    if (error) return dbErr("POST /api/agents", error);
    return ok({ agent: data }, 201);
  } catch (e) {
    log.error({ err: redactedError(e) }, "agents_post_failed");
    return err("internal_error", 500);
  }
}
