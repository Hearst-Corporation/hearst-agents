/**
 * GET    /api/reports/templates/[templateId] — charge le spec d'un template
 * PUT    /api/reports/templates/[templateId] — met à jour nom/desc/spec/isPublic
 * DELETE /api/reports/templates/[templateId] — supprime (créateur uniquement)
 *
 * Auth : session NextAuth requise. Scope tenant résolu via requireScope.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import {
  loadTemplate,
  deleteTemplate,
  updateTemplate,
} from "@/lib/reports/templates/store";
import { updateReportTemplateSchema } from "@/lib/contracts/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET ───────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { scope, error } = await requireScope({ context: "reports/templates/[id] GET" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { templateId } = await params;
  if (!templateId) {
    return NextResponse.json({ error: "missing_template_id" }, { status: 400 });
  }

  const spec = await loadTemplate({ templateId, tenantId: scope.tenantId });
  if (!spec) {
    return NextResponse.json({ error: "template_not_found" }, { status: 404 });
  }

  return NextResponse.json({ spec });
}

// ── PUT ───────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { scope, error } = await requireScope({ context: "reports/templates/[id] PUT" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { templateId } = await params;
  if (!templateId) {
    return NextResponse.json({ error: "missing_template_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = updateReportTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const updated = await updateTemplate({
    templateId,
    tenantId: scope.tenantId,
    userId: scope.userId,
    patch: parsed.data,
  });

  if (!updated) {
    return NextResponse.json(
      { error: "update_failed_or_forbidden" },
      { status: 404 },
    );
  }

  return NextResponse.json({ template: updated });
}

// ── DELETE ────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { scope, error } = await requireScope({ context: "reports/templates/[id] DELETE" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { templateId } = await params;
  if (!templateId) {
    return NextResponse.json({ error: "missing_template_id" }, { status: 400 });
  }

  await deleteTemplate({
    templateId,
    tenantId: scope.tenantId,
    userId: scope.userId,
  });

  return NextResponse.json({ deleted: true });
}
