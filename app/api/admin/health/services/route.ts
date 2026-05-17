/**
 * GET /api/admin/health/services — santé des services externes.
 *
 * Pingue tous les services tiers configurés via env var (LLM, search, media,
 * storage, cache, jobs, observability…) en parallèle et retourne un rapport
 * normalisé pour le dashboard `/admin/health`.
 *
 * RBAC : lecture sur `settings`. Le payload peut révéler quelles intégrations
 * sont actives → admin-only.
 *
 * Sœur de `/api/admin/health` (qui reste un check interne DB/storage/LLM).
 * Sœur de `/api/health/llm` (qui expose les agrégats LLM in-process, sans
 * sortie réseau).
 */

import { NextResponse } from "next/server";
import { getServicesHealth } from "@/lib/admin/health";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { isError, requireAdmin } from "../../_helpers";

const log = withRoute("GET /api/admin/health/services");

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("GET /api/admin/health/services", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;

  try {
    const report = await getServicesHealth();
    // 200 même si certains services sont "down" : c'est l'état rapporté qui
    // compte côté client. Sinon on remonte 503 quand tout est mort.
    const allDown = report.summary.total > 0 && report.summary.ok === 0;
    return NextResponse.json(report, { status: allDown ? 503 : 200 });
  } catch (e) {
    log.error({ err: redactedError(e) }, "services_health_check_failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
