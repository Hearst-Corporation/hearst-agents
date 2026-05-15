/**
 * POST /api/reports/[reportId]/rerun
 *
 * Re-déclenche le pipeline d'un report depuis son asset_id. Charge l'asset,
 * résout le spec d'origine via provenance.specId (catalog ou custom template),
 * relance runReport et enregistre le nouveau payload sur le même asset.
 *
 * Body optionnel : { noCache?: boolean }
 */

import { type NextRequest, NextResponse } from "next/server";
import { type Asset, loadAssetById, storeAsset } from "@/lib/assets/types";
import { reportIdParamSchema, rerunReportSchema } from "@/lib/contracts/reports";
import { requireScope } from "@/lib/platform/auth/scope";
import { getCatalogEntry } from "@/lib/reports/catalog";
import { runReport } from "@/lib/reports/engine/run-report";
import { createSourceLoader } from "@/lib/reports/sources";
import { loadTemplate } from "@/lib/reports/templates/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const parsed = reportIdParamSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { reportId } = parsed.data;

  const { scope, error } = await requireScope({
    context: `POST /api/reports/${reportId}/rerun`,
  });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  let rawBody: unknown = {};
  try {
    rawBody = await req.json().catch(() => ({}));
  } catch {
    rawBody = {};
  }

  const bodyParsed = rerunReportSchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: bodyParsed.error.issues },
      { status: 400 },
    );
  }
  const body = bodyParsed.data;

  // 1. Charger l'asset source
  const asset = await loadAssetById(reportId, {
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
  });

  if (!asset) {
    return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
  }

  const specId = asset.provenance?.specId;
  if (!specId) {
    return NextResponse.json(
      { error: "no_spec_ref", message: "Cet asset n'a pas de specId — rerun impossible." },
      { status: 422 },
    );
  }

  const callerScope = {
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    userId: scope.userId,
  };

  // 2. Résoudre le spec (catalog ou custom template)
  let spec = null;
  const entry = getCatalogEntry(specId);
  if (entry) {
    spec = entry.build(callerScope);
  } else {
    const custom = await loadTemplate({ templateId: specId, tenantId: scope.tenantId });
    if (custom) {
      spec = { ...custom, scope: callerScope };
    }
  }

  if (!spec) {
    return NextResponse.json({ error: "spec_not_found" }, { status: 404 });
  }

  // 3. Relancer le pipeline
  const noCache = body.noCache === true;
  const loader = createSourceLoader({ spec, noCache });

  let result;
  try {
    result = await runReport(spec, { sourceLoader: loader, noCache });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rerun] runReport failed (${reportId}):`, msg);
    return NextResponse.json({ error: "run_failed", detail: msg }, { status: 500 });
  }

  // 4. Mettre à jour le contentRef de l'asset d'origine
  const updated: Asset = {
    ...asset,
    contentRef: JSON.stringify({
      ...result.payload,
      narration: result.narration,
    }),
    provenance: {
      ...asset.provenance,
      providerId: asset.provenance?.providerId ?? "system",
      reportMeta: {
        signals: result.signals,
        severity: result.severity,
      },
    },
  };
  storeAsset(updated);

  return NextResponse.json({
    ok: true,
    assetId: reportId,
    title: spec.meta.title,
    payload: result.payload,
    narration: result.narration,
    signals: result.signals,
    severity: result.severity,
    cacheHit: result.cacheHit,
    cost: result.cost,
    durationMs: result.durationMs,
  });
}
