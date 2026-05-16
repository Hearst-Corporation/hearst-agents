import type { NextRequest } from "next/server";
import type { Database, Json } from "@/lib/database.types";
import { dbErr, err, ok, parseBody, updateAgentSchema } from "@/lib/domain";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { withScope } from "@/lib/platform/http/route-handler";

type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"];

export const dynamic = "force-dynamic";

export const GET = withScope<{ id: string }>(
  "GET /api/agents/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;
    try {
      const sb = requireServerSupabase();
      // Filtre tenant_id — protège contre IDOR cross-tenant (F-002)
      const { data, error } = await sb
        .from("agents")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", scope.tenantId)
        .single();
      if (error || !data) return err("not_found", 404);
      return ok({ agent: data });
    } catch (e) {
      console.error(`GET /api/agents/${id}: uncaught`, e);
      return err("internal_error", 500);
    }
  },
);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error: scopeError } = await requireScope({ context: "PUT /api/agents/[id]" });
  if (scopeError) return err(scopeError.message, scopeError.status);
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = parseBody(updateAgentSchema, body);
    if (!parsed.success) return parsed.response;

    const sb = requireServerSupabase();

    // Load current state before update — filtre tenant_id pour IDOR (F-002)
    const { data: current } = await sb
      .from("agents")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", scope.tenantId)
      .single();
    if (!current) return err("not_found", 404);

    // Auto-snapshot: create version from current state
    const configSnapshot = {
      model_provider: current.model_provider,
      model_name: current.model_name,
      temperature: current.temperature,
      max_tokens: current.max_tokens,
      top_p: current.top_p,
    } as Record<string, Json>;

    const { data: versionData } = await sb
      .from("agent_versions")
      .insert({
        agent_id: id,
        version: current.version,
        system_prompt: current.system_prompt,
        config_snapshot: configSnapshot,
        model_profile_id: current.model_profile_id ?? null,
      })
      .select("id")
      .single();

    // Increment version + apply update
    const updateData = {
      ...(parsed.data as AgentUpdate),
      version: current.version + 1,
      active_version_id: versionData?.id ?? current.active_version_id,
    };

    const { data, error } = await sb
      .from("agents")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", scope.tenantId)
      .select()
      .single();

    if (error) return dbErr(`PUT /api/agents/${id}`, error);
    return ok({ agent: data, version_snapshot_id: versionData?.id });
  } catch (e) {
    console.error(`PUT /api/agents/${id}: uncaught`, e);
    return err("internal_error", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error: scopeError } = await requireScope({ context: "DELETE /api/agents/[id]" });
  if (scopeError) return err(scopeError.message, scopeError.status);
  const { id } = await params;
  try {
    const sb = requireServerSupabase();
    // Filtre tenant_id — un user ne peut supprimer que ses propres agents (F-002)
    const { error } = await sb.from("agents").delete().eq("id", id).eq("tenant_id", scope.tenantId);
    if (error) return dbErr(`DELETE /api/agents/${id}`, error);
    return ok({ deleted: true });
  } catch (e) {
    console.error(`DELETE /api/agents/${id}: uncaught`, e);
    return err("internal_error", 500);
  }
}
