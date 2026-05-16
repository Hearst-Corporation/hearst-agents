/**
 * GET    /api/v2/personas/[id]   — détail
 * PATCH  /api/v2/personas/[id]   — mise à jour partielle
 * DELETE /api/v2/personas/[id]   — suppression
 */

import { type NextRequest, NextResponse } from "next/server";
import { updatePersonaSchema } from "@/lib/contracts/personas";
import { deletePersona, getPersonaById, updatePersona } from "@/lib/personas/store";
import type { PersonaUpdate } from "@/lib/personas/types";
import { requireScope } from "@/lib/platform/auth/scope";
import { withScope } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export const GET = withScope<{ id: string }>(
  "GET /api/v2/personas/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;
    const persona = await getPersonaById(id, {
      userId: scope.userId,
      tenantId: scope.tenantId,
    });
    if (!persona) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ persona });
  },
);

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { scope, error } = await requireScope({
    context: "PATCH /api/v2/personas/[id]",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const { id } = await ctx.params;

  if (id.startsWith("builtin:")) {
    return NextResponse.json(
      { error: "builtin_immutable", message: "Les personas builtin ne sont pas modifiables." },
      { status: 400 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = updatePersonaSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // On ne propage au store que les clés effectivement présentes dans le
  // payload (sémantique PATCH stricte : absente = pas de patch). zod ne
  // distingue pas optional-absent/optional-undefined dans `data`, donc on
  // re-checke la présence sur le payload brut.
  const rawObj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const data = parsed.data;
  const patch: PersonaUpdate = {};
  if ("name" in rawObj && data.name !== undefined) patch.name = data.name;
  if ("description" in rawObj && data.description !== undefined) {
    patch.description = data.description;
  }
  if ("tone" in rawObj) patch.tone = data.tone ?? null;
  if ("vocabulary" in rawObj) patch.vocabulary = data.vocabulary ?? null;
  if ("styleGuide" in rawObj) patch.styleGuide = data.styleGuide ?? null;
  if ("systemPromptAddon" in rawObj) {
    patch.systemPromptAddon = data.systemPromptAddon ?? null;
  }
  if ("surface" in rawObj) patch.surface = data.surface ?? null;
  if ("isDefault" in rawObj && data.isDefault !== undefined) {
    patch.isDefault = data.isDefault;
  }

  const updated = await updatePersona(
    id,
    { userId: scope.userId, tenantId: scope.tenantId },
    patch,
  );
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ persona: updated });
}

export const DELETE = withScope<{ id: string }>(
  "DELETE /api/v2/personas/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;
    if (id.startsWith("builtin:")) {
      return NextResponse.json(
        { error: "builtin_immutable", message: "Builtin non supprimable." },
        { status: 400 },
      );
    }
    const ok = await deletePersona(id, {
      userId: scope.userId,
      tenantId: scope.tenantId,
    });
    if (!ok) {
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  },
);
