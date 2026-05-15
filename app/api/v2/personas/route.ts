/**
 * GET  /api/v2/personas       — liste des personas du user (incluant builtins fallback)
 * POST /api/v2/personas       — crée une nouvelle persona
 */

import { type NextRequest, NextResponse } from "next/server";
import { createPersonaSchema } from "@/lib/contracts/personas";
import { createPersona, listPersonasForUser } from "@/lib/personas/store";
import type { PersonaInsert } from "@/lib/personas/types";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/v2/personas" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const personas = await listPersonasForUser(scope.userId, scope.tenantId);
  return NextResponse.json({ personas });
}

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({ context: "POST /api/v2/personas" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createPersonaSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

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
