/**
 * GET  /api/v2/personas       — liste des personas du user (incluant builtins fallback)
 * POST /api/v2/personas       — crée une nouvelle persona
 */

import { type NextRequest, NextResponse } from "next/server";
import { createPersonaSchema } from "@/lib/contracts/personas";
import { createPersona, listPersonasForUser } from "@/lib/personas/store";
import type { PersonaInsert } from "@/lib/personas/types";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { withScope } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";

export const GET = withScope("GET /api/v2/personas", async (_req, { scope }) => {
  const personas = await listPersonasForUser(scope.userId, scope.tenantId);
  return NextResponse.json({ personas });
});

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({ context: "POST /api/v2/personas" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const parsedBody = await parseJsonBody(req, createPersonaSchema);
  if (!parsedBody.ok) return parsedBody.response;
  const data = parsedBody.data;

  const insert: PersonaInsert = {
    userId: scope.userId,
    tenantId: scope.tenantId,
    name: data.name,
    description: data.description,
    tone: data.tone ?? null,
    vocabulary: data.vocabulary ?? null,
    styleGuide: data.styleGuide ?? null,
    systemPromptAddon: data.systemPromptAddon ?? null,
    surface: data.surface ?? null,
    isDefault: data.isDefault === true,
  };

  try {
    const persona = await createPersona(insert);
    return NextResponse.json({ persona }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "create_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
