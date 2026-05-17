import type { NextRequest } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import type { Database } from "@/lib/database.types";
import { createToolSchema, dbErr, err, ok, parseBody, slugify } from "@/lib/domain";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

const log = withRoute("GET|POST /api/tools");

type ToolInsert = Database["public"]["Tables"]["tools"]["Insert"];

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireScope({ context: "GET /api/tools" });
    if (auth.error) return err(auth.error.message, auth.error.status);

    const sb = requireServerSupabase();
    const { data, error } = await sb
      .from("tools")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return dbErr("GET /api/tools", error);
    return ok({ tools: data ?? [] });
  } catch (e) {
    log.error({ err: redactedError(e) }, "tools_get_failed");
    return err("internal_error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    // `tools` est un catalogue système global (pas de tenant_id). L'écriture
    // doit donc rester réservée aux rôles admin pour éviter qu'un utilisateur
    // standard injecte une tool visible par tous les tenants.
    const guard = await requireAdmin("POST /api/tools", { resource: "tools", action: "create" });
    if (isError(guard)) return guard;

    const body = await req.json();
    const parsed = parseBody(createToolSchema, body);
    if (!parsed.success) return parsed.response;

    const sb = requireServerSupabase();
    const input = parsed.data;
    const slug = input.slug ?? slugify(input.name);

    const row: ToolInsert = {
      name: input.name,
      slug,
      description: input.description ?? null,
      endpoint_url: input.endpoint_url ?? null,
      http_method: input.http_method,
      input_schema: input.input_schema as ToolInsert["input_schema"],
      output_schema: input.output_schema as ToolInsert["output_schema"],
      auth_type: input.auth_type,
      auth_config: input.auth_config as ToolInsert["auth_config"],
      timeout_ms: input.timeout_ms,
    };

    const { data, error } = await sb.from("tools").insert(row).select().single();

    if (error) return dbErr("POST /api/tools", error);
    return ok({ tool: data }, 201);
  } catch (e) {
    log.error({ err: redactedError(e) }, "tools_post_failed");
    return err("internal_error", 500);
  }
}
