/**
 * GET /api/v2/cockpit/today
 *
 * Source de vérité unique pour la home Stage (mode="cockpit").
 * Agrège agenda, briefing humain, missions running, suggestions et reports
 * favoris derrière un seul endpoint pour minimiser le round-trip au mount.
 *
 * Voir lib/cockpit/today.ts pour la logique d'orchestration et fail-soft.
 */

import { NextResponse } from "next/server";
import { getCockpitToday } from "@/lib/cockpit/today";
import { requireScope } from "@/lib/platform/auth/scope";
import { redactId } from "@/lib/utils/redact";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/v2/cockpit/today" });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  try {
    const payload = await getCockpitToday({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });

    // DIAG TEMPORAIRE — bug "missions vides chez Adrien". Log le scope vu
    // par cette requête + le nombre de missions retournées. Permet de comparer
    // ce que reçoit Chrome user vs Playwright et identifier la divergence.
    // À retirer après résolution.
    console.log(
      `[diag/cockpit-today] scope=user:${redactId(scope.userId)} tenant:${scope.tenantId} workspace:${scope.workspaceId} → missionsRunning=${payload.missionsRunning?.length ?? 0}`,
    );

    return NextResponse.json({
      ...payload,
    });
  } catch (err) {
    console.error("[GET /api/v2/cockpit/today] uncaught", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
